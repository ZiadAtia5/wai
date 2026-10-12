import { useEffect, useMemo, useState, type FormEvent } from "react"
import {
  Bell,
  BookOpen,
  ClipboardList,
  GraduationCap,
  LayoutDashboard,
  Menu,
  Settings2,
  Users,
  X,
} from "lucide-react"

import { clearAuthToken } from "../api/client"

import {
  adminApi,
  enrollmentsApi,
  notificationsApi,
  studentsApi,
  subjectsApi,
  teachersApi,
  type PageQuery,
} from "../api/endpoints"

import ApiQueryState from "../components/ApiQueryState"

import { getAcademicYears, type AcademicYearResponse } from "../api/catalog"

import RoleForms from "../components/dashboard/RoleForms"
import { notifyError, notifySuccess } from "../utils/notifications"

import { useApiQuery } from "../hooks/useApiQuery"

import type { NavigateFn } from "../types"

interface Section {
  key: string

  label: string

  icon?: string

  load: () => Promise<unknown>
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
  isApproved: "حالة الاعتماد",
  registeredByTeacherName: "المعلم الذي استخدم الطالب كوده",
  teacherCode: "كود المعلم",
  teacherCodeUsed: "كود المعلم المستخدم",
  registrationCode: "كود التسجيل",
  referralCode: "كود الإحالة",

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
}

function getSections(role: string, query: PageQuery): Section[] {
  if (role.includes("admin")) {
    return [
      { key: "stats", label: "الإحصاءات", load: adminApi.stats },

      { key: "courses", label: "الدورات", load: () => adminApi.courses(query) },

      {
        key: "teachers",
        label: "المعلمون",
        load: () => adminApi.teachers(query),
      },

      {
        key: "students",
        label: "الطلاب",
        load: () => adminApi.students(query),
      },

      {
        key: "pending",
        label: "طلاب بانتظار الاعتماد",
        load: () => adminApi.pendingStudents(query),
      },

      {
        key: "subjects",
        label: "المواد الدراسية",
        load: () => subjectsApi.list(),
      },

      {
        key: "enrollments",

        label: "طلبات الالتحاق",

        load: () => enrollmentsApi.adminList(query),
      },
    ]
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

        load: () => teachersApi.coursesMine(query),
      },

      {
        key: "enrollments",

        label: "طلبات الالتحاق",

        load: () => teachersApi.enrollmentRequests(query),
      },
    ]
  }

  return [
    { key: "profile", label: "ملفي الشخصي", load: studentsApi.me },

    {
      key: "courses",

      label: "الدورات والاشتراكات",

      load: () => studentsApi.enrollments(query),
    },

    { key: "notifications", label: "الإشعارات", load: notificationsApi.list },
  ]
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function getRecords(data: unknown): Record<string, unknown>[] {
  if (Array.isArray(data)) return data.filter(isRecord)

  if (isRecord(data) && Array.isArray(data.items))
    return data.items.filter(isRecord)

  return isRecord(data) ? [data] : []
}

function cardFields(record: Record<string, unknown>) {
  return Object.entries(record).filter(
    ([key, value]) =>
      !/(^id$|id$|token|image|url|password)/i.test(key) &&
      value !== null &&
      ["string", "number", "boolean"].includes(typeof value),
  )
}

function studentDetailFields(record: Record<string, unknown>) {
  return Object.entries(record).filter(
    ([key, value]) =>
      !/(^id$|token|image|url|password)/i.test(key) &&
      value !== null &&
      (["string", "number", "boolean"].includes(typeof value) ||
        key === "academicYear"),
  )
}

function getStudentName(record: Record<string, unknown>) {
  const parts = [record.firstName, record.secondName, record.thirdName].filter(
    (part): part is string =>
      typeof part === "string" && part.trim().length > 0,
  )
  return String(record.fullName ?? (parts.join(" ") || record.name || "طالب"))
}

function StudentDetailsCard({
  record,
  academicYears,
}: {
  record: Record<string, unknown>
  academicYears: AcademicYearResponse[]
}) {
  const teacherName =
    record.teacherName ??
    record.registeredByTeacherName ??
    record.referralTeacherName
  const teacherCode =
    record.teacherCodeUsed ?? record.teacherCode ?? record.referralCode
  return (
    <details className="mt-4 rounded-xl border border-stroke bg-white">
      <summary className="cursor-pointer px-4 py-3 text-sm font-bold text-nuwa-base">
        عرض تفاصيل الطالب
      </summary>
      <dl className="grid gap-2 border-t border-stroke bg-canvas/50 p-4 sm:grid-cols-2">
        {studentDetailFields(record).map(([key, value]) => {
          const year =
            typeof value === "object" && value !== null
              ? value as Record<string, unknown>
              : null
          const namedYear = academicYears.find((item) => item.value === value)
          const shownValue =
            key === "academicYear"
              ? (year?.arabicName ??
                year?.name ??
                namedYear?.arabicName ??
                value)
              : value
          return (
            <div key={key} className="rounded-lg bg-white p-3">
              <dt className="text-xs font-semibold text-ink-muted">
                {fieldLabels[key] ?? key}
              </dt>
              <dd className="mt-1 break-words text-sm text-ink">
                <FormattedCardValue field={key} value={shownValue} />
              </dd>
            </div>
          )
        })}
      </dl>
      <div className="border-t border-stroke p-4">
        <h4 className="text-sm font-bold text-ink">
          المعلم المرتبط بكود التسجيل
        </h4>
        {teacherName ? (
          <p className="mt-1 text-sm text-ink-muted">
            {String(teacherName)}
            {teacherCode ? ` · كود ${String(teacherCode)}` : ""}
          </p>
        ) : (
          <p className="mt-1 text-sm leading-6 text-ink-muted">
            بيانات الـ API الحالية لا تتضمن كود المعلم الذي استخدمه الطالب عند
            التسجيل.
          </p>
        )}
      </div>
    </details>
  )
}

function formatValue(key: string, value: unknown): string {
  if (value === null || value === undefined || value === "") return "—"

  if (typeof value === "boolean") return value ? "نعم" : "لا"

  if (key.toLowerCase().includes("date") || key.toLowerCase().includes("at")) {
    const date = new Date(String(value))

    if (!isNaN(date.getTime())) {
      return date.toLocaleDateString("ar-EG", {
        year: "numeric",

        month: "short",

        day: "numeric",
      })
    }
  }

  if (typeof value === "object") return JSON.stringify(value)

  return String(value)
}

function FormattedCardValue({
  field,
  value,
}: {
  field: string
  value: unknown
}) {
  const formatted = formatValue(field, value)
  if (typeof value !== "string" || value.length <= 140) return formatted
  return (
    <>
      <span className="line-clamp-2">{formatted}</span>
      <details className="mt-2">
        <summary className="cursor-pointer text-xs font-semibold text-nuwa-base">
          قراءة النص كاملاً
        </summary>
        <p className="mt-2 whitespace-pre-line text-sm leading-6 text-ink-muted">
          {formatted}
        </p>
      </details>
    </>
  )
}

export default function DashboardPage({ navigate }: { navigate: NavigateFn }) {
  const role = window.sessionStorage.getItem("eduhub.auth.role") ?? "student"

  const [page, setPage] = useState(1)

  const [searchInput, setSearchInput] = useState("")

  const [search, setSearch] = useState("")

  const query: PageQuery = { page, pageSize: 12, ...(search ? { search } : {}) }

  const [activeKey, setActiveKey] = useState(
    () => getSections(role, query)[0].key,
  )

  const [reloadKey, setReloadKey] = useState(0)

  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  const [actionLoading, setActionLoading] = useState<string | null>(null)

  const [, setActionFeedbackState] = useState("")
  function setActionFeedback(message: string) {
    setActionFeedbackState(message)
    if (!message.trim()) return
    if (/تم|نجاح|اعتماد/.test(message)) notifySuccess(message)
    else notifyError(new Error(message), "تعذر إتمام العملية. حاول مرة أخرى.")
  }

  const [subjectName, setSubjectName] = useState("")

  const [subjectYear, setSubjectYear] = useState("1")

  const [subjectId, setSubjectId] = useState("")

  const [subjectIsActive, setSubjectIsActive] = useState(true)

  const [academicYears, setAcademicYears] = useState<AcademicYearResponse[]>([])

  const sections = useMemo(() => getSections(role, query), [role, page, search])

  const section = sections.find(({ key }) => key === activeKey) ?? sections[0]

  const { data, error, loading } = useApiQuery(section.load, reloadKey)

  const records = getRecords(data)

  const pagination =
    isRecord(data) && typeof data.totalPages === "number"
      ? { page: data.page, totalPages: data.totalPages }
      : null

  const showGenericRecords =
    !(
      role.includes("teacher") && ["overview", "courses"].includes(activeKey)
    ) &&
    !(
      !role.includes("admin") &&
      !role.includes("teacher") &&
      ["profile", "courses"].includes(activeKey)
    )

  const supportsSearch =
    (role.includes("admin") &&
      ["courses", "teachers", "students"].includes(activeKey)) ||
    (role.includes("teacher") && activeKey === "courses")

  useEffect(() => {
    if (!role.includes("admin")) return

    let active = true

    getAcademicYears()
      .then((years) => {
        if (active) setAcademicYears(years)
      })
      .catch(() => {
        if (active) setActionFeedback("تعذر تحميل الصفوف الدراسية من الخادم.")
      })

    return () => {
      active = false
    }
  }, [role])

  async function handleEnrollment(id: string, approve: boolean) {
    if (!approve && !window.confirm("هل تريد رفض طلب الالتحاق؟")) return

    setActionFeedback("")

    try {
      setActionLoading(`${id}-${approve ? "approve" : "reject"}`)

      if (role.includes("admin")) {
        await (approve
          ? enrollmentsApi.adminApprove(id)
          : enrollmentsApi.adminReject(id))
      } else {
        await (approve
          ? teachersApi.approveEnrollment(id)
          : teachersApi.rejectEnrollment(id))
      }

      setActionFeedback(approve ? "تمت الموافقة على الطلب." : "تم رفض الطلب.")

      setReloadKey((key) => key + 1)
    } catch (cause) {
      setActionFeedback(
        cause instanceof Error ? cause.message : "تعذر تحديث الطلب.",
      )
    } finally {
      setActionLoading(null)
    }
  }

  async function handleMarkRead(id?: string) {
    setActionFeedback("")

    try {
      setActionLoading(id ? `read-${id}` : "read-all")

      if (id) await notificationsApi.markRead(id)
      else await notificationsApi.markAllRead()

      setActionFeedback("تم تحديث حالة الإشعارات.")

      setReloadKey((key) => key + 1)
    } catch (cause) {
      setActionFeedback(
        cause instanceof Error ? cause.message : "تعذر تحديث الإشعارات.",
      )
    } finally {
      setActionLoading(null)
    }
  }

  async function handlePendingStudent(id: string, approve: boolean) {
    if (
      !approve &&
      !window.confirm("سيتم رفض طلب الطالب وحذفه. هل تريد المتابعة؟")
    )
      return

    setActionFeedback("")

    setActionLoading(`${id}-${approve ? "approve" : "reject"}`)

    try {
      if (approve) await adminApi.approveStudent(id)
      else await adminApi.rejectStudent(id)

      setActionFeedback(approve ? "تم اعتماد حساب الطالب." : "تم رفض الطلب.")

      setReloadKey((key) => key + 1)
    } catch (cause) {
      setActionFeedback(
        cause instanceof Error ? cause.message : "تعذر تحديث طلب الطالب.",
      )
    } finally {
      setActionLoading(null)
    }
  }

  async function handleCoursePublish(id: string, publish: boolean) {
    setActionFeedback("")

    setActionLoading(`${id}-publish`)

    try {
      if (role.includes("admin")) {
        if (publish) await adminApi.publishCourse(id)
        else await adminApi.unpublishCourse(id)
      } else {
        if (publish) await teachersApi.publishCourse(id)
        else await teachersApi.unpublishCourse(id)
      }

      setActionFeedback(publish ? "تم نشر الدورة." : "تم إلغاء نشر الدورة.")

      setReloadKey((key) => key + 1)
    } catch (cause) {
      setActionFeedback(
        cause instanceof Error ? cause.message : "تعذر تحديث حالة الدورة.",
      )
    } finally {
      setActionLoading(null)
    }
  }

  async function handleSubjectSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const form = new FormData(event.currentTarget)

    const currentSubjectId = String(form.get("subjectId") ?? "")

    const body = {
      name: String(form.get("name") ?? "").trim(),

      academicYear: Number(form.get("academicYear")),

      isActive: form.get("isActive") === "on",
    }

    if (!body.name || !Number.isFinite(body.academicYear)) return

    setActionLoading("subject-save")

    setActionFeedback("")

    try {
      if (currentSubjectId) await adminApi.updateSubject(currentSubjectId, body)
      else await adminApi.createSubject(body)

      setSubjectName("")

      setSubjectId("")

      setSubjectIsActive(true)

      setActionFeedback(
        currentSubjectId ? "تم تحديث المادة." : "تمت إضافة المادة.",
      )

      setReloadKey((key) => key + 1)
    } catch (cause) {
      setActionFeedback(
        cause instanceof Error ? cause.message : "تعذر حفظ المادة.",
      )
    } finally {
      setActionLoading(null)
    }
  }

  async function handleSubjectDelete(id: string) {
    if (!window.confirm("هل تريد حذف هذه المادة؟")) return

    setActionLoading(`${id}-delete`)

    setActionFeedback("")

    try {
      await adminApi.deleteSubject(id)

      setActionFeedback("تم حذف المادة.")

      setReloadKey((key) => key + 1)
    } catch (cause) {
      setActionFeedback(
        cause instanceof Error ? cause.message : "تعذر حذف المادة.",
      )
    } finally {
      setActionLoading(null)
    }
  }

  function signOut() {
    clearAuthToken()

    window.sessionStorage.removeItem("eduhub.auth.role")

    navigate("landing")
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
        }

  const sectionLabels: Record<string, string> = {
    stats: "الإحصائيات",
    overview: "نظرة عامة",
    profile: "ملفي الشخصي",
    courses: role.includes("teacher")
      ? "دوراتي"
      : role.includes("admin")
        ? "الدورات"
        : "دوراتي واشتراكاتي",
    teachers: "المعلمون",
    students: "الطلاب",
    pending: "طلاب بانتظار الاعتماد",
    subjects: "المواد الدراسية",
    enrollments: "طلبات الالتحاق",
    notifications: "الإشعارات",
  }

  return (
    <div className="min-h-screen bg-canvas pb-16 dir-rtl">
      {/* Top Header Navigation */}
      <header className="sticky top-0 z-10 border-b border-stroke bg-surface/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <button
            type="button"
            onClick={() => setMobileNavOpen(true)}
            className="grid size-10 place-items-center rounded-xl border border-stroke text-ink-muted hover:bg-canvas lg:hidden"
            aria-label="فتح القائمة"
          >
            <Menu size={19} />
          </button>
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
      <div className="flex min-h-[calc(100vh-72px)]">
        {mobileNavOpen && (
          <button
            type="button"
            aria-label="إغلاق القائمة"
            onClick={() => setMobileNavOpen(false)}
            className="fixed inset-0 z-40 bg-slate-950/40 lg:hidden"
          />
        )}
        <aside
          className={`fixed inset-y-0 right-0 z-50 w-[min(84vw,300px)] border-l border-stroke bg-white p-4 shadow-2xl transition-transform duration-200 lg:sticky lg:top-[72px] lg:z-10 lg:h-[calc(100vh-72px)] lg:w-64 lg:shrink-0 lg:translate-x-0 lg:shadow-none ${
            mobileNavOpen
              ? "translate-x-0"
              : "translate-x-full lg:translate-x-0"
          }`}
        >
          <div className="mb-5 flex items-center justify-between lg:hidden">
            <span className="font-bold text-ink">القائمة الرئيسية</span>
            <button
              type="button"
              onClick={() => setMobileNavOpen(false)}
              className="grid size-9 place-items-center rounded-lg hover:bg-canvas"
              aria-label="إغلاق القائمة"
            >
              <X size={18} />
            </button>
          </div>
          <div className="mb-5 rounded-2xl bg-gradient-to-l from-nuwa-deep to-nuwa-base p-4 text-white">
            <p className="text-xs text-white/70">مساحة العمل</p>
            <p className="mt-1 font-bold">{roleBadge.title}</p>
            <span className="mt-3 inline-flex rounded-full bg-white/15 px-2.5 py-1 text-xs">
              {roleBadge.badge}
            </span>
          </div>
          <p className="mb-2 px-3 text-[11px] font-bold text-slate-400">
            القائمة الرئيسية
          </p>
          <nav className="grid gap-1" aria-label="أقسام لوحة التحكم">
            {sections.map((item) => {
              const isActive = activeKey === item.key
              const iconMap: Record<string, typeof LayoutDashboard> = {
                stats: LayoutDashboard,
                overview: LayoutDashboard,
                profile: GraduationCap,
                courses: BookOpen,
                teachers: Users,
                students: GraduationCap,
                pending: ClipboardList,
                subjects: BookOpen,
                enrollments: ClipboardList,
                notifications: Bell,
              }
              const Icon = iconMap[item.key] ?? Settings2
              return (
                <button
                  key={item.key}
                  onClick={() => {
                    setActiveKey(item.key)
                    setPage(1)
                    setSearch("")
                    setSearchInput("")
                    setMobileNavOpen(false)
                  }}
                  aria-current={isActive ? "page" : undefined}
                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-start text-sm font-semibold transition ${
                    isActive
                      ? "bg-nuwa-soft text-nuwa-base"
                      : "text-slate-600 hover:bg-slate-50 hover:text-ink"
                  }`}
                >
                  <Icon size={18} />
                  <span className="min-w-0 flex-1">
                    {sectionLabels[item.key] ?? item.label}
                  </span>
                  {isActive && (
                    <span className="size-1.5 rounded-full bg-nuwa-base" />
                  )}
                </button>
              )
            })}
          </nav>
          <button
            onClick={() => navigate("landing")}
            className="mt-6 flex w-full items-center gap-3 border-t border-slate-100 px-3 pt-5 text-sm font-semibold text-slate-500 hover:text-nuwa-base"
          >
            <GraduationCap size={18} />
            العودة للمنصة
          </button>
        </aside>
        <main className="min-w-0 flex-1 px-4 pt-6 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            {/* Navigation Tabs */}
            <div className="no-scrollbar flex gap-2 overflow-x-auto border-b border-stroke pb-px lg:hidden">
              {sections.map((item) => {
                const isActive = activeKey === item.key

                return (
                  <button
                    key={item.key}
                    onClick={() => {
                      setActiveKey(item.key)
                      setPage(1)
                      setSearch("")
                      setSearchInput("")
                    }}
                    className={`relative flex shrink-0 items-center gap-2 rounded-t-xl px-5 py-3 text-sm font-semibold transition-all ${
                      isActive
                        ? "border-b-2 border-nuwa-base bg-surface text-nuwa-base shadow-sm"
                        : "text-ink-muted hover:bg-surface/50 hover:text-ink"
                    }`}
                  >
                    {item.label}
                  </button>
                )
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

            {supportsSearch && (
              <form
                onSubmit={(event) => {
                  event.preventDefault()

                  setPage(1)

                  setSearch(searchInput.trim())
                }}
                className="mt-5 flex flex-wrap gap-2 rounded-xl border border-stroke bg-surface p-3"
              >
                <label className="sr-only" htmlFor="dashboard-search">
                  البحث في {section.label}
                </label>
                <input
                  id="dashboard-search"
                  value={searchInput}
                  onChange={(event) => setSearchInput(event.target.value)}
                  placeholder={`ابحث في ${section.label}`}
                  className="h-10 min-w-0 flex-1 rounded-lg border border-stroke px-3 text-sm text-ink"
                />
                <button className="h-10 rounded-lg bg-nuwa-base px-4 text-sm font-semibold text-white">
                  بحث
                </button>
                {search && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchInput("")
                      setSearch("")
                      setPage(1)
                    }}
                    className="h-10 rounded-lg border border-stroke px-4 text-sm text-ink"
                  >
                    مسح البحث
                  </button>
                )}
              </form>
            )}

            {/* Data Cards Section */}
            <div className="mt-6">
              <RoleForms
                role={role}
                section={activeKey}
                data={data}
                onSaved={() => setReloadKey((key) => key + 1)}
                onFeedback={setActionFeedback}
              />
              {role.includes("admin") && activeKey === "subjects" && (
                <form
                  onSubmit={handleSubjectSubmit}
                  className="mb-5 grid gap-3 rounded-xl border border-stroke bg-surface p-4 sm:grid-cols-[1fr_180px_auto_auto] sm:items-end"
                >
                  <input
                    name="subjectId"
                    type="hidden"
                    value={subjectId}
                    readOnly
                  />
                  <label className="grid gap-1 text-xs font-semibold text-ink-muted">
                    اسم المادة
                    <input
                      name="name"
                      required
                      value={subjectName}
                      onChange={(event) => setSubjectName(event.target.value)}
                      className="h-10 rounded-lg border border-stroke px-3 text-sm text-ink"
                      placeholder="مثال: الرياضيات"
                    />
                  </label>
                  <label className="grid gap-1 text-xs font-semibold text-ink-muted">
                    الصف الدراسي
                    <select
                      name="academicYear"
                      value={subjectYear}
                      onChange={(event) => setSubjectYear(event.target.value)}
                      required
                      className="h-10 rounded-lg border border-stroke bg-white px-3 text-sm text-ink"
                    >
                      {academicYears.map((year) => (
                        <option key={year.id} value={year.value}>
                          {year.arabicName}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex h-10 items-center gap-2 text-sm text-ink">
                    <input
                      type="checkbox"
                      name="isActive"
                      checked={subjectIsActive}
                      onChange={(event) =>
                        setSubjectIsActive(event.target.checked)
                      }
                    />{" "}
                    فعّالة
                  </label>
                  <div className="flex gap-2">
                    {subjectId && (
                      <button
                        type="button"
                        onClick={() => {
                          setSubjectId("")
                          setSubjectName("")
                          setSubjectIsActive(true)
                        }}
                        className="h-10 rounded-lg border border-stroke px-3 text-sm"
                      >
                        إلغاء
                      </button>
                    )}
                    <button
                      disabled={
                        actionLoading === "subject-save" ||
                        !academicYears.length
                      }
                      className="h-10 rounded-lg bg-nuwa-base px-4 text-sm font-semibold text-white disabled:opacity-50"
                    >
                      {subjectId ? "حفظ التعديل" : "إضافة مادة"}
                    </button>
                  </div>
                </form>
              )}
              <ApiQueryState
                loading={loading}
                error={error}
                isEmpty={Boolean(data && records.length === 0)}
                emptyMessage="لا توجد بيانات متاحة لعرضها في هذا القسم حالياً."
                onRetry={() => setReloadKey((key) => key + 1)}
              >
                {showGenericRecords && (
                  <div className="grid gap-4 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-2">
                    {records.map((record, index) => {
                      const id = formatValue("id", record.id)

                      const title = formatValue(
                        "title",

                        record.title ??
                          record.fullName ??
                          record.name ??
                          record.email ??
                          `عنصر #${index + 1}`,
                      )

                      return (
                        <article
                          key={id === "—" ? index : id}
                          className="flex flex-col justify-between rounded-2xl border border-stroke bg-surface p-5 shadow-sm transition-all hover:shadow-md"
                        >
                          <div>
                            {/* Card Header */}
                            <div className="flex items-start justify-between gap-3 border-b border-stroke/60 pb-3">
                              <h3 className="font-bold text-ink sm:text-base">
                                {activeKey === "students"
                                  ? getStudentName(record)
                                  : title}
                              </h3>
                              {activeKey !== "students" && id !== "—" && (
                                <span className="rounded-md bg-canvas px-2 py-1 font-mono text-[10px] text-ink-muted">
                                  #{id.slice(-6)}
                                </span>
                              )}
                            </div>

                            {/* Card Key-Value Grid */}
                            <dl
                              className={`mt-4 grid grid-cols-1 gap-x-4 gap-y-3 text-xs sm:grid-cols-2 ${
                                activeKey === "students" ? "hidden" : ""
                              }`}
                            >
                              {cardFields(record)
                                .slice(0, 4)

                                .map(([key, value]) => {
                                  const translatedKey = fieldLabels[key] || key

                                  return (
                                    <div
                                      key={key}
                                      className="rounded-lg bg-canvas/40 p-2.5"
                                    >
                                      <dt className="font-semibold text-ink-muted">
                                        {translatedKey}
                                      </dt>
                                      <dd className="mt-1 font-medium text-ink break-words">
                                        <FormattedCardValue
                                          field={key}
                                          value={value}
                                        />
                                      </dd>
                                    </div>
                                  )
                                })}
                            </dl>
                            {activeKey === "students" ? (
                              <StudentDetailsCard
                                record={record}
                                academicYears={academicYears}
                              />
                            ) : (
                              cardFields(record).length > 4 && (
                                <details className="mt-3 rounded-xl border border-slate-200 bg-white">
                                  <summary className="cursor-pointer px-3 py-2.5 text-xs font-bold text-nuwa-base">
                                    عرض تفاصيل أكثر (
                                    {cardFields(record).length - 4})
                                  </summary>
                                  <dl className="grid gap-2 border-t border-slate-100 p-3 sm:grid-cols-2">
                                    {cardFields(record)
                                      .slice(4)
                                      .map(([key, value]) => (
                                        <div
                                          key={key}
                                          className="rounded-lg bg-canvas p-2.5"
                                        >
                                          <dt className="text-xs font-semibold text-ink-muted">
                                            {fieldLabels[key] || key}
                                          </dt>
                                          <dd className="mt-1 break-words text-sm text-ink">
                                            <FormattedCardValue
                                              field={key}
                                              value={value}
                                            />
                                          </dd>
                                        </div>
                                      ))}
                                  </dl>
                                </details>
                              )
                            )}
                          </div>

                          {/* Card Actions */}
                          {(activeKey === "enrollments" ||
                            activeKey === "pending") &&
                            id !== "—" && (
                              <div className="mt-5 flex items-center gap-2 border-t border-stroke/60 pt-4">
                                <button
                                  onClick={() =>
                                    activeKey === "pending"
                                      ? void handlePendingStudent(id, true)
                                      : void handleEnrollment(id, true)
                                  }
                                  disabled={actionLoading === `${id}-approve`}
                                  className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-emerald-600 py-2 text-xs font-bold text-white transition-all hover:bg-emerald-700 active:scale-95 disabled:opacity-50"
                                >
                                  {activeKey === "pending"
                                    ? "اعتماد الطالب"
                                    : "موافقة"}
                                </button>
                                <button
                                  onClick={() =>
                                    activeKey === "pending"
                                      ? void handlePendingStudent(id, false)
                                      : void handleEnrollment(id, false)
                                  }
                                  disabled={actionLoading === `${id}-reject`}
                                  className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-danger/30 bg-danger/10 py-2 text-xs font-bold text-danger transition-all hover:bg-danger/20 active:scale-95 disabled:opacity-50"
                                >
                                  رفض
                                </button>
                              </div>
                            )}

                          {activeKey === "courses" &&
                            (role.includes("admin") ||
                              role.includes("teacher")) &&
                            id !== "—" && (
                              <div className="mt-4 flex gap-2 border-t border-stroke/60 pt-3">
                                <button
                                  type="button"
                                  onClick={() =>
                                    void handleCoursePublish(id, true)
                                  }
                                  disabled={actionLoading === `${id}-publish`}
                                  className="rounded-lg bg-nuwa-base px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
                                >
                                  نشر الدورة
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    void handleCoursePublish(id, false)
                                  }
                                  disabled={actionLoading === `${id}-publish`}
                                  className="rounded-lg border border-stroke px-3 py-2 text-xs font-semibold text-ink disabled:opacity-50"
                                >
                                  إلغاء النشر
                                </button>
                              </div>
                            )}

                          {activeKey === "subjects" &&
                            role.includes("admin") &&
                            id !== "—" && (
                              <div className="mt-4 flex gap-2 border-t border-stroke/60 pt-3">
                                <button
                                  type="button"
                                  onClick={() => {
                                    const year = record.academicYear

                                    const yearValue =
                                      typeof year === "object" && year !== null
                                        ? ((year as Record<string, unknown>)
                                            .value ??
                                          (year as Record<string, unknown>).id)
                                        : year

                                    setSubjectId(id)

                                    setSubjectName(String(record.name ?? ""))

                                    setSubjectYear(
                                      String(
                                        yearValue ??
                                          academicYears[0]?.value ??
                                          "1",
                                      ),
                                    )

                                    setSubjectIsActive(
                                      record.isActive !== false,
                                    )
                                  }}
                                  className="rounded-lg border border-stroke px-3 py-2 text-xs font-semibold text-ink"
                                >
                                  تعديل
                                </button>
                                <button
                                  type="button"
                                  onClick={() => void handleSubjectDelete(id)}
                                  disabled={actionLoading === `${id}-delete`}
                                  className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-xs font-semibold text-danger disabled:opacity-50"
                                >
                                  حذف المادة
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
                      )
                    })}
                  </div>
                )}
              </ApiQueryState>
              {pagination && pagination.totalPages > 1 && (
                <nav
                  aria-label="صفحات النتائج"
                  className="mt-5 flex items-center justify-between rounded-xl border border-stroke bg-surface p-3"
                >
                  <button
                    type="button"
                    disabled={page <= 1 || loading}
                    onClick={() => setPage((value) => Math.max(1, value - 1))}
                    className="rounded-lg border border-stroke px-4 py-2 text-sm disabled:opacity-40"
                  >
                    السابق
                  </button>
                  <span className="text-sm text-ink-muted">
                    صفحة {String(pagination.page ?? page)} من{" "}
                    {String(pagination.totalPages)}
                  </span>
                  <button
                    type="button"
                    disabled={page >= pagination.totalPages || loading}
                    onClick={() => setPage((value) => value + 1)}
                    className="rounded-lg border border-stroke px-4 py-2 text-sm disabled:opacity-40"
                  >
                    التالي
                  </button>
                </nav>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
