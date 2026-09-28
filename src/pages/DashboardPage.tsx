import { useState } from "react";

import { clearAuthToken } from "../api/client";
import {
  adminApi,
  enrollmentsApi,
  notificationsApi,
  studentsApi,
  teachersApi,
} from "../api/endpoints";
import ApiQueryState from "../components/ApiQueryState";
import { useApiQuery } from "../hooks/useApiQuery";
import type { NavigateFn } from "../types";

interface Section {
  key: string;
  label: string;
  icon?: string;
  load: () => Promise<unknown>;
}

// قاموس لترجمة مفاتيح الـ API إلى العربية تلقائياً
const fieldLabels: Record<string, string> = {
  id: "المعرف",
  title: "العنوان",
  name: "الاسم",
  fullName: "الاسم الكامل",
  firstName: "الاسم الأول",
  lastName: "اسم العائلة",
  email: "البريد الإلكتروني",
  phoneNumber: "رقم الهاتف",
  parentPhoneNumber: "هاتف ولي الأمر",
  studentNumber: "كود الطالب",
  academicYear: "الصف الدراسي",
  role: "الدور",
  status: "الحالة",
  createdAt: "تاريخ الإنشاء",
  updatedAt: "تاريخ التحديث",
  price: "السعر",
  courseName: "اسم الدورة",
  studentName: "اسم الطالب",
  teacherName: "اسم المعلم",
  description: "الوصف",
  isRead: "حالة القراءة",
  message: "الرسالة",
};

function getSections(role: string): Section[] {
  if (role.includes("admin")) {
    return [
      { key: "stats", label: "الإحصاءات", load: adminApi.stats },
      { key: "courses", label: "الدورات", load: () => adminApi.courses() },
      { key: "teachers", label: "المعلمون", load: () => adminApi.teachers() },
      { key: "students", label: "الطلاب", load: () => adminApi.students() },
      {
        key: "enrollments",
        label: "طلبات الالتحاق",
        load: () => enrollmentsApi.adminList(),
      },
    ];
  }
  if (role.includes("teacher")) {
    return [
      {
        key: "overview",
        label: "نظرة عامة",
        load: async () => ({
          profile: await teachersApi.me(),
          stats: await teachersApi.stats(),
        }),
      },
      {
        key: "courses",
        label: "دوراتي",
        load: () => teachersApi.coursesMine(),
      },
      {
        key: "enrollments",
        label: "طلبات الالتحاق",
        load: () => teachersApi.enrollmentRequests(),
      },
    ];
  }
  return [
    { key: "profile", label: "ملفي الشخصي", load: studentsApi.me },
    {
      key: "courses",
      label: "الدورات والاشتراكات",
      load: () => studentsApi.enrollments(),
    },
    { key: "notifications", label: "الإشعارات", load: notificationsApi.list },
  ];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function getRecords(data: unknown): Record<string, unknown>[] {
  if (Array.isArray(data)) return data.filter(isRecord);
  if (isRecord(data) && Array.isArray(data.items))
    return data.items.filter(isRecord);
  return isRecord(data) ? [data] : [];
}

function formatValue(key: string, value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "نعم" : "لا";
  if (key.toLowerCase().includes("date") || key.toLowerCase().includes("at")) {
    const date = new Date(String(value));
    if (!isNaN(date.getTime())) {
      return date.toLocaleDateString("ar-EG", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    }
  }
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

export default function DashboardPage({ navigate }: { navigate: NavigateFn }) {
  const role = window.sessionStorage.getItem("eduhub.auth.role") ?? "student";
  const sections = getSections(role);
  const [activeKey, setActiveKey] = useState(sections[0].key);
  const [reloadKey, setReloadKey] = useState(0);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const section = sections.find(({ key }) => key === activeKey) ?? sections[0];
  const { data, error, loading } = useApiQuery(section.load, reloadKey);
  const records = getRecords(data);

  async function handleEnrollment(id: string, approve: boolean) {
    try {
      setActionLoading(`${id}-${approve ? "approve" : "reject"}`);
      if (role.includes("admin")) {
        await (approve
          ? enrollmentsApi.adminApprove(id)
          : enrollmentsApi.adminReject(id));
      } else {
        await (approve
          ? teachersApi.approveEnrollment(id)
          : teachersApi.rejectEnrollment(id));
      }
    } catch {
      // إمكانية إظهار التنبيه هنا
    } finally {
      setActionLoading(null);
      setReloadKey((key) => key + 1);
    }
  }

  async function handleMarkRead(id?: string) {
    try {
      setActionLoading(id ? `read-${id}` : "read-all");
      if (id) await notificationsApi.markRead(id);
      else await notificationsApi.markAllRead();
    } catch {
      // التعامل مع الخطأ
    } finally {
      setActionLoading(null);
      setReloadKey((key) => key + 1);
    }
  }

  function signOut() {
    clearAuthToken();
    window.sessionStorage.removeItem("eduhub.auth.role");
    navigate("landing");
  }

  const roleBadge = role.includes("admin")
    ? {
        title: "إدارة المنصة",
        badge: "مسؤول النظام",
        color: "bg-purple-100 text-purple-700",
      }
    : role.includes("teacher")
      ? {
          title: "لوحة المعلم",
          badge: "معلم",
          color: "bg-blue-100 text-blue-700",
        }
      : {
          title: "مساحة الطالب",
          badge: "طالب",
          color: "bg-emerald-100 text-emerald-700",
        };

  return (
    <div className="page-ambient min-h-[calc(100dvh-10rem)] bg-canvas pb-12 dir-rtl">
      {/* Top Header Navigation */}
      <header className="sticky top-0 z-10 border-b border-stroke bg-surface/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-nuwa-base/10 text-nuwa-base">
              <svg
                className="h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"
                />
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-ink">
                  {roleBadge.title}
                </h1>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${roleBadge.color}`}
                >
                  {roleBadge.badge}
                </span>
              </div>
              <p className="text-xs text-ink-muted">
                مرحباً بك في منصة وَعي التعليمية
              </p>
            </div>
          </div>

          <button
            onClick={signOut}
            className="flex items-center gap-2 rounded-lg border border-stroke bg-surface px-4 py-2 text-xs font-semibold text-ink shadow-sm transition-all hover:bg-canvas hover:text-danger active:scale-95"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
              />
            </svg>
            تسجيل الخروج
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="mx-auto max-w-7xl px-4 pt-6 sm:px-6 lg:px-8">
        {/* Navigation Tabs */}
        <div className="no-scrollbar flex gap-2 overflow-x-auto border-b border-stroke pb-px">
          {sections.map((item) => {
            const isActive = activeKey === item.key;
            return (
              <button
                key={item.key}
                onClick={() => setActiveKey(item.key)}
                className={`relative flex shrink-0 items-center gap-2 rounded-t-xl px-5 py-3 text-sm font-semibold transition-all ${
                  isActive
                    ? "border-b-2 border-nuwa-base bg-surface text-nuwa-base shadow-sm"
                    : "text-ink-muted hover:bg-surface/50 hover:text-ink"
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </div>

        {/* Action Header */}
        <div className="mt-6 flex items-center justify-between gap-4 rounded-2xl bg-surface p-4 shadow-sm border border-stroke">
          <div>
            <h2 className="text-lg font-bold text-ink">{section.label}</h2>
            <p className="text-xs text-ink-muted">
              استعراض وتحديث بيانات القسم
            </p>
          </div>

          <div className="flex items-center gap-2">
            {activeKey === "notifications" && (
              <button
                onClick={() => void handleMarkRead()}
                disabled={actionLoading === "read-all"}
                className="flex items-center gap-1.5 rounded-lg border border-stroke bg-canvas px-3 py-2 text-xs font-semibold text-ink transition-all hover:bg-surface active:scale-95 disabled:opacity-50"
              >
                قراءة الكل
              </button>
            )}
            <button
              onClick={() => setReloadKey((key) => key + 1)}
              className="flex items-center gap-1.5 rounded-lg bg-nuwa-base px-3.5 py-2 text-xs font-semibold text-white transition-all hover:bg-nuwa-deep active:scale-95"
            >
              <svg
                className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
              تحديث البيانات
            </button>
          </div>
        </div>

        {/* Data Cards Section */}
        <div className="mt-6">
          <ApiQueryState
            loading={loading}
            error={error}
            isEmpty={Boolean(data && records.length === 0)}
            emptyMessage="لا توجد بيانات متاحة لعرضها في هذا القسم حالياً."
            onRetry={() => setReloadKey((key) => key + 1)}
          >
            <div className="grid gap-4 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-2">
              {records.map((record, index) => {
                const id = formatValue("id", record.id);
                const title = formatValue(
                  "title",
                  record.title ??
                    record.fullName ??
                    record.name ??
                    record.email ??
                    `عنصر #${index + 1}`,
                );

                return (
                  <article
                    key={id === "—" ? index : id}
                    className="flex flex-col justify-between rounded-2xl border border-stroke bg-surface p-5 shadow-sm transition-all hover:shadow-md"
                  >
                    <div>
                      {/* Card Header */}
                      <div className="flex items-start justify-between gap-3 border-b border-stroke/60 pb-3">
                        <h3 className="font-bold text-ink sm:text-base">
                          {title}
                        </h3>
                        {id !== "—" && (
                          <span className="rounded-md bg-canvas px-2 py-1 font-mono text-[10px] text-ink-muted">
                            #{id.slice(-6)}
                          </span>
                        )}
                      </div>

                      {/* Card Key-Value Grid */}
                      <dl className="mt-4 grid grid-cols-1 gap-x-4 gap-y-3 text-xs sm:grid-cols-2">
                        {Object.entries(record)
                          .filter(
                            ([, value]) =>
                              value === null ||
                              ["string", "number", "boolean"].includes(
                                typeof value,
                              ),
                          )
                          .slice(0, 10)
                          .map(([key, value]) => {
                            const translatedKey = fieldLabels[key] || key;
                            const formatted = formatValue(key, value);

                            return (
                              <div
                                key={key}
                                className="rounded-lg bg-canvas/40 p-2.5"
                              >
                                <dt className="font-semibold text-ink-muted">
                                  {translatedKey}
                                </dt>
                                <dd className="mt-1 font-medium text-ink break-words">
                                  {formatted}
                                </dd>
                              </div>
                            );
                          })}
                      </dl>
                    </div>

                    {/* Card Actions */}
                    {activeKey === "enrollments" && id !== "—" && (
                      <div className="mt-5 flex items-center gap-2 border-t border-stroke/60 pt-4">
                        <button
                          onClick={() => void handleEnrollment(id, true)}
                          disabled={actionLoading === `${id}-approve`}
                          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-emerald-600 py-2 text-xs font-bold text-white transition-all hover:bg-emerald-700 active:scale-95 disabled:opacity-50"
                        >
                          موافقة
                        </button>
                        <button
                          onClick={() => void handleEnrollment(id, false)}
                          disabled={actionLoading === `${id}-reject`}
                          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-danger/30 bg-danger/10 py-2 text-xs font-bold text-danger transition-all hover:bg-danger/20 active:scale-95 disabled:opacity-50"
                        >
                          رفض
                        </button>
                      </div>
                    )}

                    {activeKey === "notifications" && id !== "—" && (
                      <div className="mt-4 border-t border-stroke/60 pt-3">
                        <button
                          onClick={() => void handleMarkRead(id)}
                          disabled={actionLoading === `read-${id}`}
                          className="text-xs font-semibold text-nuwa-base transition-colors hover:underline"
                        >
                          تحديد كمقروء ✓
                        </button>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          </ApiQueryState>
        </div>
      </main>
    </div>
  );
}
