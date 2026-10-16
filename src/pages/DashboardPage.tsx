import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react"

import {
  ArrowUpLeft,
  Bell,
  BookOpen,
  BookOpenCheck,
  CheckCircle2,
  Clock3,
  ClipboardList,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings2,
  ShieldCheck,
  UsersRound,
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

import NuwaLogo from "../components/NuwaLogo"

import { getAcademicYears, type AcademicYearResponse } from "../api/catalog"

import RoleForms from "../components/dashboard/RoleForms"

import TeacherEnrollmentRequests from "../components/dashboard/TeacherEnrollmentRequests"

import { mockTeacherEnrollmentRequests } from "../mocks/teacherEnrollmentRequests"

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

function getSections(
  role: string,
  query: PageQuery,
  enrollmentPreview = false,
): Section[] {
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

        load: async () => {
          if (enrollmentPreview) {
            return {
              profile: { firstName: "Ahmed", lastName: "Hassan" },
              stats: { totalCourses: 4, totalStudents: 86, pendingRequests: 3 },
            }
          }

          const [profileResult, statsResult] = await Promise.allSettled([
            teachersApi.me(),

            teachersApi.stats(),
          ])

          if (profileResult.status === "rejected") throw profileResult.reason

          return {
            profile: profileResult.value,

            stats:
              statsResult.status === "fulfilled" ? statsResult.value : null,
          }
        },
      },

      {
        key: "courses",

        label: "دوراتي",

        load: () =>
          enrollmentPreview
            ? Promise.resolve({ items: [] })
            : teachersApi.coursesMine(query),
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
            return { requests: mockTeacherEnrollmentRequests, courses: [] }
          }

          const [requestsResult, coursesResult] = await Promise.allSettled([
            teachersApi.enrollmentRequests(query),

            teachersApi.coursesMine({ page: 1, pageSize: 100 }),
          ])

          if (requestsResult.status === "rejected") throw requestsResult.reason

          return {
            requests: requestsResult.value,

            courses:
              coursesResult.status === "fulfilled" ? coursesResult.value : null,
          }
        },
      },
    ]
  }

  return [
    {
      key: "overview",
      label: "نظرة عامة",
      load: async () => {
        const [profile, enrollments] = await Promise.all([
          studentsApi.me(),
          studentsApi.enrollments({ page: 1, pageSize: 4 }),
        ])

        return { profile, enrollments }
      },
    },
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

function profileDisplayName(value: unknown): string | null {
  if (!isRecord(value)) return null

  const candidates = [value, value.user, value.teacher, value.student]
  for (const candidate of candidates) {
    if (!isRecord(candidate)) continue

    const direct = candidate.fullName ?? candidate.displayName ?? candidate.name
    if (typeof direct === "string" && direct.trim()) return direct.trim()

    const parts = [
      candidate.firstName,
      candidate.secondName,
      candidate.thirdName,
      candidate.lastName,
    ].filter(
      (part): part is string =>
        typeof part === "string" && part.trim().length > 0,
    )
    if (parts.length) return parts.join(" ")
  }

  return null
}

function getRecords(data: unknown): Record<string, unknown>[] {
  if (Array.isArray(data)) return data.filter(isRecord)

  if (isRecord(data) && Array.isArray(data.items))
    return data.items.filter(isRecord)

  return isRecord(data) ? [data] : []
}

function getEnrollmentRecords(data: unknown): Record<string, unknown>[] {
  if (Array.isArray(data))
    return data.filter(
      (enrollment): enrollment is Record<string, unknown> =>
        isRecord(enrollment) &&
        !isRejectedEnrollment(enrollment.status, enrollment.isRejected),
    )
  if (!isRecord(data)) return []
  if (Array.isArray(data.items))
    return data.items.filter(
      (enrollment): enrollment is Record<string, unknown> =>
        isRecord(enrollment) &&
        !isRejectedEnrollment(enrollment.status, enrollment.isRejected),
    )
  if ("enrollments" in data) return getEnrollmentRecords(data.enrollments)
  return []
}

function isRejectedEnrollment(status: unknown, isRejected?: unknown): boolean {
  return (
    isRejected === true || /reject|declin|cancel/i.test(String(status ?? ""))
  )
}

function enrollmentStatusLabel(status: unknown, isApproved?: unknown): string {
  const value = String(status ?? "").toLowerCase()

  if (/reject|declin|cancel/.test(value)) return "غير نشط"
  if (isApproved === false) return "بانتظار الموافقة"
  if (/pending|await|review/.test(value)) return "بانتظار الموافقة"
  if (/complete|finish/.test(value)) return "مكتملة"
  if (/approv|active|accept|enroll/.test(value)) return "مشترك"

  return status ? String(status) : "الحالة غير محددة"
}

function getAdminMetrics(data: unknown) {
  if (!isRecord(data)) return []

  const entries: { key: string; value: number; parent: string }[] = []

  function collect(record: Record<string, unknown>, parent = "", depth = 0) {
    if (depth > 3) return

    Object.entries(record).forEach(([key, value]) => {
      if (
        typeof value === "number" &&
        Number.isFinite(value) &&
        !/(^id$|token|password|price|duration|date|time)/i.test(key)
      ) {
        entries.push({ key, value, parent })
      } else if (isRecord(value)) {
        collect(value, key, depth + 1)
      }
    })
  }

  collect(data)

  const metrics = entries.map(({ key, value, parent }) => {
    const statKey = `${parent} ${key}`.toLowerCase()
    const isPending = /pending|await|unapproved/.test(statKey)
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
                : `${parent ? `${parent} · ` : ""}${fieldLabels[key] ?? key}`

    const Icon = isPending
      ? ClipboardList
      : /student|teacher/.test(statKey)
        ? UsersRound
        : /course|subject/.test(statKey)
          ? BookOpenCheck
          : BookOpen

    return { key: `${parent}-${key}`, label, value, Icon }
  })

  return metrics.slice(0, 6)
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
  const useTeacherEnrollmentMock =
    import.meta.env.DEV &&
    new URLSearchParams(window.location.search).get("teacherEnrollmentMock") ===
      "1"

  const role = useTeacherEnrollmentMock
    ? "teacher"
    : (window.sessionStorage.getItem("eduhub.auth.role") ?? "student")

  const [page, setPage] = useState(1)

  const [searchInput, setSearchInput] = useState("")

  const [search, setSearch] = useState("")

  const query: PageQuery = { page, pageSize: 12, ...(search ? { search } : {}) }

  const [activeKey, setActiveKey] = useState(() =>
    useTeacherEnrollmentMock
      ? "enrollments"
      : getSections(role, query, useTeacherEnrollmentMock)[0].key,
  )

  const [reloadKey, setReloadKey] = useState(0)

  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  const [focusStudentCourseId, setFocusStudentCourseId] =
    useState<string | null>(null)

  const [actionLoading, setActionLoading] = useState<string | null>(null)

  const [, setActionFeedbackState] = useState("")

  const setActionFeedback = useCallback((message: string) => {
    setActionFeedbackState(message)

    if (!message.trim()) return

    if (/تم|نجاح|اعتماد/.test(message)) notifySuccess(message)
    else notifyError(new Error(message), "تعذر إتمام العملية. حاول مرة أخرى.")
  }, [])

  const reloadData = useCallback(() => {
    setReloadKey((key) => key + 1)
  }, [])

  const clearFocusedStudentCourse = useCallback(() => {
    setFocusStudentCourseId(null)
  }, [])

  const handleMockEnrollment = useCallback(
    async (_id: string, approve: boolean) => {
      setActionFeedback(
        approve ? "تمت الموافقة على الطلب التجريبي." : "تم رفض الطلب التجريبي.",
      )

      return true
    },

    [setActionFeedback],
  )

  const [subjectName, setSubjectName] = useState("")

  const [subjectYear, setSubjectYear] = useState("1")

  const [subjectId, setSubjectId] = useState("")

  const [subjectIsActive, setSubjectIsActive] = useState(true)

  const [academicYears, setAcademicYears] = useState<AcademicYearResponse[]>([])

  const sections = useMemo(
    () => getSections(role, query, useTeacherEnrollmentMock),
    [role, page, search, useTeacherEnrollmentMock],
  )

  const section = sections.find(({ key }) => key === activeKey) ?? sections[0]

  const { data, error, loading } = useApiQuery(section.load, reloadKey)

  const [accountName, setAccountName] = useState(
    () => window.sessionStorage.getItem("eduhub.auth.name") ?? "",
  )

  useEffect(() => {
    const profile = isRecord(data) ? (data.profile ?? data) : data
    const name = profileDisplayName(profile)
    if (!name) return

    window.sessionStorage.setItem("eduhub.auth.name", name)
    setAccountName(name)
  }, [data])

  useEffect(() => {
    if (!mobileNavOpen) return

    const previousOverflow = document.body.style.overflow
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileNavOpen(false)
    }

    document.body.style.overflow = "hidden"
    window.addEventListener("keydown", closeOnEscape)

    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener("keydown", closeOnEscape)
    }
  }, [mobileNavOpen])

  const records = getRecords(data)

  const teacherStats =
    role.includes("teacher") &&
    activeKey === "overview" &&
    isRecord(data) &&
    isRecord(data.stats)
      ? Object.entries(data.stats).filter(
          ([key, value]) =>
            !/(id|token|password)/i.test(key) &&
            (typeof value === "number" || typeof value === "boolean"),
        )
      : []

  const adminMetrics =
    role.includes("admin") && activeKey === "stats" ? getAdminMetrics(data) : []

  const studentOverview =
    !role.includes("admin") &&
    !role.includes("teacher") &&
    activeKey === "overview" &&
    isRecord(data)
      ? data
      : null
  const studentOverviewCourses = getEnrollmentRecords(
    studentOverview?.enrollments,
  ).slice(0, 4)
  const studentEnrollmentTotal = studentOverviewCourses.length

  const paginationData =
    role.includes("teacher") &&
    activeKey === "enrollments" &&
    isRecord(data) &&
    isRecord(data.requests)
      ? data.requests
      : data

  const pagination =
    isRecord(paginationData) && typeof paginationData.totalPages === "number"
      ? { page: paginationData.page, totalPages: paginationData.totalPages }
      : null

  const showGenericRecords =
    !(role.includes("admin") && activeKey === "stats") &&
    !(
      role.includes("teacher") && ["overview", "courses"].includes(activeKey)
    ) &&
    studentOverview === null &&
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
    if (
      !role.includes("admin") &&
      !role.includes("teacher") &&
      activeKey !== "profile"
    )
      return

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
  }, [role, activeKey])

  async function handleEnrollment(
    id: string,

    approve: boolean,
  ): Promise<boolean> {
    if (
      !approve &&
      role.includes("admin") &&
      !window.confirm("هل تريد رفض طلب الالتحاق؟")
    )
      return false

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

      return true
    } catch (cause) {
      setActionFeedback(
        cause instanceof Error ? cause.message : "تعذر تحديث الطلب.",
      )

      return false
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
    window.sessionStorage.removeItem("eduhub.auth.name")

    navigate("landing")
  }

  const roleCardTone = role.includes("admin")
    ? "border-nuwa-base/15 bg-white"
    : role.includes("teacher")
      ? "border-blue-100 bg-blue-50/70"
      : "border-emerald-100 bg-emerald-50/70"

  const roleCellTone = role.includes("admin")
    ? "bg-nuwa-soft"
    : role.includes("teacher")
      ? "bg-blue-100/45"
      : "bg-emerald-100/45"

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
    <div className="min-h-dvh bg-canvas pb-10 dir-rtl sm:pb-16">
      {/* Top Header Navigation */}
      <header
        className={`relative z-30 border-b-2 bg-surface/95 backdrop-blur-md lg:sticky lg:top-0 ${
          role.includes("admin")
            ? "border-nuwa-base"
            : role.includes("teacher")
              ? "border-blue-400"
              : "border-emerald-400"
        }`}
      >
        <div
          dir="ltr"
          className="mx-auto flex min-h-[68px] max-w-7xl items-center justify-between gap-2 px-3 py-2 sm:gap-4 sm:px-6 sm:py-3 lg:px-8"
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
            <NuwaLogo size="sm" className="shrink-0" />
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
            <div className="hidden">
              <div className="flex items-center gap-2">
                <h1 className="truncate text-base font-bold text-ink sm:text-xl">
                  {roleBadge.title}
                </h1>
              </div>
              <p className="max-w-[42vw] truncate text-[10px] text-ink-muted sm:max-w-none sm:text-xs">
                {accountName ? `أهلًا ${accountName} · ` : ""}مرحبًا بك في منصة
                وَعي
              </p>
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
      <div className="flex min-h-[calc(100dvh-68px)]">
        {mobileNavOpen && (
          <button
            type="button"
            aria-label="إغلاق القائمة"
            onClick={() => setMobileNavOpen(false)}
            className="fixed inset-0 z-40 bg-slate-950/45 backdrop-blur-[2px] lg:hidden"
          />
        )}
        <aside
          id="dashboard-sidebar"
          aria-label="القائمة الرئيسية"
          className={`fixed inset-y-0 right-0 left-auto z-50 h-dvh w-[min(86vw,320px)] overflow-y-auto overscroll-contain border-l border-stroke bg-white p-4 shadow-2xl transition-transform duration-200 lg:fixed lg:inset-y-auto lg:right-0 lg:left-auto lg:top-[68px] lg:z-20 lg:h-[calc(100dvh-68px)] lg:w-64 lg:translate-x-0 lg:shadow-none ${
            mobileNavOpen ? "translate-x-0" : "translate-x-full"
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
            <p className="text-xs font-semibold text-white/75">
              {roleBadge.title}
            </p>
            {accountName && (
              <p className="mt-1 truncate text-sm font-bold">{accountName}</p>
            )}
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

                "student-progress": UsersRound,

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
          <button
            type="button"
            onClick={signOut}
            className="mt-3 flex w-full items-center gap-3 rounded-xl px-3 py-3 text-start text-sm font-semibold text-danger transition hover:bg-red-50"
          >
            <LogOut size={18} />
            تسجيل الخروج
          </button>
        </aside>
        <main className="min-w-0 flex-1 px-3 pb-8 pt-4 sm:px-6 sm:pt-6 lg:mr-64 lg:px-8">
          <div className="mx-auto max-w-7xl">
            {/* Action Header */}
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-stroke bg-surface p-4 shadow-sm sm:gap-4 sm:p-5">
              <div>
                <h1 className="text-lg font-bold text-ink sm:text-xl">
                  {roleBadge.title}
                </h1>
                <p className="mt-0.5 text-xs text-ink-muted sm:text-sm">
                  {accountName ? `أهلًا ${accountName} · ` : "أهلًا بك · "}
                  مرحبًا بك في منصة وَعي
                </p>
              </div>

              <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
                {activeKey === "notifications" && (
                  <button
                    onClick={() => void handleMarkRead()}
                    disabled={actionLoading === "read-all"}
                    className="flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-lg border border-stroke bg-canvas px-3 py-2 text-xs font-semibold text-ink transition-all hover:bg-surface active:scale-95 disabled:opacity-50 sm:flex-none"
                  >
                    قراءة الكل
                  </button>
                )}
                <button
                  onClick={() => setReloadKey((key) => key + 1)}
                  className="flex min-h-10 flex-1 items-center justify-center gap-1.5 rounded-lg bg-nuwa-base px-3.5 py-2 text-xs font-semibold text-white transition-all hover:bg-nuwa-deep active:scale-95 sm:flex-none"
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
              {teacherStats.length > 0 && (
                <dl className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  {teacherStats.map(([key, value]) => (
                    <div
                      key={key}
                      className={`rounded-xl border p-4 shadow-sm ${roleCardTone}`}
                    >
                      <dt className="text-sm font-medium text-ink-muted">
                        {fieldLabels[key] ?? key}
                      </dt>
                      <dd className="mt-2 text-2xl font-bold text-nuwa-deep">
                        {formatValue(key, value)}
                      </dd>
                    </div>
                  ))}
                </dl>
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
                            تابع المؤشرات الرئيسية وانتقل مباشرةً إلى أدوات إدارة
                            المنصة.
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
                          {adminMetrics.map(({ key, label, value, Icon }) => (
                            <div
                              key={key}
                              className="flex items-center gap-4 rounded-xl border border-stroke bg-canvas/70 p-4"
                            >
                              <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-nuwa-soft text-nuwa-base">
                                <Icon size={20} />
                              </span>
                              <div className="min-w-0">
                                <dt className="truncate text-sm font-medium text-ink-muted">
                                  {label}
                                </dt>
                                <dd className="mt-1 text-2xl font-bold tabular-nums text-ink">
                                  {formatValue(key, value)}
                                </dd>
                              </div>
                            </div>
                          ))}
                        </dl>
                      ) : (
                        <p className="rounded-xl border border-dashed border-stroke-strong px-4 py-6 text-center text-sm text-ink-muted">
                          لا تتوفر مؤشرات رقمية لعرضها حالياً.
                        </p>
                      )}
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
                                setActiveKey(key)
                                setPage(1)
                                setSearch("")
                                setSearchInput("")
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
                    {(() => {
                      const pendingCount = studentOverviewCourses.filter(
                        (enrollment) =>
                          enrollment.isApproved === false ||
                          /pending|await|review/i.test(
                            String(enrollment.status ?? ""),
                          ),
                      ).length
                      const progressValues = studentOverviewCourses
                        .filter(
                          (enrollment) =>
                            enrollment.isApproved !== false &&
                            !/pending|await|review|reject|declin|cancel/i.test(
                              String(enrollment.status ?? ""),
                            ),
                        )
                        .map((enrollment) =>
                          Number(enrollment.progressPercentage),
                        )
                        .filter(
                          (value) =>
                            Number.isFinite(value) &&
                            value >= 0 &&
                            value <= 100,
                        )
                      const averageProgress = progressValues.length
                        ? Math.round(
                            progressValues.reduce(
                              (total, value) => total + value,
                              0,
                            ) / progressValues.length,
                          )
                        : 0

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
                                    {value}
                                  </dd>
                                </div>
                              </div>
                            ))}
                          </dl>
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
                                setFocusStudentCourseId(null)
                                setActiveKey("courses")
                                setPage(1)
                                setSearch("")
                                setSearchInput("")
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
                                    : {}
                                  const courseId =
                                    enrollment.courseId ??
                                    course.id ??
                                    course.courseId
                                  const title =
                                    enrollment.courseTitle ??
                                    enrollment.courseName ??
                                    course.title ??
                                    course.name ??
                                    `دورة ${index + 1}`
                                  const progressValue = Number(
                                    enrollment.progressPercentage ?? 0,
                                  )
                                  const progressPercent = Number.isFinite(
                                    progressValue,
                                  )
                                    ? Math.max(0, Math.min(100, progressValue))
                                    : 0
                                  const teacher = isRecord(enrollment.teacher)
                                    ? enrollment.teacher
                                    : isRecord(course.teacher)
                                      ? course.teacher
                                      : {}
                                  const teacherName =
                                    enrollment.teacherName ??
                                    course.teacherName ??
                                    teacher.fullName ??
                                    teacher.name
                                  const canOpenCourse =
                                    enrollment.isApproved !== false &&
                                    !/pending|await|review|reject|declin|cancel/i.test(
                                      String(enrollment.status ?? ""),
                                    )

                                  return (
                                    <article
                                      key={String(
                                        enrollment.id ?? courseId ?? index,
                                      )}
                                      className="rounded-xl border border-stroke bg-white p-4 shadow-nuwa transition hover:-translate-y-0.5 hover:border-nuwa-base/40 hover:shadow-nuwa-md"
                                    >
                                      <div className="flex items-start justify-between gap-3">
                                        <h5 className="font-bold leading-6 text-ink">
                                          {String(title)}
                                        </h5>
                                        <span className="shrink-0 rounded-full bg-nuwa-soft px-2.5 py-1 text-[11px] font-semibold text-nuwa-base">
                                          {enrollmentStatusLabel(
                                            enrollment.status,
                                            enrollment.isApproved,
                                          )}
                                        </span>
                                      </div>
                                      {teacherName !== undefined &&
                                        teacherName !== null &&
                                        String(teacherName).trim() && (
                                          <p className="mt-2 text-xs text-ink-muted">
                                            المعلم: {String(teacherName)}
                                          </p>
                                        )}
                                      <div className="mt-4 flex items-center justify-between text-xs text-ink-muted">
                                        <span>التقدم في الدورة</span>
                                        <span className="font-bold tabular-nums text-ink">
                                          {Math.round(progressPercent)}%
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
                                        <div
                                          className="h-full rounded-full bg-nuwa-base transition-[width]"
                                          style={{
                                            width: `${progressPercent}%`,
                                          }}
                                        />
                                      </div>
                                      {courseId !== undefined &&
                                        canOpenCourse && (
                                          <button
                                            type="button"
                                            onClick={() => {
                                              setFocusStudentCourseId(
                                                String(courseId),
                                              )
                                              setActiveKey("courses")
                                              setPage(1)
                                              setSearch("")
                                              setSearchInput("")
                                            }}
                                            className="mt-4 w-full rounded-lg bg-nuwa-soft px-3 py-2 text-sm font-semibold text-nuwa-base transition hover:bg-nuwa-base hover:text-white"
                                          >
                                            متابعة هذه الدورة
                                          </button>
                                        )}
                                    </article>
                                  )
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
                      )
                    })()}
                  </div>
                </section>
              )}
              <RoleForms
                role={role}
                section={activeKey}
                data={data}
                onSaved={reloadData}
                onFeedback={setActionFeedback}
                focusCourseId={focusStudentCourseId}
                onFocusCourseHandled={clearFocusedStudentCourse}
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
              {role.includes("teacher") && activeKey === "enrollments" ? (
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
                            className={`flex flex-col justify-between rounded-2xl border p-5 shadow-nuwa transition-all hover:-translate-y-0.5 hover:shadow-nuwa-md ${roleCardTone}`}
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
                                    const translatedKey =
                                      fieldLabels[key] || key

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
                                        typeof year === "object" &&
                                        year !== null
                                          ? ((year as Record<string, unknown>)
                                              .value ??
                                            (year as Record<string, unknown>)
                                              .id)
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
              )}
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
