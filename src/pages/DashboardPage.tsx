import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";

import {
  ArrowUpLeft,
  Bell,
  BookOpen,
  BookOpenCheck,
  CheckCircle2,
  Clock3,
  ClipboardList,
  CircleUserRound,
  Trash2,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  Menu,
  RefreshCw,
  Settings2,
  ShieldCheck,
  UsersRound,
  Users,
  X,
} from "lucide-react";

import { domMax, LazyMotion, m } from "framer-motion";

import { ApiError, clearAuthToken } from "../api/client";
import { clearApiQueryCache } from "../hooks/useApiQuery";
import { clearPendingEnrollments } from "../utils/pendingEnrollments";
import { enrollmentStatus } from "../utils/courseEnrollments";

import {
  adminApi,
  enrollmentsApi,
  notificationsApi,
  studentsApi,
  subjectsApi,
  teachersApi,
  type PageQuery,
} from "../api/endpoints";

import ApiQueryState from "../components/ApiQueryState";

import { useConfirmation } from "../components/ConfirmationProvider";

import NuwaLogo from "../components/NuwaLogo";

import PlatformFooter from "../components/layout/PlatformFooter";

import PersonAvatar from "../components/PersonAvatar";

import { Skeleton, SkeletonIcon, SkeletonText } from "../components/Skeleton";

import {
  RecordGridSkeleton,
  StatGridSkeleton,
} from "../components/loading/SkeletonLayouts";

import { getAcademicYears, type AcademicYearResponse } from "../api/catalog";

import RoleForms from "../components/dashboard/RoleForms";

import CourseCard from "../components/CourseCard";

import CourseEnrollmentContactDialog from "../components/dashboard/CourseEnrollmentContactDialog";

import CoursePagination from "../components/CoursePagination";

import TeacherEnrollmentRequests from "../components/dashboard/TeacherEnrollmentRequests";

import MetricBarChart from "../components/dashboard/MetricBarChart";

import NotificationDialog from "../components/dashboard/NotificationDialog";

import AdminSubscriptions from "../components/dashboard/AdminSubscriptions";

import {
  AnimatedBar,
  AnimatedNumber,
} from "../components/dashboard/DashboardMotion";

import { mockTeacherEnrollmentRequests } from "../mocks/teacherEnrollmentRequests";

import { notifyError, notifySuccess } from "../utils/notifications";

import { useApiQuery } from "../hooks/useApiQuery";

import StudentDetailsCard, {
  fieldLabels,
  FormattedCardValue,
  formatValue,
} from "../components/dashboard/StudentDetailsCard";

import type { NavigateFn } from "../types";

interface Section {
  key: string;

  label: string;

  icon?: string;

  load: () => Promise<unknown>;
}

async function loadAllPagedCourses(
  load: (query: PageQuery) => Promise<unknown>,
  query: PageQuery,
): Promise<unknown> {
  const pageSize = 100;
  const firstPage = await load({ ...query, page: 1, pageSize });
  const firstResponse = unwrapApiResponse(firstPage);
  const paging =
    isRecord(firstResponse) && isRecord(firstResponse.pagination)
      ? firstResponse.pagination
      : firstResponse;
  const explicitPages = isRecord(paging)
    ? Number(paging.totalPages ?? paging.pageCount)
    : Number.NaN;
  const totalCount = isRecord(paging)
    ? Number(paging.totalCount ?? paging.totalItems)
    : Number.NaN;
  const responsePageSize =
    isRecord(paging) && Number.isFinite(Number(paging.pageSize))
      ? Number(paging.pageSize)
      : Number.NaN;
  const actualPageSize = responsePageSize > 0 ? responsePageSize : pageSize;
  const totalPages =
    Number.isInteger(explicitPages) && explicitPages > 0
      ? explicitPages
      : Number.isFinite(totalCount) && totalCount > 0
        ? Math.ceil(totalCount / actualPageSize)
        : 1;
  const remainingPages = await Promise.all(
    Array.from({ length: totalPages - 1 }, (_, index) =>
      load({ ...query, page: index + 2, pageSize }),
    ),
  );

  return {
    items: [firstPage, ...remainingPages].flatMap(getRecords),
  };
}

async function loadAllAdminTeachers(query: PageQuery): Promise<unknown> {
  return loadAllPagedCourses(adminApi.teachers, query);
}

function getSections(
  role: string,

  query: PageQuery,

  enrollmentPreview = false,
): Section[] {
  if (role.includes("admin")) {
    return [
      { key: "stats", label: "الإحصاءات", load: adminApi.stats },

      {
        key: "profile",

        label: "ملفي الشخصي",

        load: async () => {
          try {
            return await adminApi.me();
          } catch {
            return {
              name:
                window.sessionStorage.getItem("eduhub.auth.name") ||
                "مدير النظام",

              profileImageUrl:
                window.sessionStorage.getItem("eduhub.auth.image") || "",
            };
          }
        },
      },

      {
        key: "courses",
        label: "الدورات",
        load: () => loadAllPagedCourses(adminApi.courses, query),
      },

      {
        key: "teachers",

        label: "المعلمون",

        load: () => adminApi.teachers(query),
      },

      {
        key: "subscriptions",

        label: "تفاصيل الاشتراكات",

        load: () => loadAllAdminTeachers(query),
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

      { key: "notifications", label: "الإشعارات", load: notificationsApi.list },
    ];
  }

  if (role.includes("teacher")) {
    return [
      {
        key: "overview",

        label: "نظرة عامة",

        load: async () => {
          if (enrollmentPreview) {
            return {
              profile: { firstName: "Ahmed", lastName: "Hassan" },

              stats: { totalCourses: 4, totalStudents: 86, pendingRequests: 3 },
            };
          }

          const [profileResult, statsResult] = await Promise.allSettled([
            teachersApi.me(),

            teachersApi.stats(),
          ]);

          if (profileResult.status === "rejected") throw profileResult.reason;

          return {
            profile: profileResult.value,

            stats:
              statsResult.status === "fulfilled" ? statsResult.value : null,
          };
        },
      },

      { key: "profile", label: "ملفي الشخصي", load: teachersApi.me },

      {
        key: "students",

        label: "طلابي",

        load: async () => null,
      },

      {
        key: "courses",

        label: "دوراتي",

        load: () =>
          enrollmentPreview
            ? Promise.resolve({ items: [] })
            : loadAllPagedCourses(teachersApi.coursesMine, query),
      },

      {
        key: "student-progress",

        label: "تقدم الطلاب",

        load: async () => null,
      },

      {
        key: "enrollments",

        label: "طلبات الالتحاق",

        load: async () => {
          if (enrollmentPreview) {
            return { requests: mockTeacherEnrollmentRequests, courses: [] };
          }

          const [requestsResult, coursesResult] = await Promise.allSettled([
            teachersApi.enrollmentRequests(query),

            teachersApi.coursesMine({ page: 1, pageSize: 100 }),
          ]);

          if (requestsResult.status === "rejected") throw requestsResult.reason;

          return {
            requests: requestsResult.value,

            courses:
              coursesResult.status === "fulfilled" ? coursesResult.value : null,
          };
        },
      },

      { key: "notifications", label: "الإشعارات", load: notificationsApi.list },
    ];
  }

  return [
    {
      key: "overview",

      label: "نظرة عامة",

      load: async () => {
        const [profileResult, enrollmentsResult] = await Promise.allSettled([
          studentsApi.me(),

          studentsApi.enrollments({ page: 1, pageSize: 4 }),
        ]);

        if (profileResult.status === "rejected") throw profileResult.reason;

        return {
          profile: unwrapApiResponse(profileResult.value),

          enrollments:
            enrollmentsResult.status === "fulfilled"
              ? unwrapApiResponse(enrollmentsResult.value)
              : [],

          enrollmentsError:
            enrollmentsResult.status === "rejected"
              ? enrollmentsResult.reason instanceof Error
                ? enrollmentsResult.reason.message
                : "تعذر تحميل دوراتك حاليًا."
              : null,
        };
      },
    },

    { key: "profile", label: "ملفي الشخصي", load: studentsApi.me },

    {
      key: "courses",

      label: "الدورات والاشتراكات",

      load: () => studentsApi.enrollments(query),
    },

    { key: "notifications", label: "الإشعارات", load: notificationsApi.list },
  ];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function unwrapApiResponse(value: unknown): unknown {
  let current = value;

  for (let depth = 0; depth < 5; depth += 1) {
    const response = current;

    if (!isRecord(response)) break;

    const keys = Object.keys(response);

    const isEnvelope =
      "data" in response &&
      (keys.length <= 3 ||
        ["success", "message", "status", "errors", "meta"].some(
          (key) => key in response,
        ));

    if (!isEnvelope) break;

    current = response.data;
  }

  return current;
}

function profileDisplayName(value: unknown): string | null {
  value = unwrapApiResponse(value);

  if (!isRecord(value)) return null;

  const candidates: unknown[] = [value];

  const visited = new Set<object>();

  while (candidates.length && visited.size < 8) {
    const candidate = candidates.shift();

    if (!isRecord(candidate) || visited.has(candidate)) continue;

    visited.add(candidate);

    candidates.push(
      candidate.profile,

      candidate.data,

      candidate.user,

      candidate.teacher,

      candidate.student,
    );
  }

  for (const candidate of visited) {
    if (!isRecord(candidate)) continue;

    const direct =
      candidate.fullName ?? candidate.displayName ?? candidate.name;

    if (typeof direct === "string" && direct.trim()) return direct.trim();

    const parts = [
      candidate.firstName,

      candidate.secondName,

      candidate.thirdName,

      candidate.lastName,
    ].filter(
      (part): part is string =>
        typeof part === "string" && part.trim().length > 0,
    );

    if (parts.length) return parts.join(" ");
  }

  return null;
}

function profileDisplayImage(value: unknown): string | null {
  if (!isRecord(value)) return null;

  const candidates: unknown[] = [value];

  const visited = new Set<object>();

  while (candidates.length && visited.size < 8) {
    const candidate = candidates.shift();

    if (!isRecord(candidate) || visited.has(candidate)) continue;

    visited.add(candidate);

    candidates.push(
      candidate.profile,

      candidate.data,

      candidate.user,

      candidate.teacher,

      candidate.student,
    );
  }

  for (const candidate of visited) {
    if (!isRecord(candidate)) continue;

    const avatar = isRecord(candidate.avatar) ? candidate.avatar : {};

    const image =
      candidate.avatarUrl ??
      candidate.avatar_url ??
      candidate.profileImageUrl ??
      candidate.profile_image_url ??
      candidate.profileImage ??
      candidate.profile_image ??
      candidate.profilePictureUrl ??
      candidate.imageUrl ??
      candidate.image_url ??
      avatar.url ??
      (typeof candidate.avatar === "string" ? candidate.avatar : undefined);

    if (typeof image === "string" && image.trim()) return image.trim();
  }

  return null;
}

function getRecords(data: unknown): Record<string, unknown>[] {
  data = unwrapApiResponse(data);

  if (Array.isArray(data)) return data.filter(isRecord);

  if (isRecord(data)) {
    for (const key of [
      "items",

      "notifications",

      "records",

      "students",

      "teachers",

      "courses",

      "enrollments",

      "requests",
    ]) {
      if (Array.isArray(data[key]))
        return (data[key] as unknown[]).filter(isRecord);
    }
  }

  return isRecord(data) ? [data] : [];
}

type CoursePublicationState = "published" | "unpublished" | "draft";

function getCoursePublicationState(
  course: Record<string, unknown>,
): CoursePublicationState {
  // Prefer an explicit publication flag over a generic status field.

  for (const key of ["isPublished", "published", "is_published"]) {
    const value = course[key];

    const normalizedValue =
      typeof value === "string" ? value.trim().toLowerCase() : value;

    if (
      normalizedValue === true ||
      normalizedValue === 1 ||
      normalizedValue === "1" ||
      normalizedValue === "true"
    )
      return "published";

    if (
      normalizedValue === false ||
      normalizedValue === 0 ||
      normalizedValue === "0" ||
      normalizedValue === "false"
    )
      return "unpublished";
  }

  for (const key of ["isDraft", "is_draft"]) {
    const value = course[key];

    if (value === true || value === 1 || value === "1" || value === "true")
      return "draft";
  }

  const status = String(
    course.publicationStatus ??
      course.publishStatus ??
      course.publication_status ??
      course.publish_status ??
      course.status ??
      course.state ??
      "",
  ).toLowerCase();

  // CourseStatus is an integer enum from the API: Draft=0 and Published=1.

  if (status === "1") return "published";

  if (status === "0") return "draft";

  if (status === "2") return "unpublished";

  if (/draft|مسودة/.test(status)) return "draft";

  if (/unpublish|not.?publish|غير.?منشور/.test(status)) return "unpublished";

  if (/publish|منشور/.test(status)) return "published";

  return "unpublished";
}

function isUnreadNotification(notification: Record<string, unknown>): boolean {
  if (typeof notification.isUnread === "boolean") return notification.isUnread;

  if (typeof notification.isRead === "boolean") return !notification.isRead;

  if (typeof notification.is_read === "boolean") return !notification.is_read;

  if (typeof notification.read === "boolean") return !notification.read;

  const status = String(
    notification.readStatus ?? notification.status ?? "",
  ).toLowerCase();

  if (/unread|new|غير مقروء/.test(status)) return true;

  if (/^read$|مقروء/.test(status)) return false;

  if (notification.read_at !== undefined) return notification.read_at == null;

  if (notification.readAt !== undefined) return notification.readAt == null;

  return notification.readAt === null;
}

function getNotificationRecords(data: unknown): Record<string, unknown>[] {
  const payload = unwrapApiResponse(data);

  if (Array.isArray(payload)) return payload.filter(isRecord);

  if (!isRecord(payload)) return [];

  for (const key of ["items", "notifications", "records"]) {
    if (Array.isArray(payload[key]))
      return (payload[key] as unknown[]).filter(isRecord);
  }

  return payload.id !== undefined || payload.notificationId !== undefined
    ? [payload]
    : [];
}

function getEnrollmentRecords(data: unknown): Record<string, unknown>[] {
  data = unwrapApiResponse(data);

  if (Array.isArray(data))
    return data.filter(
      (enrollment): enrollment is Record<string, unknown> =>
        isRecord(enrollment) &&
        !isRejectedEnrollment(
          enrollment.status ?? enrollment.enrollmentStatus,

          enrollment.isRejected,
        ),
    );

  if (!isRecord(data)) return [];

  if (Array.isArray(data.items))
    return data.items.filter(
      (enrollment): enrollment is Record<string, unknown> =>
        isRecord(enrollment) &&
        !isRejectedEnrollment(
          enrollment.status ?? enrollment.enrollmentStatus,

          enrollment.isRejected,
        ),
    );

  if ("enrollments" in data) return getEnrollmentRecords(data.enrollments);

  return [];
}

function isRejectedEnrollment(status: unknown, isRejected?: unknown): boolean {
  return (
    isRejected === true ||
    String(status ?? "").trim() === "2" ||
    /reject|declin|cancel/i.test(String(status ?? ""))
  );
}

function enrollmentProgressPercent(
  enrollment: Record<string, unknown>,
): number | null {
  const nestedProgress = isRecord(enrollment.progress)
    ? enrollment.progress
    : {};

  const rawValue =
    enrollment.progressPercentage ??
    enrollment.progressPercent ??
    enrollment.completionPercentage ??
    nestedProgress.progressPercentage ??
    nestedProgress.percentage;

  if (rawValue === undefined || rawValue === null || rawValue === "")
    return null;

  const value = Number(rawValue);

  return Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : null;
}

function enrollmentStatusLabel(status: unknown, isApproved?: unknown): string {
  const value = String(status ?? "").toLowerCase();

  if (value === "0" || isApproved === false) return "بانتظار الموافقة";

  if (value === "2") return "غير نشط";

  if (value === "3") return "مكتملة";

  if (value === "1" || isApproved === true) return "مشترك";

  if (/reject|declin|cancel/.test(value)) return "غير نشط";

  if (/pending|await|review/.test(value)) return "بانتظار الموافقة";

  if (/complete|finish/.test(value)) return "مكتملة";

  if (/approv|active|accept|enroll/.test(value)) return "مشترك";

  return status ? String(status) : "الحالة غير محددة";
}

function getAdminMetrics(data: unknown) {
  if (!isRecord(data)) return [];

  type MetricEntry = {
    key: string;

    value: number;

    parent: string;
  };

  const entries: MetricEntry[] = [];

  function collect(record: Record<string, unknown>, parent = "", depth = 0) {
    if (depth > 3) return;

    Object.entries(record).forEach(([key, value]) => {
      if (
        typeof value === "number" &&
        Number.isFinite(value) &&
        !/(^id$|token|password|price|duration|date|time)/i.test(key)
      ) {
        entries.push({ key, value, parent });
      } else if (isRecord(value)) {
        collect(value, key, depth + 1);
      }
    });
  }

  collect(data);

  const metrics = entries.map(({ key, value, parent }) => {
    const statKey = `${parent} ${key}`.toLowerCase();

    const isPending = /pending|await|unapproved/.test(statKey);

    const label = isPending
      ? /enroll|request/.test(statKey)
        ? "طلبات التحاق قيد المراجعة"
        : "طلاب بانتظار الاعتماد"
      : /student/.test(statKey)
        ? "إجمالي الطلاب"
        : /teacher/.test(statKey)
          ? "إجمالي المعلمين"
          : /course/.test(statKey)
            ? "إجمالي الدورات"
            : /enroll|request/.test(statKey)
              ? "طلبات الالتحاق"
              : /subject/.test(statKey)
                ? "المواد الدراسية"
                : `${parent ? `${parent} · ` : ""}${fieldLabels[key] ?? key}`;

    const Icon = isPending
      ? ClipboardList
      : /student|teacher/.test(statKey)
        ? UsersRound
        : /course|subject/.test(statKey)
          ? BookOpenCheck
          : BookOpen;

    return { key: `${parent}-${key}`, label, value, Icon };
  });

  return metrics.slice(0, 6);
}

function cardFields(record: Record<string, unknown>) {
  return Object.entries(record).filter(
    ([key, value]) =>
      !/(^id$|id$|token|image|url|password)/i.test(key) &&
      value !== null &&
      ["string", "number", "boolean"].includes(typeof value),
  );
}

function getStudentName(record: Record<string, unknown>) {
  const parts = [record.firstName, record.secondName, record.thirdName].filter(
    (part): part is string =>
      typeof part === "string" && part.trim().length > 0,
  );

  return String(record.fullName ?? (parts.join(" ") || record.name || "طالب"));
}

function DashboardOverviewSkeleton({ student = false }: { student?: boolean }) {
  return (
    <section
      aria-busy="true"
      aria-label="جارٍ تحميل النظرة العامة"
      className="mb-5 overflow-hidden rounded-2xl border border-stroke bg-white shadow-nuwa"
    >
      <div className="bg-gradient-to-l from-nuwa-deep to-nuwa-base px-5 py-6 sm:px-7">
        <Skeleton className="h-6 w-36 rounded-full bg-white/20" />
        <Skeleton className="mt-4 h-8 w-2/3 max-w-lg bg-white/25" />
        <Skeleton className="mt-2 h-4 w-full max-w-xl bg-white/20" />
      </div>
      <div className="p-4 sm:p-6">
        <StatGridSkeleton count={student ? 3 : 4} />
        <div className="mt-5 rounded-2xl border border-stroke bg-white p-4 sm:p-6">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="mt-2 h-4 w-64 max-w-full" />
          <div className="mt-5 flex h-36 items-end gap-3 border-b border-stroke px-2">
            {["h-1/3", "h-2/3", "h-1/2", "h-2/3", "h-1/3", "h-1/2"].map(
              (height, item) => (
                <Skeleton
                  key={item}
                  className={`${height} min-h-8 flex-1 rounded-t-lg`}
                />
              ),
            )}
          </div>
        </div>
        {student && (
          <div className="mt-6">
            <Skeleton className="h-5 w-36" />
            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {[0, 1, 2].map((item) => (
                <div
                  key={item}
                  className="rounded-xl border border-stroke bg-white p-4"
                >
                  <Skeleton className="h-5 w-2/3" />
                  <Skeleton className="mt-3 h-4 w-1/2" />
                  <SkeletonText className="mt-4" lines={2} />
                  <Skeleton className="mt-4 h-2 w-full rounded-full" />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function AdminStatsSkeleton() {
  return (
    <section
      aria-busy="true"
      aria-label="جارٍ تحميل إحصاءات المنصة"
      className="mb-5 overflow-hidden rounded-2xl border border-stroke bg-white shadow-nuwa"
    >
      <div className="bg-gradient-to-l from-nuwa-deep to-nuwa-base px-5 py-6 sm:px-7">
        <Skeleton className="h-6 w-40 rounded-full bg-white/20" />
        <Skeleton className="mt-4 h-8 w-2/3 max-w-lg bg-white/25" />
        <Skeleton className="mt-2 h-4 w-full max-w-xl bg-white/20" />
      </div>
      <div className="p-4 sm:p-6">
        <StatGridSkeleton count={6} />
        <div className="mt-6 rounded-2xl border border-stroke bg-white p-4 sm:p-6">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="mt-2 h-4 w-64 max-w-full" />
          <div className="mt-5 flex h-36 items-end gap-3 border-b border-stroke px-2">
            {[0, 1, 2, 3, 4, 5].map((item) => (
              <Skeleton key={item} className="min-h-8 flex-1 rounded-t-lg" />
            ))}
          </div>
        </div>
        <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2, 3, 4, 5].map((item) => (
            <div
              key={item}
              className="flex items-center gap-3 rounded-xl border border-stroke p-3"
            >
              <SkeletonIcon />
              <div className="min-w-0 flex-1">
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="mt-2 h-3 w-full" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export default function DashboardPage({ navigate }: { navigate: NavigateFn }) {
  const confirm = useConfirmation();

  const useTeacherEnrollmentMock =
    import.meta.env.DEV &&
    new URLSearchParams(window.location.search).get("teacherEnrollmentMock") ===
      "1";

  const role = useTeacherEnrollmentMock
    ? "teacher"
    : (window.sessionStorage.getItem("eduhub.auth.role") ?? "student");

  const [page, setPage] = useState(1);

  const [searchInput, setSearchInput] = useState("");

  const [search, setSearch] = useState("");

  const [activeKey, setActiveKey] = useState(() =>
    (() => {
      const availableSections = getSections(
        role,

        { page: 1, pageSize: 12 },

        useTeacherEnrollmentMock,
      );

      const savedSection =
        window.history.state?.waiApp &&
        window.history.state.view === "dashboard"
          ? window.history.state.dashboardSection
          : null;

      if (
        typeof savedSection === "string" &&
        availableSections.some(({ key }) => key === savedSection)
      ) {
        return savedSection;
      }

      return useTeacherEnrollmentMock
        ? "enrollments"
        : availableSections[0].key;
    })(),
  );

  const query: PageQuery = {
    page:
      activeKey === "courses" &&
      (role.includes("admin") || role.includes("teacher"))
        ? 1
        : page,

    pageSize: activeKey === "courses" ? 3 : 12,

    ...(search ? { search } : {}),
  };

  const sidebarNavRef = useRef<HTMLElement | null>(null);

  const sidebarIndicatorRef = useRef<HTMLSpanElement | null>(null);

  const [sidebarIndicatorMotion, setSidebarIndicatorMotion] = useState<{
    y: number[];

    scaleY: number[];
  } | null>(null);

  useLayoutEffect(() => {
    const nav = sidebarNavRef.current;

    const activeItem = Array.from(
      nav?.querySelectorAll<HTMLButtonElement>("[data-sidebar-item]") ?? [],
    ).find((item) => item.dataset.sidebarItem === activeKey);

    if (!nav || !activeItem) return;

    const targetY = activeItem.offsetTop + (activeItem.offsetHeight - 40) / 2;

    const indicator = sidebarIndicatorRef.current;

    if (!indicator) {
      setSidebarIndicatorMotion({
        y: [targetY],

        scaleY: [1],
      });

      return;
    }

    const navTop = nav.getBoundingClientRect().top;

    const indicatorRect = indicator.getBoundingClientRect();

    const currentY = indicatorRect.top - navTop;

    const currentHeight = indicatorRect.height;

    if (
      Math.abs(targetY - currentY) < 0.5 &&
      Math.abs(currentHeight - 40) < 0.5
    ) {
      return;
    }

    if (targetY > currentY) {
      setSidebarIndicatorMotion({
        y: [currentY, currentY, targetY],

        scaleY: [currentHeight / 40, (targetY + 40 - currentY) / 40, 1],
      });
    } else {
      const stretchScale = (currentY + currentHeight - targetY) / 40;

      setSidebarIndicatorMotion({
        y: [currentY, targetY, targetY],

        scaleY: [currentHeight / 40, stretchScale, 1],
      });
    }
  }, [activeKey]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [activeKey]);

  const [reloadKey, setReloadKey] = useState(0);

  const [notificationReloadKey, setNotificationReloadKey] = useState(0);

  const [selectedNotification, setSelectedNotification] = useState<Record<
    string,
    unknown
  > | null>(null);

  const [pendingCourseDialog, setPendingCourseDialog] = useState<Record<
    string,
    unknown
  > | null>(null);

  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const [focusStudentCourseId, setFocusStudentCourseId] = useState<
    string | null
  >(null);

  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const [courseStatusFilter, setCourseStatusFilter] = useState<
    "all" | CoursePublicationState
  >("all");

  const [coursePublicationOverrides, setCoursePublicationOverrides] = useState<
    Record<string, CoursePublicationState>
  >({});

  const [coursePublicationRecords, setCoursePublicationRecords] = useState<
    Record<string, Record<string, unknown>>
  >({});

  const [approvedStudentIds, setApprovedStudentIds] = useState<Set<string>>(
    () => new Set(),
  );

  const [, setActionFeedbackState] = useState("");

  const setActionFeedback = useCallback((message: string) => {
    setActionFeedbackState(message);

    if (!message.trim()) return;

    if (/تم|نجاح|اعتماد/.test(message)) notifySuccess(message);
    else notifyError(new Error(message), "تعذر إتمام العملية. حاول مرة أخرى.");
  }, []);

  const reloadData = useCallback(() => {
    setReloadKey((key) => key + 1);
  }, []);

  const handleCourseEnrollmentCancelled = useCallback(() => {
    setPendingCourseDialog(null);
    reloadData();
  }, [reloadData]);

  const clearFocusedStudentCourse = useCallback(() => {
    setFocusStudentCourseId(null);
  }, []);

  const handleMockEnrollment = useCallback(
    async (_id: string, approve: boolean) => {
      setActionFeedback(
        approve ? "تمت الموافقة على الطلب التجريبي." : "تم رفض الطلب التجريبي.",
      );

      return true;
    },

    [setActionFeedback],
  );

  const [subjectName, setSubjectName] = useState("");

  const [subjectYear, setSubjectYear] = useState("1");

  const [subjectId, setSubjectId] = useState("");

  const subjectEditorRef = useRef<HTMLFormElement>(null);

  const [subjectIsActive, setSubjectIsActive] = useState(true);

  useEffect(() => {
    if (!subjectId) return;

    const frame = window.requestAnimationFrame(() => {
      subjectEditorRef.current?.scrollIntoView({
        behavior: "smooth",

        block: "start",
      });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [subjectId]);

  const [academicYears, setAcademicYears] = useState<AcademicYearResponse[]>(
    [],
  );

  const [academicYearsLoading, setAcademicYearsLoading] = useState(false);

  const sections = useMemo(
    () => getSections(role, query, useTeacherEnrollmentMock),

    [role, activeKey, query.page, search, useTeacherEnrollmentMock],
  );

  const changeDashboardSection = (section: string) => {
    if (section === activeKey) return;

    window.history.pushState(
      {
        ...window.history.state,

        waiApp: true,

        view: "dashboard",

        dashboardSection: section,
      },

      "",

      window.location.href,
    );

    setActiveKey(section);
  };

  useEffect(() => {
    const currentState = window.history.state;

    if (currentState?.waiApp && currentState.view === "dashboard") {
      window.history.replaceState(
        { ...currentState, dashboardSection: activeKey },

        "",

        window.location.href,
      );
    }

    const restoreDashboardSection = (event: PopStateEvent) => {
      const state = event.state;

      if (!state?.waiApp || state.view !== "dashboard") return;

      const section = state.dashboardSection;

      if (
        typeof section === "string" &&
        sections.some(({ key }) => key === section)
      ) {
        setActiveKey(section);
      }
    };

    window.addEventListener("popstate", restoreDashboardSection);

    return () =>
      window.removeEventListener("popstate", restoreDashboardSection);
  }, [activeKey, sections]);

  const section = sections.find(({ key }) => key === activeKey) ?? sections[0];

  const { data, error, loading } = useApiQuery(
    section.load,

    reloadKey,

    true,

    `dashboard:${role}:${activeKey}`,
  );

  const loadNotifications = useCallback(
    () =>
      activeKey === "notifications"
        ? Promise.resolve(null)
        : notificationsApi.list(),

    [activeKey],
  );

  const { data: notificationData } = useApiQuery(
    loadNotifications,

    notificationReloadKey,
  );

  const unreadNotifications = useMemo(() => {
    const payload = unwrapApiResponse(
      activeKey === "notifications" ? data : notificationData,
    );

    if (isRecord(payload)) {
      const summary = isRecord(payload.summary) ? payload.summary : payload;

      const count = Number(
        summary.unreadCount ?? summary.unreadNotificationsCount,
      );

      if (Number.isFinite(count) && count >= 0) return Math.floor(count);
    }

    return getNotificationRecords(payload).filter(isUnreadNotification).length;
  }, [activeKey, data, notificationData]);

  useEffect(() => {
    const refresh = () => {
      if (activeKey === "notifications") setReloadKey((key) => key + 1);
      else setNotificationReloadKey((key) => key + 1);
    };

    const interval = window.setInterval(refresh, 30_000);

    window.addEventListener("focus", refresh);

    return () => {
      window.clearInterval(interval);

      window.removeEventListener("focus", refresh);
    };
  }, [activeKey]);

  const [accountName, setAccountName] = useState(
    () => window.sessionStorage.getItem("eduhub.auth.name") ?? "",
  );

  const [accountImage, setAccountImage] = useState(
    () => window.sessionStorage.getItem("eduhub.auth.image") ?? "",
  );

  useEffect(() => {
    const response = unwrapApiResponse(data);

    const profile = isRecord(response)
      ? (response.profile ?? response)
      : response;

    const name = profileDisplayName(profile);

    const image = profileDisplayImage(profile);

    if (name) {
      window.sessionStorage.setItem("eduhub.auth.name", name);

      setAccountName(name);
    }

    if (image) {
      window.sessionStorage.setItem("eduhub.auth.image", image);

      setAccountImage(image);
    }
  }, [data]);

  useEffect(() => {
    const updateImage = (event: Event) => {
      const image = (event as CustomEvent<string>).detail;

      const nextImage = typeof image === "string" ? image : "";

      setAccountImage(nextImage);

      if (nextImage)
        window.sessionStorage.setItem("eduhub.auth.image", nextImage);
      else window.sessionStorage.removeItem("eduhub.auth.image");
    };

    window.addEventListener("eduhub:profile-image-updated", updateImage);

    return () =>
      window.removeEventListener("eduhub:profile-image-updated", updateImage);
  }, []);

  useEffect(() => {
    if (!mobileNavOpen) return;

    const previousOverflow = document.body.style.overflow;

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileNavOpen(false);
    };

    document.body.style.overflow = "hidden";

    window.addEventListener("keydown", closeOnEscape);

    return () => {
      document.body.style.overflow = previousOverflow;

      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [mobileNavOpen]);

  const responseData = unwrapApiResponse(data);

  const rawRecords = getRecords(responseData);

  const publicationStateOf = (course: Record<string, unknown>) => {
    const id = String(course.courseId ?? course.id ?? "");

    return coursePublicationOverrides[id] ?? getCoursePublicationState(course);
  };

  const courseRecords =
    role.includes("admin") && activeKey === "courses"
      ? [
          ...rawRecords,

          ...Object.entries(coursePublicationRecords)

            .filter(
              ([id]) =>
                coursePublicationOverrides[id] === "unpublished" &&
                !rawRecords.some(
                  (record) => String(record.courseId ?? record.id ?? "") === id,
                ),
            )

            .map(([, record]) => record),
        ]
      : rawRecords;

  const records =
    activeKey === "pending"
      ? rawRecords.filter((record) => {
          const studentId = String(
            record.studentId ?? record.userId ?? record.id ?? "",
          );

          return !approvedStudentIds.has(studentId);
        })
      : courseRecords;

  const isAdminCourseSection =
    role.includes("admin") && activeKey === "courses";

  const displayedRecords = isAdminCourseSection
    ? records.filter(
        (record) =>
          courseStatusFilter === "all" ||
          publicationStateOf(record) === courseStatusFilter,
      )
    : records;

  const courseStatusCounts = {
    all: records.length,

    published: records.filter(
      (record) => publicationStateOf(record) === "published",
    ).length,

    unpublished: records.filter(
      (record) => publicationStateOf(record) === "unpublished",
    ).length,

    draft: records.filter((record) => publicationStateOf(record) === "draft")
      .length,
  };

  const teacherStats =
    role.includes("teacher") &&
    activeKey === "overview" &&
    isRecord(responseData) &&
    isRecord(responseData.stats)
      ? Object.entries(responseData.stats).filter(
          ([key, value]) =>
            !/(id|token|password)/i.test(key) &&
            (typeof value === "number" || typeof value === "boolean"),
        )
      : [];

  const adminMetrics =
    role.includes("admin") && activeKey === "stats"
      ? getAdminMetrics(responseData)
      : [];

  const studentOverview =
    !role.includes("admin") &&
    !role.includes("teacher") &&
    activeKey === "overview" &&
    isRecord(responseData)
      ? responseData
      : null;

  const studentOverviewCourses = getEnrollmentRecords(
    studentOverview?.enrollments,
  ).slice(0, 4);

  const studentEnrollmentTotal = studentOverviewCourses.length;

  const paginationData =
    role.includes("teacher") &&
    activeKey === "enrollments" &&
    isRecord(responseData) &&
    isRecord(responseData.requests)
      ? responseData.requests
      : responseData;

  const pagination = isAdminCourseSection
    ? {
        page,
        totalPages: Math.max(1, Math.ceil(displayedRecords.length / 3)),
      }
    : isRecord(paginationData) && typeof paginationData.totalPages === "number"
      ? { page: paginationData.page, totalPages: paginationData.totalPages }
      : null;

  const visibleRecords = isAdminCourseSection
    ? displayedRecords.slice((page - 1) * 3, page * 3)
    : displayedRecords;

  useEffect(() => {
    if (!isAdminCourseSection) return;

    const lastPage = Math.max(1, Math.ceil(displayedRecords.length / 3));

    if (page > lastPage) setPage(lastPage);
  }, [displayedRecords.length, isAdminCourseSection, page]);

  const showGenericRecords =
    !(role.includes("admin") && activeKey === "stats") &&
    !(role.includes("admin") && activeKey === "teachers") &&
    !(role.includes("admin") && activeKey === "subscriptions") &&
    activeKey !== "profile" &&
    !(
      role.includes("teacher") &&
      ["overview", "courses", "students"].includes(activeKey)
    ) &&
    studentOverview === null &&
    !(
      !role.includes("admin") &&
      !role.includes("teacher") &&
      ["profile", "courses"].includes(activeKey)
    );

  const supportsSearch =
    (role.includes("admin") &&
      ["courses", "teachers", "subscriptions", "students"].includes(
        activeKey,
      )) ||
    (role.includes("teacher") && activeKey === "courses");

  useEffect(() => {
    if (
      !role.includes("admin") &&
      !role.includes("teacher") &&
      activeKey !== "profile"
    )
      return;

    let active = true;

    setAcademicYearsLoading(true);

    getAcademicYears()
      .then((years) => {
        if (active) setAcademicYears(years);
      })

      .catch(() => {
        if (active) setActionFeedback("تعذر تحميل الصفوف الدراسية من الخادم.");
      })

      .finally(() => {
        if (active) setAcademicYearsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [role, activeKey]);

  async function handleEnrollment(
    id: string,

    approve: boolean,

    rejectionAlreadyConfirmed = false,
  ): Promise<boolean> {
    let rejectionConfirmed = rejectionAlreadyConfirmed;

    if (!approve && role.includes("admin") && !rejectionConfirmed) {
      rejectionConfirmed = await confirm({
        title: "رفض طلب الالتحاق؟",

        message: "سيتم رفض طلب الطالب ولن يتمكن من دخول الدورة.",

        variant: "warning",

        confirmText: "رفض الطلب",

        onConfirm: async () => {
          await enrollmentsApi.adminReject(id);
        },
      });

      if (!rejectionConfirmed) return false;
    }

    setActionFeedback("");

    try {
      setActionLoading(`${id}-${approve ? "approve" : "reject"}`);

      if (role.includes("admin")) {
        if (approve) await enrollmentsApi.adminApprove(id);
        else if (!rejectionConfirmed) await enrollmentsApi.adminReject(id);
      } else if (role.includes("teacher")) {
        await (approve
          ? teachersApi.approveEnrollment(id)
          : teachersApi.rejectEnrollment(id));
      } else {
        setActionFeedback("هذا الإجراء متاح للأدمن والمدرّس فقط.");

        return false;
      }

      setActionFeedback(approve ? "تمت الموافقة على الطلب." : "تم رفض الطلب.");

      setReloadKey((key) => key + 1);

      return true;
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "";

      const alreadyHandled =
        (cause instanceof ApiError && cause.status === 409) ||
        /already|approved|accepted|processed|مقبول|تمت الموافقة|سبق/i.test(
          message,
        );

      if (approve && alreadyHandled) {
        setActionFeedback("الطلب تمت الموافقة عليه بالفعل.");

        setReloadKey((key) => key + 1);

        return true;
      }

      setActionFeedback(
        cause instanceof Error ? cause.message : "تعذر تحديث الطلب.",
      );

      return false;
    } finally {
      setActionLoading(null);
    }
  }

  async function handleMarkRead(id?: string): Promise<boolean> {
    setActionFeedback("");

    try {
      setActionLoading(id ? `read-${id}` : "read-all");

      if (id) await notificationsApi.markRead(id);
      else await notificationsApi.markAllRead();

      setActionFeedback("تم تحديث حالة الإشعارات.");

      setReloadKey((key) => key + 1);

      setNotificationReloadKey((key) => key + 1);

      return true;
    } catch (cause) {
      setActionFeedback(
        cause instanceof Error ? cause.message : "تعذر تحديث الإشعارات.",
      );

      return false;
    } finally {
      setActionLoading(null);
    }
  }

  async function handleNotificationDelete(id: string): Promise<boolean> {
    setActionFeedback("");

    setActionLoading(`delete-notification-${id}`);

    try {
      await notificationsApi.remove(id);

      const remaining = getNotificationRecords(await notificationsApi.list());

      const stillExists = remaining.some(
        (notification) =>
          String(notification.id ?? notification.notificationId ?? "") === id,
      );

      if (stillExists) {
        throw new Error("الخادم استقبل طلب الحذف لكن الإشعار ما زال موجودًا.");
      }

      setActionFeedback("تم حذف الإشعار.");

      setReloadKey((key) => key + 1);

      setNotificationReloadKey((key) => key + 1);

      return true;
    } catch (cause) {
      setActionFeedback(
        cause instanceof Error ? cause.message : "تعذر حذف الإشعار.",
      );

      return false;
    } finally {
      setActionLoading(null);
    }
  }

  async function handleDeleteAllNotifications() {
    const confirmed = await confirm({
      title: "حذف جميع الإشعارات؟",

      message:
        "سيتم حذف جميع الإشعارات نهائيًا. لا يمكن التراجع عن هذا الإجراء.",

      variant: "danger",

      confirmText: "حذف الكل",

      onConfirm: async () => {
        await notificationsApi.removeAll();

        const remaining = getNotificationRecords(await notificationsApi.list());

        if (remaining.length > 0) {
          throw new Error("بعض الإشعارات ما زالت موجودة بعد طلب الحذف.");
        }
      },
    });

    if (!confirmed) return;

    setActionFeedback("");

    setActionLoading("delete-all-notifications");

    try {
      setActionFeedback("تم حذف جميع الإشعارات.");

      setReloadKey((key) => key + 1);

      setNotificationReloadKey((key) => key + 1);
    } catch (cause) {
      setActionFeedback(
        cause instanceof Error ? cause.message : "تعذر حذف الإشعارات.",
      );
    } finally {
      setActionLoading(null);
    }
  }

  async function handlePendingStudent(id: string, approve: boolean) {
    if (!role.includes("admin")) {
      setActionFeedback("اعتماد حسابات الطلاب متاح للأدمن فقط.");

      return;
    }

    let rejectionConfirmed = false;

    if (!approve) {
      rejectionConfirmed = await confirm({
        title: "رفض طلب الطالب؟",

        message: "سيتم رفض طلب التسجيل وحذفه نهائيًا.",

        variant: "danger",

        confirmText: "رفض وحذف",

        onConfirm: () => adminApi.rejectStudent(id),
      });

      if (!rejectionConfirmed) return;
    }

    setActionFeedback("");

    setActionLoading(`${id}-${approve ? "approve" : "reject"}`);

    try {
      if (approve) await adminApi.approveStudent(id);
      else if (!rejectionConfirmed) await adminApi.rejectStudent(id);

      if (approve) {
        setApprovedStudentIds((current) => new Set(current).add(id));
      }

      setActionFeedback(approve ? "تم اعتماد حساب الطالب." : "تم رفض الطلب.");

      setReloadKey((key) => key + 1);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "";

      const alreadyApproved =
        approve &&
        ((cause instanceof ApiError && cause.status === 409) ||
          /already|approved|accepted|مقبول|تم اعتماده|تمت الموافقة|سبق/i.test(
            message,
          ));

      if (alreadyApproved) {
        setApprovedStudentIds((current) => new Set(current).add(id));

        setActionFeedback("حساب الطالب معتمد بالفعل.");

        setReloadKey((key) => key + 1);

        return;
      }

      setActionFeedback(
        cause instanceof Error ? cause.message : "تعذر تحديث طلب الطالب.",
      );
    } finally {
      setActionLoading(null);
    }
  }

  async function handleCoursePublish(id: string, publish: boolean) {
    const currentCourse = courseRecords.find(
      (course) => String(course.id ?? course.courseId ?? "") === id,
    );

    if (
      currentCourse &&
      (publicationStateOf(currentCourse) === "published") === publish
    ) {
      setActionFeedback(
        publish ? "الدورة منشورة بالفعل." : "الدورة غير منشورة بالفعل.",
      );

      return;
    }

    let unpublishConfirmed = false;

    if (!publish) {
      const courseTitle = String(
        currentCourse?.title ?? currentCourse?.name ?? "هذه الدورة",
      );

      unpublishConfirmed = await confirm({
        title: "إلغاء نشر الدورة؟",

        message: `سيتم إخفاء «${courseTitle}» عن الطلاب مع الاحتفاظ بها لإعادة نشرها لاحقًا.`,

        variant: "warning",

        confirmText: "إلغاء النشر",

        onConfirm: async () => {
          if (role.includes("admin")) await adminApi.unpublishCourse(id);
          else await teachersApi.unpublishCourse(id);
        },
      });

      if (!unpublishConfirmed) return;
    }

    setActionFeedback("");

    setActionLoading(`${id}-publish`);

    try {
      if (role.includes("admin")) {
        if (publish) await adminApi.publishCourse(id);
        else if (!unpublishConfirmed) await adminApi.unpublishCourse(id);
      } else if (role.includes("teacher")) {
        if (publish) await teachersApi.publishCourse(id);
        else if (!unpublishConfirmed) await teachersApi.unpublishCourse(id);
      } else {
        setActionFeedback("نشر الدورات متاح للأدمن والمدرّس فقط.");

        return;
      }

      setCoursePublicationOverrides((current) => ({
        ...current,

        [id]: publish ? "published" : "unpublished",
      }));

      if (currentCourse) {
        setCoursePublicationRecords((current) => {
          if (!publish) return { ...current, [id]: currentCourse };

          const next = { ...current };

          delete next[id];

          return next;
        });
      }

      setActionFeedback(publish ? "تم نشر الدورة." : "تم إلغاء نشر الدورة.");

      setReloadKey((key) => key + 1);
    } catch (cause) {
      setActionFeedback(
        cause instanceof Error ? cause.message : "تعذر تحديث حالة الدورة.",
      );
    } finally {
      setActionLoading(null);
    }
  }

  async function handleSubjectSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const form = new FormData(event.currentTarget);

    const currentSubjectId = String(form.get("subjectId") ?? "");

    const body = {
      name: String(form.get("name") ?? "").trim(),

      academicYear: Number(form.get("academicYear")),

      isActive: form.get("isActive") === "on",
    };

    if (!body.name || !Number.isFinite(body.academicYear)) return;

    setActionLoading("subject-save");

    setActionFeedback("");

    try {
      if (currentSubjectId)
        await adminApi.updateSubject(currentSubjectId, body);
      else await adminApi.createSubject(body);

      setSubjectName("");

      setSubjectId("");

      setSubjectIsActive(true);

      setActionFeedback(
        currentSubjectId ? "تم تحديث المادة." : "تمت إضافة المادة.",
      );

      setReloadKey((key) => key + 1);
    } catch (cause) {
      setActionFeedback(
        cause instanceof Error ? cause.message : "تعذر حفظ المادة.",
      );
    } finally {
      setActionLoading(null);
    }
  }

  async function handleSubjectDelete(id: string) {
    const confirmed = await confirm({
      title: "حذف المادة؟",

      message: "سيتم حذف المادة من المنصة. لا يمكن التراجع عن هذا الإجراء.",

      variant: "danger",

      confirmText: "حذف المادة",

      onConfirm: () => adminApi.deleteSubject(id),
    });

    if (!confirmed) return;

    setActionLoading(`${id}-delete`);

    setActionFeedback("");

    try {
      setActionFeedback("تم حذف المادة.");

      setReloadKey((key) => key + 1);
    } catch (cause) {
      setActionFeedback(
        cause instanceof Error ? cause.message : "تعذر حذف المادة.",
      );
    } finally {
      setActionLoading(null);
    }
  }

  async function signOut() {
    const confirmed = await confirm({
      title: "تسجيل الخروج؟",

      message: "ستحتاج إلى تسجيل الدخول مرة أخرى لفتح مساحة العمل.",

      variant: "primary",

      confirmText: "تسجيل الخروج",
    });

    if (!confirmed) return;

    clearAuthToken();
    clearApiQueryCache();
    clearPendingEnrollments();

    window.sessionStorage.removeItem("eduhub.auth.role");

    window.sessionStorage.removeItem("eduhub.auth.name");

    window.sessionStorage.removeItem("eduhub.auth.image");

    navigate("landing");
  }

  const roleCardTone = "border-emerald-900/10 bg-surface";

  const roleCellTone = "bg-nuwa-soft/70";

  const roleBadge = role.includes("admin")
    ? {
        title: "مساحة الإدارة",

        badge: "مسؤول النظام",

        color: "bg-nuwa-soft text-nuwa-base",
      }
    : role.includes("teacher")
      ? {
          title: "مساحة المعلم",

          badge: "معلم",

          color: "bg-nuwa-soft text-nuwa-base",
        }
      : {
          title: "مساحة الطالب",

          badge: "طالب",

          color: "bg-nuwa-soft text-nuwa-base",
        };

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

    subscriptions: "تفاصيل الاشتراكات",

    students: role.includes("teacher") ? "طلابي" : "الطلاب",

    pending: "طلاب بانتظار الاعتماد",

    subjects: "المواد الدراسية",

    enrollments: "طلبات الالتحاق",

    notifications: "الإشعارات",
  };

  return (
    <div className="dashboard-shell flex min-h-dvh flex-col bg-canvas dir-rtl">
      <header className="hidden">
        <div
          dir="ltr"
          className="mx-auto flex min-h-[68px] max-w-7xl items-center justify-between gap-2 px-3 py-2 sm:gap-4 sm:px-6 sm:py-3 lg:px-6"
        >
          <button
            type="button"
            onClick={() => setMobileNavOpen(true)}
            className="grid size-10 shrink-0 place-items-center rounded-xl border border-stroke bg-white text-ink-muted shadow-nuwa transition hover:bg-canvas lg:hidden"
            aria-label="فتح القائمة"
            aria-expanded={mobileNavOpen}
            aria-controls="dashboard-sidebar"
          >
            <Menu size={19} />
          </button>
          <div
            dir="rtl"
            className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3"
          >
            <NuwaLogo size="sm" className="shrink-0 lg:hidden" />
            <div className="hidden">
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
            <div className="hidden min-w-0 flex-1 items-center justify-end gap-3 md:flex">
              <div className="min-w-0 text-end">
                <p className="truncate text-sm font-semibold text-ink">
                  {accountName || roleBadge.title}
                </p>
                <p className="text-xs text-ink-muted">{roleBadge.badge}</p>
              </div>
              <PersonAvatar
                name={accountName || roleBadge.badge}
                imageUrl={accountImage}
                size="sm"
              />
            </div>
          </div>

          <button dir="rtl" onClick={signOut} className="hidden">
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
            <span className="sm:hidden">خروج</span>
            <span className="hidden sm:inline">تسجيل الخروج</span>
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex flex-1">
        {mobileNavOpen && (
          <button
            type="button"
            aria-label="إغلاق القائمة"
            onClick={() => setMobileNavOpen(false)}
            className="fixed inset-0 z-40 bg-neutral-950/45 backdrop-blur-[2px] lg:hidden"
          />
        )}
        <aside
          id="dashboard-sidebar"
          aria-label="القائمة الرئيسية"
          className={`fixed inset-y-3 right-3 left-auto z-50 h-[calc(100dvh-1.5rem)] w-[min(86vw,320px)] overflow-y-auto overscroll-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden rounded-2xl border border-stroke bg-white p-4 shadow-nuwa-md transition-transform duration-200 lg:fixed lg:inset-y-4 lg:right-4 lg:left-auto lg:top-4 lg:z-20 lg:h-[calc(100dvh-2rem)] lg:w-[280px] lg:border lg:border-stroke lg:shadow-nuwa-md lg:translate-x-0 ${
            mobileNavOpen
              ? "translate-x-0"
              : "translate-x-[calc(100%_+_0.75rem)]"
          }`}
        >
          <div className="mb-6 hidden items-center justify-between lg:flex">
            <NuwaLogo size="sm" />
            <span
              className={`rounded-full px-3 py-1 text-xs font-semibold ${roleBadge.color}`}
            >
              {roleBadge.badge}
            </span>
          </div>
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
            <p className="text-xs font-semibold text-white/75">
              {roleBadge.title}
            </p>
            {accountName && (
              <p className="mt-1 truncate text-sm font-bold">{accountName}</p>
            )}
          </div>
          <p className="mb-2 px-3 text-[11px] font-bold text-neutral-400">
            القائمة الرئيسية
          </p>
          <LazyMotion features={domMax}>
            <nav
              ref={sidebarNavRef}
              className="relative grid gap-1"
              aria-label="أقسام لوحة التحكم"
            >
              {sidebarIndicatorMotion !== null && (
                <m.span
                  aria-hidden="true"
                  className="pointer-events-none absolute right-0 top-0 z-10 h-10 w-[5px] rounded-l-md bg-[#176b43]"
                  ref={sidebarIndicatorRef}
                  initial={false}
                  style={{ transformOrigin: "center top" }}
                  animate={{
                    y: sidebarIndicatorMotion.y,

                    scaleY: sidebarIndicatorMotion.scaleY,
                  }}
                  transition={{
                    type: "tween",

                    duration: 0.34,

                    ease: [0.2, 0.8, 0.2, 1],

                    times: [0, 0.4, 1],
                  }}
                />
              )}
              {sections.map((item) => {
                const isActive = activeKey === item.key;

                const iconMap: Record<string, typeof LayoutDashboard> = {
                  stats: LayoutDashboard,

                  overview: LayoutDashboard,

                  profile: CircleUserRound,

                  courses: BookOpen,

                  teachers: Users,

                  subscriptions: BookOpenCheck,

                  students: role.includes("teacher")
                    ? UsersRound
                    : GraduationCap,

                  "student-progress": UsersRound,

                  pending: ClipboardList,

                  subjects: BookOpen,

                  enrollments: ClipboardList,

                  notifications: Bell,
                };

                const Icon = iconMap[item.key] ?? Settings2;

                return (
                  <button
                    key={item.key}
                    data-sidebar-item={item.key}
                    onClick={() => {
                      changeDashboardSection(item.key);

                      setPage(1);

                      setSearch("");

                      setSearchInput("");

                      setMobileNavOpen(false);
                    }}
                    aria-current={isActive ? "page" : undefined}
                    className={`relative flex h-12 w-full items-center gap-3 rounded-xl px-3 py-3 text-start text-sm font-semibold transition-colors duration-200 ${
                      isActive
                        ? "text-[#065f46]"
                        : "text-neutral-600 hover:bg-neutral-50 hover:text-ink"
                    }`}
                  >
                    <span className="relative z-10 grid size-5 shrink-0 place-items-center">
                      <Icon size={18} />
                      {item.key === "notifications" &&
                        unreadNotifications > 0 && (
                          <span
                            aria-label={`${unreadNotifications} إشعار غير مقروء`}
                            className="absolute -right-3 -top-2 grid min-h-4 min-w-4 place-items-center rounded-full border-2 border-white bg-red-600 px-1 text-[9px] font-bold leading-none text-white shadow-sm"
                          >
                            {unreadNotifications > 99
                              ? "99+"
                              : unreadNotifications}
                          </span>
                        )}
                    </span>
                    <span className="relative z-10 min-w-0 flex-1">
                      {sectionLabels[item.key] ?? item.label}
                    </span>
                  </button>
                );
              })}
            </nav>
          </LazyMotion>
          <button
            onClick={() => navigate("landing")}
            className="mt-6 flex w-full items-center gap-3 border-t border-neutral-100 px-3 pt-5 text-sm font-semibold text-neutral-500 hover:text-nuwa-base"
          >
            <GraduationCap size={18} />
            العودة للمنصة
          </button>
          <button
            type="button"
            onClick={signOut}
            className="mt-3 flex w-full items-center gap-3 rounded-xl px-3 py-3 text-start text-sm font-semibold text-danger transition hover:bg-red-50"
          >
            <LogOut size={18} />
            تسجيل الخروج
          </button>
          <div
            aria-hidden="true"
            className="relative mt-5 hidden h-40 overflow-hidden rounded-2xl bg-[#0b3b25] lg:block"
            style={{
              backgroundImage:
                "repeating-radial-gradient(circle at 100% 100%, transparent 0 10px, rgb(66 168 121 / 25%) 11px 12px), linear-gradient(135deg, #0b3b25, #176b43)",
            }}
          >
            <span className="absolute -bottom-10 -left-8 size-28 rounded-full border-[14px] border-white/10" />
            <span className="absolute bottom-5 left-5 size-3 rounded-full bg-emerald-300 shadow-[0_0_20px_rgb(110_231_183_/_80%)]" />
          </div>
        </aside>
        <div
          className={`flex min-w-0 flex-1 flex-col pb-8 pt-4 ${
            role.includes("teacher") && activeKey === "courses"
              ? "px-1 sm:px-3 sm:pt-6"
              : "px-3 sm:px-6 sm:pt-6"
          } lg:mr-[320px] lg:ml-4 lg:px-0 lg:pt-4`}
        >
          <main className="mx-auto w-full max-w-[1920px] flex-1">
            <header className="sticky top-3 z-30 mb-5 flex min-h-[76px] items-center justify-between gap-3 rounded-2xl border border-stroke/70 bg-surface/95 p-3 shadow-nuwa backdrop-blur-xl sm:top-4 sm:gap-4 sm:rounded-[24px] sm:p-4">
              <div className="flex min-w-0 items-center gap-3">
                <button
                  type="button"
                  onClick={() => setMobileNavOpen(true)}
                  className="grid size-10 shrink-0 place-items-center rounded-xl border border-stroke bg-white text-ink-muted transition hover:bg-canvas lg:hidden"
                  aria-label="فتح القائمة"
                  aria-expanded={mobileNavOpen}
                  aria-controls="dashboard-sidebar"
                >
                  <Menu size={19} />
                </button>
                <PersonAvatar
                  name={accountName || roleBadge.badge}
                  imageUrl={accountImage}
                  size="sm"
                />
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-ink sm:text-base">
                    {accountName || roleBadge.title}
                  </p>
                  <p className="truncate text-[11px] text-ink-muted sm:text-xs">
                    {roleBadge.title}
                    <span aria-hidden="true"> · </span>
                    {sectionLabels[activeKey] ?? roleBadge.title}
                  </p>
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                {activeKey === "notifications" && (
                  <>
                    <button
                      type="button"
                      onClick={() => void handleMarkRead()}
                      disabled={actionLoading === "read-all"}
                      aria-label="قراءة كل الإشعارات"
                      title="قراءة الكل"
                      className="grid size-10 place-items-center rounded-xl border border-stroke bg-white text-ink-muted transition hover:bg-nuwa-ice hover:text-nuwa-deep disabled:opacity-50"
                    >
                      <CheckCircle2 size={17} />
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleDeleteAllNotifications()}
                      disabled={actionLoading === "delete-all-notifications"}
                      aria-label="حذف كل الإشعارات"
                      title="حذف الكل"
                      className="grid size-10 place-items-center rounded-xl border border-red-200 bg-red-50 text-red-700 transition hover:bg-red-100 disabled:opacity-50"
                    >
                      <Trash2 size={16} />
                    </button>
                  </>
                )}
                <button
                  type="button"
                  onClick={() => setReloadKey((key) => key + 1)}
                  disabled={loading}
                  aria-label="تحديث البيانات"
                  title="تحديث البيانات"
                  className="grid size-10 place-items-center rounded-xl bg-nuwa-base text-white shadow-sm transition hover:bg-nuwa-deep focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nuwa-bright focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-70"
                >
                  <RefreshCw
                    size={17}
                    className={loading ? "animate-spin" : ""}
                  />
                </button>
              </div>
            </header>

            {supportsSearch && (
              <form
                onSubmit={(event) => {
                  event.preventDefault();

                  setPage(1);

                  setSearch(searchInput.trim());
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
                      setSearchInput("");

                      setSearch("");

                      setPage(1);
                    }}
                    className="h-10 rounded-lg border border-stroke px-4 text-sm text-ink"
                  >
                    مسح البحث
                  </button>
                )}
              </form>
            )}

            {isAdminCourseSection && (
              <div
                role="group"
                aria-label="تصفية الدورات حسب حالة النشر"
                className="mt-5 flex flex-wrap gap-2 rounded-2xl border border-stroke bg-surface p-3"
              >
                {(
                  [
                    ["all", "كل الدورات"],

                    ["published", "منشورة"],

                    ["unpublished", "غير منشورة"],

                    ["draft", "مسودات"],
                  ] as const
                ).map(([status, label]) => (
                  <button
                    key={status}
                    type="button"
                    aria-pressed={courseStatusFilter === status}
                    onClick={() => {
                      setCourseStatusFilter(status);
                      setPage(1);
                    }}
                    className={`inline-flex min-h-10 items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition ${
                      courseStatusFilter === status
                        ? "bg-nuwa-base text-white shadow-sm"
                        : "bg-white text-ink-muted hover:bg-nuwa-ice hover:text-nuwa-deep"
                    }`}
                  >
                    {label}
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs ${
                        courseStatusFilter === status
                          ? "bg-white/15 text-white"
                          : "bg-canvas text-ink-muted"
                      }`}
                    >
                      {courseStatusCounts[status]}
                    </span>
                  </button>
                ))}
              </div>
            )}

            {/* Data Cards Section */}
            <div className="mt-6">
              {role.includes("teacher") &&
                activeKey === "overview" &&
                loading && <DashboardOverviewSkeleton />}
              {teacherStats.length > 0 && (
                <>
                  <dl className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    {teacherStats.map(([key, value]) => (
                      <div
                        key={key}
                        className={`rounded-xl border p-4 shadow-sm ${roleCardTone}`}
                      >
                        <dt className="text-sm font-medium text-ink-muted">
                          {fieldLabels[key] ?? "مؤشر إضافي"}
                        </dt>
                        <dd className="mt-2 text-2xl font-bold text-nuwa-deep">
                          <AnimatedNumber value={formatValue(key, value)} />
                        </dd>
                      </div>
                    ))}
                  </dl>
                  <MetricBarChart
                    title="تحليل مؤشرات المعلم"
                    description="مقارنة القيم الحالية لأبرز المؤشرات"
                    metrics={teacherStats.map(([key, value]) => ({
                      key,

                      label: fieldLabels[key] ?? "مؤشر إضافي",

                      value: Number(value),
                    }))}
                  />
                </>
              )}
              {role.includes("admin") && activeKey === "stats" && loading && (
                <AdminStatsSkeleton />
              )}
              {role.includes("admin") &&
                activeKey === "stats" &&
                !loading &&
                !error && (
                  <section className="mb-5 overflow-hidden rounded-2xl border border-stroke bg-white shadow-nuwa">
                    <div className="relative isolate overflow-hidden bg-gradient-to-l from-nuwa-deep to-nuwa-base px-5 py-6 text-white sm:px-7">
                      <div
                        aria-hidden="true"
                        className="absolute -left-8 -top-12 -z-10 size-48 rounded-full border-[24px] border-white/10"
                      />
                      <div className="flex flex-wrap items-center justify-between gap-4">
                        <div className="max-w-xl">
                          <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold text-white/90">
                            <ShieldCheck size={15} />
                            مساحة إدارة المنصة
                          </span>
                          <h3 className="mt-3 text-xl font-bold sm:text-2xl">
                            نظرة عامة على منصة وَعي
                          </h3>
                          <p className="mt-1 text-sm leading-6 text-white/75">
                            تابع المؤشرات الرئيسية وانتقل مباشرةً إلى أدوات
                            إدارة المنصة.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setReloadKey((key) => key + 1)}
                          disabled={loading}
                          className="inline-flex h-10 items-center gap-2 rounded-xl bg-white px-4 text-sm font-bold text-nuwa-deep transition hover:bg-nuwa-ice disabled:opacity-60"
                        >
                          <LayoutDashboard size={16} />
                          تحديث الملخص
                        </button>
                      </div>
                    </div>
                    <div className="p-4 sm:p-6">
                      {adminMetrics.length ? (
                        <dl className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                          {adminMetrics.map(
                            ({ key, label, value, Icon }, index) => (
                              <div
                                key={key}
                                className={`flex items-center gap-4 rounded-[22px] border p-4 ${
                                  index === 0
                                    ? "border-nuwa-deep bg-nuwa-deep text-white shadow-nuwa-md"
                                    : "border-stroke bg-canvas/70"
                                }`}
                              >
                                <span
                                  className={`grid size-11 shrink-0 place-items-center rounded-xl ${
                                    index === 0
                                      ? "bg-white/15 text-white"
                                      : "bg-nuwa-soft text-nuwa-base"
                                  }`}
                                >
                                  <Icon size={20} />
                                </span>
                                <div className="min-w-0">
                                  <dt
                                    className={`truncate text-sm font-medium ${
                                      index === 0
                                        ? "text-white/75"
                                        : "text-ink-muted"
                                    }`}
                                  >
                                    {label}
                                  </dt>
                                  <dd
                                    className={`mt-1 text-2xl font-bold tabular-nums ${
                                      index === 0 ? "text-white" : "text-ink"
                                    }`}
                                  >
                                    <AnimatedNumber
                                      value={formatValue(key, value)}
                                    />
                                  </dd>
                                </div>
                              </div>
                            ),
                          )}
                        </dl>
                      ) : (
                        <p className="rounded-xl border border-dashed border-stroke-strong px-4 py-6 text-center text-sm text-ink-muted">
                          لا تتوفر مؤشرات رقمية لعرضها حالياً.
                        </p>
                      )}
                      <div className="mt-6 border-t border-stroke pt-6 sm:mt-8 sm:pt-8">
                        <MetricBarChart
                          title="تحليل مؤشرات المنصة"
                          description="مقارنة القيم الحالية لأبرز المؤشرات"
                          metrics={adminMetrics.map(
                            ({ key, label, value }) => ({
                              key,

                              label,

                              value,
                            }),
                          )}
                        />
                      </div>
                      <div className="mt-6">
                        <h4 className="text-sm font-bold text-ink">
                          الوصول السريع
                        </h4>
                        <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                          {[
                            {
                              key: "pending",

                              label: "مراجعة حسابات الطلاب",

                              description: "اعتماد الطلاب الجدد أو رفض طلباتهم",

                              Icon: GraduationCap,
                            },

                            {
                              key: "students",

                              label: "سجل الطلاب",

                              description: "استعراض بيانات الطلاب المسجلين",

                              Icon: UsersRound,
                            },

                            {
                              key: "enrollments",

                              label: "طلبات الالتحاق",

                              description: "متابعة طلبات الانضمام للدورات",

                              Icon: ClipboardList,
                            },

                            {
                              key: "teachers",

                              label: "إدارة المعلمين",

                              description: "إضافة المعلمين وتحديث بياناتهم",

                              Icon: Users,
                            },

                            {
                              key: "subscriptions",

                              label: "تفاصيل الاشتراكات",

                              description: "متابعة دورات المعلمين وعدد الطلاب",

                              Icon: BookOpenCheck,
                            },

                            {
                              key: "courses",

                              label: "إدارة الدورات",

                              description: "مراجعة الدورات وحالة النشر",

                              Icon: BookOpen,
                            },

                            {
                              key: "subjects",

                              label: "المواد الدراسية",

                              description: "إضافة المواد وتنظيمها حسب الصف",

                              Icon: BookOpenCheck,
                            },
                          ].map(({ key, label, description, Icon }) => (
                            <button
                              key={key}
                              type="button"
                              onClick={() => {
                                changeDashboardSection(key);

                                setPage(1);

                                setSearch("");

                                setSearchInput("");
                              }}
                              className="group flex items-center gap-3 rounded-xl border border-stroke p-3 text-start transition hover:border-nuwa-base/40 hover:bg-nuwa-ice"
                            >
                              <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-nuwa-soft text-nuwa-base">
                                <Icon size={18} />
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="block text-sm font-bold text-ink">
                                  {label}
                                </span>
                                <span className="mt-0.5 block text-xs leading-5 text-ink-muted">
                                  {description}
                                </span>
                              </span>
                              <ArrowUpLeft
                                size={16}
                                className="shrink-0 text-ink-muted transition group-hover:text-nuwa-base"
                              />
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </section>
                )}
              {!role.includes("admin") &&
                !role.includes("teacher") &&
                activeKey === "overview" &&
                loading && <DashboardOverviewSkeleton student />}
              {studentOverview && !loading && !error && (
                <section className="mb-5 overflow-hidden rounded-2xl border border-stroke bg-white shadow-nuwa">
                  <div className="relative isolate overflow-hidden bg-gradient-to-l from-nuwa-deep to-nuwa-base px-5 py-6 text-white sm:px-7">
                    <div
                      aria-hidden="true"
                      className="absolute -left-8 -top-12 -z-10 size-48 rounded-full border-[24px] border-white/10"
                    />
                    <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold text-white/90">
                      <GraduationCap size={15} />
                      مساحتك التعليمية
                    </span>
                    <h3 className="mt-3 text-xl font-bold sm:text-2xl">
                      أهلًا {accountName || "بك"}، جاهز تكمل رحلتك؟
                    </h3>
                    <p className="mt-1 max-w-2xl text-sm leading-6 text-white/80">
                      تابع دوراتك وتقدمك، وتواصل مع معلميك من مكان واحد.
                    </p>
                  </div>
                  <div className="p-4 sm:p-6">
                    {typeof studentOverview.enrollmentsError === "string" && (
                      <p
                        role="status"
                        className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
                      >
                        تعذر تحميل ملخص الدورات الآن. يمكنك فتح قسم الدورات
                        والمحاولة مرة أخرى.
                      </p>
                    )}
                    {(() => {
                      const pendingCount = studentOverviewCourses.filter(
                        (enrollment) =>
                          enrollment.isApproved === false ||
                          /pending|await|review/i.test(
                            String(
                              enrollment.status ??
                                enrollment.enrollmentStatus ??
                                "",
                            ),
                          ),
                      ).length;

                      const progressValues = studentOverviewCourses

                        .filter(
                          (enrollment) =>
                            enrollment.isApproved !== false &&
                            !/pending|await|review|reject|declin|cancel/i.test(
                              String(
                                enrollment.status ??
                                  enrollment.enrollmentStatus ??
                                  "",
                              ),
                            ),
                        )

                        .map(enrollmentProgressPercent)

                        .filter((value): value is number => value !== null);

                      const averageProgress = progressValues.length
                        ? Math.round(
                            progressValues.reduce(
                              (total, value) => total + value,

                              0,
                            ) / progressValues.length,
                          )
                        : 0;

                      return (
                        <>
                          <dl className="grid gap-3 sm:grid-cols-3">
                            {[
                              {
                                label: "دورات نشطة · المعروض",

                                value: studentEnrollmentTotal,

                                Icon: BookOpenCheck,
                              },

                              {
                                label: "بانتظار الموافقة · المعروض",

                                value: pendingCount,

                                Icon: Clock3,
                              },

                              {
                                label: "متوسط التقدم · المعروض",

                                value: `${averageProgress}%`,

                                Icon: CheckCircle2,
                              },
                            ].map(({ label, value, Icon }) => (
                              <div
                                key={label}
                                className="flex items-center gap-4 rounded-xl border border-stroke bg-canvas/70 p-4"
                              >
                                <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-nuwa-soft text-nuwa-base">
                                  <Icon size={20} />
                                </span>
                                <div>
                                  <dt className="text-sm font-medium text-ink-muted">
                                    {label}
                                  </dt>
                                  <dd className="mt-1 text-2xl font-bold tabular-nums text-ink">
                                    <AnimatedNumber value={value} />
                                  </dd>
                                </div>
                              </div>
                            ))}
                          </dl>
                          <MetricBarChart
                            title="مخطط تقدم الدورات"
                            description="نسبة الإنجاز في الدورات المسجل بها"
                            metrics={studentOverviewCourses.map(
                              (enrollment, index) => {
                                const course = isRecord(enrollment.course)
                                  ? enrollment.course
                                  : {};

                                const progress =
                                  enrollmentProgressPercent(enrollment) ?? 0;

                                return {
                                  key: String(
                                    enrollment.id ??
                                      enrollment.courseId ??
                                      index,
                                  ),

                                  label: String(
                                    enrollment.courseTitle ??
                                      enrollment.courseName ??
                                      course.title ??
                                      course.name ??
                                      `دورة ${index + 1}`,
                                  ),

                                  value: Math.round(progress),
                                };
                              },
                            )}
                          />
                          <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
                            <div>
                              <h4 className="text-base font-bold text-ink">
                                آخر دوراتي
                              </h4>
                              <p className="mt-1 text-sm text-ink-muted">
                                تابع تقدمك وافتح محتوى الدورة مباشرة.
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                setFocusStudentCourseId(null);

                                changeDashboardSection("courses");

                                setPage(1);

                                setSearch("");

                                setSearchInput("");
                              }}
                              className="rounded-lg border border-stroke px-3 py-2 text-sm font-semibold text-nuwa-base transition hover:bg-nuwa-ice"
                            >
                              عرض كل الدورات
                            </button>
                          </div>
                          {studentOverviewCourses.length ? (
                            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                              {studentOverviewCourses.map(
                                (enrollment, index) => {
                                  const course = isRecord(enrollment.course)
                                    ? enrollment.course
                                    : {};

                                  const courseId =
                                    enrollment.courseId ??
                                    course.id ??
                                    course.courseId;

                                  const title =
                                    enrollment.courseTitle ??
                                    enrollment.courseName ??
                                    course.title ??
                                    course.name ??
                                    `دورة ${index + 1}`;

                                  const progressPercent =
                                    enrollmentProgressPercent(enrollment) ?? 0;

                                  const teacher = isRecord(enrollment.teacher)
                                    ? enrollment.teacher
                                    : isRecord(course.teacher)
                                      ? course.teacher
                                      : {};

                                  const teacherName =
                                    enrollment.teacherName ??
                                    course.teacherName ??
                                    teacher.fullName ??
                                    teacher.name;

                                  const canOpenCourse =
                                    enrollmentStatus(enrollment) === "approved";
                                  const isPendingCourse =
                                    enrollmentStatus(enrollment) === "pending";

                                  return (
                                    <CourseCard
                                      key={String(
                                        enrollment.id ?? courseId ?? index,
                                      )}
                                      course={{
                                        ...course,
                                        teacher:
                                          enrollment.teacher ?? course.teacher,
                                        teacherId:
                                          enrollment.teacherId ??
                                          course.teacherId,
                                      }}
                                      title={String(title)}
                                      teacherName={
                                        teacherName == null
                                          ? undefined
                                          : String(teacherName)
                                      }
                                      statusLabel={enrollmentStatusLabel(
                                        enrollment.status ??
                                          enrollment.enrollmentStatus,
                                        enrollment.isApproved,
                                      )}
                                      statusTone="bg-nuwa-soft text-nuwa-base"
                                      footer={
                                        <div className="mt-4">
                                          <div className="flex items-center justify-between text-xs text-ink-muted">
                                            <span>التقدم في الدورة</span>
                                            <span className="font-bold tabular-nums text-ink">
                                              <AnimatedNumber
                                                value={`${Math.round(progressPercent)}%`}
                                              />
                                            </span>
                                          </div>
                                          <div
                                            className="mt-2 h-2 overflow-hidden rounded-full bg-nuwa-soft"
                                            role="progressbar"
                                            aria-label={`التقدم في دورة ${String(title)}`}
                                            aria-valuemin={0}
                                            aria-valuemax={100}
                                            aria-valuenow={Math.round(
                                              progressPercent,
                                            )}
                                          >
                                            <AnimatedBar
                                              className="h-full rounded-full bg-nuwa-base"
                                              value={progressPercent}
                                            />
                                          </div>
                                        </div>
                                      }
                                    >
                                      {courseId !== undefined &&
                                        canOpenCourse && (
                                          <button
                                            type="button"
                                            onClick={() => {
                                              setFocusStudentCourseId(
                                                String(courseId),
                                              );
                                              changeDashboardSection("courses");
                                              setPage(1);
                                              setSearch("");
                                              setSearchInput("");
                                            }}
                                            className="w-full rounded-lg bg-nuwa-base px-3 py-2.5 text-sm font-bold text-white transition hover:bg-nuwa-deep"
                                          >
                                            متابعة التقدم
                                          </button>
                                        )}
                                      {courseId !== undefined &&
                                        courseId !== null &&
                                        isPendingCourse && (
                                          <div className="mt-3 grid gap-2 sm:grid-cols-2">
                                            <button
                                              type="button"
                                              onClick={() =>
                                                setPendingCourseDialog({
                                                  ...course,
                                                  id: courseId,
                                                  teacher:
                                                    enrollment.teacher ??
                                                    course.teacher,
                                                  teacherId:
                                                    enrollment.teacherId ??
                                                    course.teacherId,
                                                  teacherName:
                                                    teacherName == null
                                                      ? undefined
                                                      : String(teacherName),
                                                })
                                              }
                                              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs font-bold text-amber-900 transition hover:bg-amber-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
                                            >
                                              <Clock3
                                                size={15}
                                                aria-hidden="true"
                                              />
                                              طلبك قيد المراجعة
                                            </button>
                                            <button
                                              type="button"
                                              onClick={() =>
                                                navigate(
                                                  "public:course-detail",
                                                  {
                                                    courseId: String(courseId),
                                                  },
                                                )
                                              }
                                              className="inline-flex min-h-11 items-center justify-center rounded-xl bg-nuwa-soft px-3 py-2.5 text-xs font-bold text-nuwa-deep transition hover:bg-nuwa-base hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nuwa-bright"
                                            >
                                              التفاصيل
                                            </button>
                                          </div>
                                        )}
                                    </CourseCard>
                                  );
                                },
                              )}
                            </div>
                          ) : (
                            <div className="mt-4 rounded-xl border border-dashed border-stroke-strong bg-canvas/60 px-4 py-8 text-center">
                              <BookOpen
                                size={28}
                                className="mx-auto text-nuwa-base"
                              />
                              <p className="mt-2 font-semibold text-ink">
                                لسه مفيش دورات في حسابك
                              </p>
                              <p className="mt-1 text-sm text-ink-muted">
                                استكشف الدورات المتاحة وابدأ أول خطوة في رحلتك
                                التعليمية.
                              </p>
                              <button
                                type="button"
                                onClick={() => navigate("public:courses")}
                                className="mt-4 rounded-lg bg-nuwa-base px-4 py-2 text-sm font-semibold text-white transition hover:bg-nuwa-deep"
                              >
                                استكشف الدورات
                              </button>
                            </div>
                          )}
                        </>
                      );
                    })()}
                  </div>
                </section>
              )}
              <RoleForms
                role={role}
                section={activeKey}
                data={data}
                loading={loading}
                onSaved={reloadData}
                onFeedback={setActionFeedback}
                focusCourseId={focusStudentCourseId}
                onFocusCourseHandled={clearFocusedStudentCourse}
              />
              {role.includes("admin") && activeKey === "subjects" && (
                <form
                  ref={subjectEditorRef}
                  onSubmit={handleSubjectSubmit}
                  className="scroll-mt-28 mb-5 grid gap-3 rounded-xl border border-stroke bg-surface p-4 sm:grid-cols-[1fr_180px_auto_auto] sm:items-end"
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
                      disabled={academicYearsLoading || !academicYears.length}
                      aria-busy={academicYearsLoading}
                      onChange={(event) => setSubjectYear(event.target.value)}
                      required
                      className="h-10 rounded-lg border border-stroke bg-white px-3 text-sm text-ink"
                    >
                      {academicYearsLoading && (
                        <option value="">جارٍ تحميل الصفوف الدراسية...</option>
                      )}
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
                          setSubjectId("");

                          setSubjectName("");

                          setSubjectIsActive(true);
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
              {role.includes("admin") && activeKey === "subscriptions" ? (
                <AdminSubscriptions
                  data={data}
                  loading={loading}
                  error={error}
                  reloadKey={reloadKey}
                  onRetry={() => setReloadKey((key) => key + 1)}
                />
              ) : (role.includes("teacher") || role.includes("admin")) &&
                activeKey === "enrollments" ? (
                <TeacherEnrollmentRequests
                  data={
                    useTeacherEnrollmentMock
                      ? mockTeacherEnrollmentRequests
                      : data
                  }
                  loading={useTeacherEnrollmentMock ? false : loading}
                  error={useTeacherEnrollmentMock ? null : error}
                  onRetry={() => setReloadKey((key) => key + 1)}
                  onDecision={
                    useTeacherEnrollmentMock
                      ? handleMockEnrollment
                      : handleEnrollment
                  }
                />
              ) : (
                <ApiQueryState
                  loading={loading}
                  loadingContent={
                    showGenericRecords ? (
                      <RecordGridSkeleton
                        compact={activeKey === "notifications"}
                        count={
                          data === null ? undefined : displayedRecords.length
                        }
                      />
                    ) : null
                  }
                  error={error}
                  isEmpty={Boolean(
                    data && displayedRecords.length === 0 && showGenericRecords,
                  )}
                  emptyMessage="لا توجد بيانات متاحة لعرضها في هذا القسم حالياً."
                  onRetry={() => setReloadKey((key) => key + 1)}
                >
                  {showGenericRecords && (
                    <div
                      className={
                        activeKey === "notifications"
                          ? "grid gap-3"
                          : activeKey === "courses"
                            ? "grid gap-4 sm:grid-cols-2 xl:grid-cols-3"
                            : "grid gap-4 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-2"
                      }
                    >
                      {visibleRecords.map((record, index) => {
                        const recordId =
                          activeKey === "notifications"
                            ? (record.id ?? record.notificationId)
                            : activeKey === "pending"
                              ? (record.studentId ?? record.userId ?? record.id)
                              : activeKey === "enrollments"
                                ? (record.enrollmentId ??
                                  record.requestId ??
                                  record.id)
                                : activeKey === "courses"
                                  ? (record.courseId ?? record.id)
                                  : record.id;

                        const id = formatValue("id", recordId);

                        const unread =
                          activeKey === "notifications" &&
                          isUnreadNotification(record);

                        const publicationState =
                          activeKey === "courses"
                            ? publicationStateOf(record)
                            : null;

                        const title = formatValue(
                          "title",

                          record.title ??
                            record.fullName ??
                            record.name ??
                            record.email ??
                            `عنصر #${index + 1}`,
                        );

                        if (activeKey === "courses") {
                          const statusTone =
                            publicationState === "published"
                              ? "bg-emerald-100 text-emerald-800"
                              : publicationState === "draft"
                                ? "bg-amber-100 text-amber-900"
                                : "bg-neutral-100 text-neutral-700";

                          return (
                            <CourseCard
                              key={id === "—" ? index : id}
                              course={record}
                              title={String(title)}
                              statusLabel={
                                publicationState === "published"
                                  ? "منشورة"
                                  : publicationState === "draft"
                                    ? "مسودة"
                                    : "غير منشورة"
                              }
                              statusTone={statusTone}
                            >
                              {(role.includes("admin") ||
                                role.includes("teacher")) &&
                                id !== "—" && (
                                  <div className="flex flex-wrap gap-2">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        void handleCoursePublish(id, true)
                                      }
                                      disabled={
                                        actionLoading === `${id}-publish`
                                      }
                                      className={`rounded-lg bg-nuwa-base px-3 py-2 text-xs font-semibold text-white disabled:opacity-50 ${
                                        publicationState === "published"
                                          ? "hidden"
                                          : ""
                                      }`}
                                    >
                                      نشر الدورة
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        void handleCoursePublish(id, false)
                                      }
                                      disabled={
                                        actionLoading === `${id}-publish`
                                      }
                                      className={`rounded-lg border border-stroke px-3 py-2 text-xs font-semibold text-ink disabled:opacity-50 ${
                                        publicationState !== "published"
                                          ? "hidden"
                                          : ""
                                      }`}
                                    >
                                      إلغاء النشر
                                    </button>
                                  </div>
                                )}
                            </CourseCard>
                          );
                        }

                        if (activeKey === "notifications") {
                          const sender = isRecord(record.sender)
                            ? record.sender
                            : isRecord(record.actor)
                              ? record.actor
                              : {};

                          const senderName = String(
                            record.senderName ??
                              record.actorName ??
                              sender.fullName ??
                              sender.name ??
                              "إشعار من المنصة",
                          );

                          const message =
                            record.message ??
                            record.body ??
                            record.description ??
                            record.content ??
                            record.text ??
                            record.details;

                          const createdAt =
                            record.createdAt ??
                            record.sentAt ??
                            record.createdOn ??
                            record.date;

                          const details = Object.entries(record).filter(
                            ([key, value]) =>
                              !/(^id$|id$|token|password|image|url|isread|isunread|readat|message|body|description|content|text|details|title|subject|sender|actor|createdat|sentat|createdon|date)/i.test(
                                key,
                              ) &&
                              value !== null &&
                              ["string", "number", "boolean"].includes(
                                typeof value,
                              ),
                          );

                          return (
                            <article
                              key={id === "—" ? index : id}
                              role="button"
                              tabIndex={0}
                              onClick={() => setSelectedNotification(record)}
                              onKeyDown={(event) => {
                                if (
                                  event.key === "Enter" ||
                                  event.key === " "
                                ) {
                                  event.preventDefault();

                                  setSelectedNotification(record);
                                }
                              }}
                              className={`group relative isolate cursor-pointer overflow-hidden rounded-2xl border bg-white shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-nuwa-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nuwa-bright ${
                                unread
                                  ? "border-emerald-200/80"
                                  : "border-stroke"
                              }`}
                            >
                              {unread && (
                                <div
                                  aria-hidden="true"
                                  className="pointer-events-none absolute -left-12 -top-16 -z-10 size-44 rounded-full bg-emerald-100/70 blur-3xl"
                                />
                              )}
                              <div className="p-3 sm:p-4">
                                <div className="flex items-start gap-2.5">
                                  <div className="relative shrink-0 rounded-xl bg-nuwa-soft p-0.5 ring-1 ring-emerald-900/5">
                                    <PersonAvatar
                                      name={senderName}
                                      imageUrl={String(
                                        sender.avatarUrl ??
                                          sender.profileImageUrl ??
                                          "",
                                      )}
                                      size="sm"
                                    />
                                    {unread && (
                                      <span className="absolute -bottom-1 -left-1 size-3 rounded-full border-2 border-white bg-emerald-500 shadow-sm" />
                                    )}
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <div className="flex flex-wrap items-start justify-between gap-3">
                                      <div className="min-w-0">
                                        <div className="mb-1 flex flex-wrap items-center gap-2">
                                          <span
                                            className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                                              unread
                                                ? "bg-emerald-100 text-emerald-800"
                                                : "bg-slate-100 text-slate-500"
                                            }`}
                                          >
                                            {unread ? "جديد" : "مقروء"}
                                          </span>
                                        </div>
                                        <h3 className="break-words text-sm font-bold leading-6 text-ink sm:text-base">
                                          {String(
                                            record.title ??
                                              record.subject ??
                                              record.eventName ??
                                              title,
                                          )}
                                        </h3>
                                        <p className="mt-0.5 text-[11px] text-ink-muted">
                                          {senderName}
                                        </p>
                                      </div>
                                      {createdAt != null && (
                                        <time className="inline-flex shrink-0 items-center gap-1 rounded-full bg-canvas px-2 py-1 text-[10px] font-medium text-ink-muted">
                                          <Clock3 size={12} />
                                          <FormattedCardValue
                                            field="createdAt"
                                            value={createdAt}
                                          />
                                        </time>
                                      )}
                                    </div>
                                    {message != null && (
                                      <p className="mt-2 line-clamp-1 whitespace-pre-wrap break-words text-xs leading-5 text-ink-muted sm:line-clamp-2">
                                        <FormattedCardValue
                                          field="message"
                                          value={message}
                                        />
                                      </p>
                                    )}
                                    {details.length > 0 && (
                                      <dl className="hidden">
                                        {details.map(([key, value]) => (
                                          <div
                                            key={key}
                                            className="min-w-0 rounded-xl border border-stroke/70 bg-white/80 px-3 py-2"
                                          >
                                            <dt className="text-[11px] font-medium text-ink-muted">
                                              {fieldLabels[key] ?? key}
                                            </dt>
                                            <dd className="mt-0.5 break-words text-xs font-semibold text-ink">
                                              <FormattedCardValue
                                                field={key}
                                                value={value}
                                              />
                                            </dd>
                                          </div>
                                        ))}
                                      </dl>
                                    )}
                                  </div>
                                </div>
                                <div className="mt-2 flex items-center justify-end">
                                  <span className="inline-flex items-center gap-1 rounded-full bg-nuwa-ice px-2.5 py-1 text-[10px] font-bold text-nuwa-base transition group-hover:bg-nuwa-soft">
                                    فتح <ArrowUpLeft size={12} />
                                  </span>
                                </div>
                              </div>
                            </article>
                          );
                        }

                        return (
                          <article
                            key={id === "—" ? index : id}
                            className={`flex flex-col justify-between rounded-2xl border p-5 shadow-nuwa transition-all hover:-translate-y-0.5 hover:shadow-nuwa-md ${roleCardTone} ${
                              unread
                                ? "border-emerald-200 bg-emerald-50/50"
                                : ""
                            }`}
                          >
                            <div>
                              {/* Card Header */}
                              <div className="flex items-center justify-between gap-3 border-b border-stroke/60 pb-4">
                                <div className="flex min-w-0 items-center gap-3">
                                  {["students", "teachers"].includes(
                                    activeKey,
                                  ) && (
                                    <PersonAvatar
                                      name={
                                        activeKey === "students"
                                          ? getStudentName(record)
                                          : title
                                      }
                                      imageUrl={String(
                                        record.avatarUrl ??
                                          record.profileImageUrl ??
                                          record.imageUrl ??
                                          "",
                                      )}
                                      size="md"
                                      status={
                                        record.isApproved === true ||
                                        record.isActive === true
                                          ? "active"
                                          : record.isApproved === false
                                            ? "pending"
                                            : undefined
                                      }
                                    />
                                  )}
                                  <div className="min-w-0">
                                    <h3 className="truncate font-bold text-ink sm:text-base">
                                      {activeKey === "students"
                                        ? getStudentName(record)
                                        : title}
                                    </h3>
                                    {["students", "teachers"].includes(
                                      activeKey,
                                    ) && (
                                      <p className="mt-1 truncate text-xs text-ink-muted">
                                        {String(
                                          record.email ??
                                            record.phoneNumber ??
                                            (activeKey === "students"
                                              ? "طالب"
                                              : "مدرس"),
                                        )}
                                      </p>
                                    )}
                                  </div>
                                </div>
                                {activeKey !== "students" && id !== "—" && (
                                  <span className="rounded-md bg-canvas px-2 py-1 font-mono text-[10px] text-ink-muted">
                                    #{id.slice(-6)}
                                  </span>
                                )}
                              </div>

                              {publicationState && (
                                <span
                                  className={`mt-3 inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                                    publicationState === "published"
                                      ? "bg-emerald-100 text-emerald-800"
                                      : publicationState === "draft"
                                        ? "bg-amber-100 text-amber-900"
                                        : "bg-neutral-100 text-neutral-600"
                                  }`}
                                >
                                  {publicationState === "published"
                                    ? "منشورة"
                                    : publicationState === "draft"
                                      ? "مسودة"
                                      : "غير منشورة"}
                                </span>
                              )}
                              {/* Card Key-Value Grid */}
                              <dl
                                className={`mt-4 grid grid-cols-1 gap-x-4 gap-y-3 text-xs sm:grid-cols-2 ${
                                  activeKey === "students" ? "hidden" : ""
                                }`}
                              >
                                {cardFields(record)
                                  .slice(0, 4)

                                  .map(([key, value]) => {
                                    const translatedKey =
                                      fieldLabels[key] || key;

                                    return (
                                      <div
                                        key={key}
                                        className={`rounded-lg p-2.5 ${roleCellTone}`}
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
                                    );
                                  })}
                              </dl>
                              {activeKey === "students" ? (
                                <StudentDetailsCard
                                  record={record}
                                  academicYears={academicYears}
                                />
                              ) : (
                                cardFields(record).length > 4 && (
                                  <details className="mt-3 rounded-xl border border-neutral-200 bg-white">
                                    <summary className="cursor-pointer px-3 py-2.5 text-xs font-bold text-nuwa-base">
                                      عرض تفاصيل أكثر (
                                      {cardFields(record).length - 4})
                                    </summary>
                                    <dl className="grid gap-2 border-t border-neutral-100 p-3 sm:grid-cols-2">
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
                                    className={`${
                                      publicationState === "published"
                                        ? "hidden"
                                        : ""
                                    } rounded-lg bg-nuwa-base px-3 py-2 text-xs font-semibold text-white disabled:opacity-50`}
                                  >
                                    نشر الدورة
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      void handleCoursePublish(id, false)
                                    }
                                    disabled={actionLoading === `${id}-publish`}
                                    className={`${
                                      publicationState !== "published"
                                        ? "hidden"
                                        : ""
                                    } rounded-lg border border-stroke px-3 py-2 text-xs font-semibold text-ink disabled:opacity-50`}
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
                                      const year = record.academicYear;

                                      const yearValue =
                                        typeof year === "object" &&
                                        year !== null
                                          ? ((year as Record<string, unknown>)
                                              .value ??
                                            (year as Record<string, unknown>)
                                              .id)
                                          : year;

                                      setSubjectId(id);

                                      setSubjectName(String(record.name ?? ""));

                                      setSubjectYear(
                                        String(
                                          yearValue ??
                                            academicYears[0]?.value ??
                                            "1",
                                        ),
                                      );

                                      setSubjectIsActive(
                                        record.isActive !== false,
                                      );
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
                              <div className="mt-4 flex items-center justify-between gap-3 border-t border-stroke/60 pt-3">
                                {unread ? (
                                  <button
                                    onClick={() => void handleMarkRead(id)}
                                    disabled={actionLoading === `read-${id}`}
                                    className="text-xs font-semibold text-nuwa-base transition-colors hover:underline disabled:opacity-50"
                                  >
                                    تحديد كمقروء ✓
                                  </button>
                                ) : (
                                  <span className="text-xs text-ink-muted">
                                    مقروء
                                  </span>
                                )}
                                <button
                                  type="button"
                                  onClick={() =>
                                    void handleNotificationDelete(id)
                                  }
                                  disabled={
                                    actionLoading ===
                                    `delete-notification-${id}`
                                  }
                                  aria-label={`حذف الإشعار: ${title}`}
                                  className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-red-700 transition hover:bg-red-100 disabled:opacity-50"
                                >
                                  <Trash2 size={14} /> حذف
                                </button>
                              </div>
                            )}
                          </article>
                        );
                      })}
                    </div>
                  )}
                </ApiQueryState>
              )}
              {pagination && (
                <CoursePagination
                  page={Number(pagination.page ?? page)}
                  totalPages={pagination.totalPages}
                  disabled={loading}
                  onPageChange={setPage}
                  label={
                    activeKey === "courses" ? "صفحات الدورات" : "صفحات النتائج"
                  }
                />
              )}
            </div>
          </main>
          {selectedNotification &&
            (() => {
              const notificationId = String(
                selectedNotification.id ??
                  selectedNotification.notificationId ??
                  "",
              );

              const notificationTitle = String(
                selectedNotification.title ??
                  selectedNotification.subject ??
                  selectedNotification.eventName ??
                  "إشعار من المنصة",
              );

              const notificationMessage =
                selectedNotification.message ??
                selectedNotification.body ??
                selectedNotification.description ??
                selectedNotification.content ??
                selectedNotification.text ??
                selectedNotification.details;

              const notificationDate =
                selectedNotification.createdAt ??
                selectedNotification.sentAt ??
                selectedNotification.createdOn ??
                selectedNotification.date;

              const notificationSender = isRecord(selectedNotification.sender)
                ? selectedNotification.sender
                : isRecord(selectedNotification.actor)
                  ? selectedNotification.actor
                  : {};

              const notificationSenderName = String(
                selectedNotification.senderName ??
                  selectedNotification.actorName ??
                  notificationSender.fullName ??
                  notificationSender.name ??
                  "إشعار من المنصة",
              );

              const notificationDetails = Object.entries(
                selectedNotification,
              ).filter(
                ([key, value]) =>
                  !/(^id$|id$|token|password|image|url|isread|isunread|readat|message|body|description|content|text|details|title|subject|sender|actor|createdat|sentat|createdon|date)/i.test(
                    key,
                  ) &&
                  value !== null &&
                  ["string", "number", "boolean"].includes(typeof value),
              );

              return (
                <NotificationDialog
                  title={notificationTitle}
                  sender={notificationSenderName}
                  date={
                    notificationDate != null ? (
                      <FormattedCardValue
                        field="createdAt"
                        value={notificationDate}
                      />
                    ) : undefined
                  }
                  unread={isUnreadNotification(selectedNotification)}
                  busy={actionLoading !== null || !notificationId}
                  onClose={() => setSelectedNotification(null)}
                  onMarkRead={() => {
                    if (!notificationId) return;

                    void handleMarkRead(notificationId).then((success) => {
                      if (success) setSelectedNotification(null);
                    });
                  }}
                  onDelete={() => {
                    if (!notificationId) return;

                    void handleNotificationDelete(notificationId).then(
                      (success) => {
                        if (success) setSelectedNotification(null);
                      },
                    );
                  }}
                >
                  {notificationMessage != null && (
                    <p className="whitespace-pre-wrap break-words rounded-2xl border border-stroke/70 bg-canvas/60 px-4 py-4 text-sm leading-7 text-ink">
                      <FormattedCardValue
                        field="message"
                        value={notificationMessage}
                      />
                    </p>
                  )}
                  {notificationDetails.length > 0 && (
                    <dl className="mt-4 grid gap-2 sm:grid-cols-2">
                      {notificationDetails.map(([key, value]) => (
                        <div
                          key={key}
                          className="min-w-0 rounded-xl border border-stroke/70 bg-white px-3 py-2.5"
                        >
                          <dt className="text-[11px] font-medium text-ink-muted">
                            {fieldLabels[key] ?? key}
                          </dt>
                          <dd className="mt-1 break-words text-xs font-semibold text-ink">
                            <FormattedCardValue field={key} value={value} />
                          </dd>
                        </div>
                      ))}
                    </dl>
                  )}
                  {notificationMessage == null &&
                    notificationDetails.length === 0 && (
                      <p className="text-sm leading-7 text-ink-muted">
                        لا يوجد محتوى إضافي لهذا الإشعار.
                      </p>
                    )}
                </NotificationDialog>
              );
            })()}
          <CourseEnrollmentContactDialog
            course={pendingCourseDialog}
            onClose={() => setPendingCourseDialog(null)}
            navigate={navigate}
            isPending
            onEnrollmentRequested={reloadData}
            onEnrollmentCancelled={handleCourseEnrollmentCancelled}
          />
          <PlatformFooter navigate={navigate} dashboard />
        </div>
      </div>
    </div>
  );
}
