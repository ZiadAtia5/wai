import { useEffect, useMemo, useState } from "react"

import {
  BookOpen,
  Check,
  ChevronDown,
  Clock3,
  Search,
  UserRound,
  UsersRound,
  X,
} from "lucide-react"

type RequestStatus = "pending" | "approved" | "rejected"

type FilterStatus = "all" | RequestStatus

interface EnrollmentRequest {
  id: string

  studentName: string

  email: string

  phone: string

  requestedAt: string | null

  status: RequestStatus

  note: string

  avatarUrl: string
}

interface CourseRequests {
  id: string

  title: string

  category: string

  thumbnail: string

  requests: EnrollmentRequest[]
}

interface TeacherEnrollmentRequestsProps {
  data: unknown

  loading: boolean

  error: string | null

  onRetry: () => void

  onDecision: (requestId: string, approve: boolean) => Promise<boolean>
}

interface EnrollmentFilter {
  id: FilterStatus

  label: string
}

function CourseThumbnail({ src }: { src: string }) {
  const [failed, setFailed] = useState(false)

  useEffect(() => setFailed(false), [src])

  return src && !failed ? (
    <img
      src={src}
      alt=""
      className="size-full object-cover"
      onError={() => setFailed(true)}
    />
  ) : (
    <div className="grid size-full place-items-center text-slate-400">
      <BookOpen size={24} aria-hidden="true" />
    </div>
  )
}

function StudentAvatar({ src }: { src: string }) {
  const [failed, setFailed] = useState(false)

  useEffect(() => setFailed(false), [src])

  return src && !failed ? (
    <img
      src={src}
      alt=""
      className="size-full object-cover"
      onError={() => setFailed(true)}
    />
  ) : (
    <UserRound size={21} aria-hidden="true" />
  )
}

const filters: EnrollmentFilter[] = [
  { id: "all", label: "كل الدورات" },

  { id: "pending", label: "قيد المراجعة" },

  { id: "approved", label: "تمت الموافقة" },

  { id: "rejected", label: "مرفوضة" },
]

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null
    ? value as Record<string, unknown>
    : {}
}

function asList(value: unknown): unknown[] {
  if (Array.isArray(value)) return value

  const record = asRecord(value)

  if (Array.isArray(record.items)) return record.items

  if (Array.isArray(record.requests)) return record.requests

  if (record.data !== undefined) return asList(record.data)

  return []
}

function text(...values: unknown[]): string {
  const value = values.find(
    (item) => typeof item === "string" || typeof item === "number",
  )

  return value === undefined || value === null ? "" : String(value).trim()
}

function statusOf(value: unknown): RequestStatus {
  const status = String(value ?? "pending")

    .trim()

    .toLowerCase()

  if (["approved", "accepted", "1"].includes(status)) return "approved"

  if (["rejected", "declined", "2"].includes(status)) return "rejected"

  return "pending"
}

function requestFrom(
  value: unknown,

  index: number,

  courseId = "request",
): EnrollmentRequest {
  const request = asRecord(value)

  const student = asRecord(request.student)

  const studentName = text(
    request.studentName,

    request.fullName,

    student.fullName,

    student.name,

    [student.firstName, student.lastName].filter(Boolean).join(" "),

    request.name,
  )

  return {
    id:
      text(request.requestId, request.enrollmentId, request.id) ||
      `${courseId}-request-${index}`,

    studentName: studentName || "طالب بدون اسم",

    email: text(request.studentEmail, request.email, student.email),

    phone: text(
      request.studentPhone,

      request.phoneNumber,

      request.phone,

      student.phoneNumber,
    ),

    requestedAt:
      text(request.requestedAt, request.createdAt, request.enrolledAt) || null,

    status: statusOf(request.status ?? request.enrollmentStatus),

    note: text(request.note, request.message, request.studentMessage),

    avatarUrl: text(
      request.avatarUrl,

      request.profileImageUrl,

      student.avatarUrl,

      student.profileImageUrl,
    ),
  }
}

function normalizeCourses(value: unknown): CourseRequests[] {
  const root = asRecord(value)

  const source = asList(root.requests ?? value)

  const grouped: CourseRequests[] = []

  const byCourse = new Map<string, CourseRequests>()

  source.forEach((item, index) => {
    const record = asRecord(item)

    const nestedCourse = asRecord(record.course)

    const nestedRequests = record.requests ?? record.enrollmentRequests

    if (Array.isArray(nestedRequests)) {
      const courseId =
        text(record.courseId, nestedCourse.id, record.id) || `course-${index}`

      grouped.push({
        id: courseId,

        title:
          text(
            record.courseTitle,

            record.title,

            nestedCourse.title,

            nestedCourse.name,
          ) || "دورة بدون عنوان",

        category: text(
          record.category,

          record.subjectName,

          nestedCourse.category,

          nestedCourse.subjectName,
        ),

        thumbnail: text(
          record.thumbnail,

          record.coverImageUrl,

          nestedCourse.thumbnail,

          nestedCourse.coverImageUrl,
        ),

        requests: nestedRequests.map((request, requestIndex) =>
          requestFrom(request, requestIndex, courseId),
        ),
      })

      return
    }

    const courseId = text(record.courseId, nestedCourse.id) || "unassigned"

    let course = byCourse.get(courseId)

    if (!course) {
      course = {
        id: courseId,

        title:
          text(record.courseTitle, nestedCourse.title, nestedCourse.name) ||
          "دورة بدون عنوان",

        category: text(
          record.category,

          record.subjectName,

          nestedCourse.category,

          nestedCourse.subjectName,
        ),

        thumbnail: text(
          record.courseThumbnail,

          record.coverImageUrl,

          nestedCourse.thumbnail,

          nestedCourse.coverImageUrl,
        ),

        requests: [],
      }

      byCourse.set(courseId, course)

      grouped.push(course)
    }

    course.requests.push(requestFrom(record, index))
  })

  asList(root.courses).forEach((item, index) => {
    const record = asRecord(item)

    const nestedCourse = asRecord(record.course)

    const courseId =
      text(record.courseId, nestedCourse.id, record.id) || `course-${index}`

    let course =
      byCourse.get(courseId) ?? grouped.find((item) => item.id === courseId)

    if (!course) {
      course = {
        id: courseId,

        title:
          text(
            record.courseTitle,
            record.title,
            nestedCourse.title,
            nestedCourse.name,
          ) || "Course",

        category: text(
          record.category,
          record.subjectName,
          nestedCourse.category,
          nestedCourse.subjectName,
        ),

        thumbnail: text(
          record.thumbnail,
          record.coverImageUrl,
          nestedCourse.thumbnail,
          nestedCourse.coverImageUrl,
        ),

        requests: [],
      }

      byCourse.set(courseId, course)

      grouped.push(course)

      return
    }

    course.title =
      text(
        record.courseTitle,
        record.title,
        nestedCourse.title,
        nestedCourse.name,
      ) || course.title

    course.category =
      text(
        record.category,
        record.subjectName,
        nestedCourse.category,
        nestedCourse.subjectName,
      ) || course.category

    course.thumbnail =
      text(
        record.thumbnail,
        record.coverImageUrl,
        nestedCourse.thumbnail,
        nestedCourse.coverImageUrl,
      ) || course.thumbnail
  })

  return grouped
}

function formatDate(value: string | null): string {
  if (!value) return "التاريخ غير متاح"

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) return "التاريخ غير متاح"

  return new Intl.DateTimeFormat("ar-EG", {
    dateStyle: "medium",

    timeStyle: "short",
  }).format(date)
}

function statusLabel(status: RequestStatus): string {
  if (status === "approved") return "تمت الموافقة"

  if (status === "rejected") return "مرفوض"

  return "قيد المراجعة"
}

function statusClasses(status: RequestStatus): string {
  if (status === "approved")
    return "bg-emerald-50 text-emerald-700 ring-emerald-600/15"

  if (status === "rejected") return "bg-rose-50 text-rose-700 ring-rose-600/15"

  return "bg-amber-50 text-amber-700 ring-amber-600/15"
}

export default function TeacherEnrollmentRequests({
  data,

  loading,

  error,

  onRetry,

  onDecision,
}: TeacherEnrollmentRequestsProps) {
  const [query, setQuery] = useState("")

  const [filter, setFilter] = useState<FilterStatus>("all")

  const [expandedCourses, setExpandedCourses] = useState<Set<string>>(
    () => new Set(),
  )

  const [statusOverrides, setStatusOverrides] =
    useState<Record<string, RequestStatus>>({})

  const [busyRequests, setBusyRequests] = useState<string[]>([])

  const courses = useMemo(() => normalizeCourses(data), [data])

  useEffect(() => {
    if (courses.length) {
      setExpandedCourses((current) =>
        current.size ? current : new Set([courses[0].id]),
      )
    }
  }, [courses])

  const requests = useMemo(
    () =>
      courses.flatMap((course) =>
        course.requests.map((request) => ({
          ...request,

          status: statusOverrides[request.id] ?? request.status,
        })),
      ),

    [courses, statusOverrides],
  )

  const counts = useMemo(
    () => ({
      all: requests.length,

      pending: requests.filter((request) => request.status === "pending")
        .length,

      approved: requests.filter((request) => request.status === "approved")
        .length,

      rejected: requests.filter((request) => request.status === "rejected")
        .length,
    }),

    [requests],
  )

  const search = query.trim().toLocaleLowerCase("ar-EG")

  const visibleCourses = courses

    .map((course) => ({
      ...course,

      requests: course.requests

        .map((request) => ({
          ...request,

          status: statusOverrides[request.id] ?? request.status,
        }))

        .filter((request) => filter === "all" || request.status === filter)

        .filter((request) => {
          if (
            !search ||
            course.title.toLocaleLowerCase("ar-EG").includes(search)
          )
            return true

          return [
            course.title,

            request.studentName,

            request.email,

            request.phone,
          ]

            .join(" ")

            .toLocaleLowerCase("ar-EG")

            .includes(search)
        }),
    }))

    .filter(
      (course) =>
        filter !== "all" ||
        !search ||
        course.title.toLocaleLowerCase("ar-EG").includes(search) ||
        course.requests.length > 0,
    )

  async function decide(request: EnrollmentRequest, approve: boolean) {
    if (
      request.status === "approved" &&
      !approve &&
      !window.confirm("هل تريد رفض الطالب بعد الموافقة عليه؟")
    ) {
      return
    }

    const nextStatus: RequestStatus = approve ? "approved" : "rejected"

    const previousStatus = request.status

    setStatusOverrides((current) => ({ ...current, [request.id]: nextStatus }))

    setBusyRequests((current) => [...current, request.id])

    try {
      const succeeded = await onDecision(request.id, approve)

      if (!succeeded) {
        setStatusOverrides((current) => ({
          ...current,

          [request.id]: previousStatus,
        }))
      }
    } finally {
      setBusyRequests((current) => current.filter((id) => id !== request.id))
    }
  }

  if (loading) {
    return (
      <div
        className="space-y-4"
        aria-busy="true"
        aria-label="جاري تحميل الطلبات"
      >
        {[1, 2].map((item) => (
          <div
            key={item}
            className="h-32 animate-pulse rounded-2xl border border-slate-200 bg-white"
          />
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div
        className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-center"
        role="alert"
      >
        <p className="text-sm text-rose-800">{error}</p>
        <button
          type="button"
          onClick={onRetry}
          className="mt-4 rounded-lg bg-rose-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-700"
        >
          إعادة المحاولة
        </button>
      </div>
    )
  }

  return (
    <section className="space-y-5" aria-label="طلبات الالتحاق بالدورات">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900">طلبات الالتحاق</h2>
            <p className="mt-1 text-sm text-slate-500">
              راجع طلبات الطلاب لكل دورة واتخذ الإجراء المناسب.
            </p>
          </div>
          <label className="relative block w-full lg:max-w-sm">
            <Search
              size={17}
              className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="ابحث باسم الطالب أو الدورة أو بيانات التواصل"
              className="h-11 w-full rounded-xl border border-slate-200 bg-white pr-10 pl-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 hover:border-slate-300 focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
            />
          </label>
        </div>

        <div
          className="mt-5 flex gap-2 overflow-x-auto pb-1"
          role="group"
          aria-label="تصفية الطلبات"
        >
          {filters.map((item) => (
            <button
              key={item.id}
              type="button"
              aria-pressed={filter === item.id}
              onClick={() => setFilter(item.id)}
              className={`inline-flex shrink-0 items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 ${
                filter === item.id
                  ? "bg-slate-900 text-white shadow-sm"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900"
              }`}
            >
              {item.label}
              <span
                className={`rounded-full px-2 py-0.5 text-xs ${
                  filter === item.id
                    ? "bg-white/15 text-white"
                    : "bg-white text-slate-600"
                }`}
              >
                {counts[item.id]}
              </span>
            </button>
          ))}
        </div>
      </div>

      {courses.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center">
          <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-blue-50 text-blue-700">
            <UsersRound size={25} />
          </div>
          <h3 className="mt-4 text-base font-bold text-slate-900">
            لا توجد طلبات التحاق حتى الآن
          </h3>
          <p className="mt-1 text-sm text-slate-500">
            ستظهر الطلبات الجديدة هنا بمجرد إرسالها من الطلاب.
          </p>
        </div>
      ) : visibleCourses.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center text-sm text-slate-500">
          لا توجد نتائج تطابق البحث الحالي.
        </div>
      ) : (
        <div className="space-y-4">
          {visibleCourses.map((course) => {
            const pendingCount = course.requests.filter(
              (request) => request.status === "pending",
            ).length

            const isOpen = expandedCourses.has(course.id)

            return (
              <article
                key={course.id}
                className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-shadow hover:shadow-md"
              >
                <button
                  type="button"
                  aria-expanded={isOpen}
                  aria-controls={`course-requests-${course.id}`}
                  onClick={() =>
                    setExpandedCourses((current) => {
                      const next = new Set(current)
                      if (next.has(course.id)) next.delete(course.id)
                      else next.add(course.id)
                      return next
                    })
                  }
                  className="flex w-full items-center gap-3 p-4 text-right transition hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-inset focus-visible:outline-blue-600 sm:gap-4 sm:p-5"
                >
                  <div className="size-14 shrink-0 overflow-hidden rounded-xl bg-slate-100 sm:size-16">
                    <CourseThumbnail src={course.thumbnail} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="truncate font-bold text-slate-900">
                        {course.title}
                      </h3>
                      {course.category && (
                        <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">
                          {course.category}
                        </span>
                      )}
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                      <span className="inline-flex items-center gap-1">
                        <UsersRound size={14} /> {course.requests.length} طلب
                      </span>
                      {filter === "all" && (
                        <span className="rounded-full bg-amber-50 px-2.5 py-1 font-semibold text-amber-700">
                          {pendingCount} قيد المراجعة
                        </span>
                      )}
                    </div>
                  </div>
                  <ChevronDown
                    size={19}
                    className={`shrink-0 text-slate-400 transition-transform ${
                      isOpen ? "rotate-180" : ""
                    }`}
                  />
                </button>

                <div
                  id={`course-requests-${course.id}`}
                  aria-hidden={!isOpen}
                  inert={!isOpen}
                  className={`grid transition-[grid-template-rows] duration-300 ease-in-out ${
                    isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
                  }`}
                >
                  <div className="min-h-0 overflow-hidden">
                    <div className="border-t border-slate-100 bg-slate-50/60 p-3 sm:p-5">
                      {course.requests.length === 0 ? (
                        <div className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-8 text-center">
                          <Clock3
                            className="mx-auto text-slate-400"
                            size={22}
                          />
                          <p className="mt-2 text-sm font-medium text-slate-600">
                            لا توجد طلبات بهذه الحالة لهذه الدورة.
                          </p>
                        </div>
                      ) : (
                        <div className="grid gap-3 xl:grid-cols-2">
                          {course.requests.map((request) => (
                            <div
                              key={request.id}
                              className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-slate-300"
                            >
                              <div className="flex items-start gap-3">
                                <div className="grid size-11 shrink-0 place-items-center overflow-hidden rounded-full bg-slate-100 text-slate-500">
                                  <StudentAvatar src={request.avatarUrl} />
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="flex flex-wrap items-center justify-between gap-2">
                                    <h4 className="font-bold text-slate-900">
                                      {request.studentName}
                                    </h4>
                                    <span
                                      className={`rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${statusClasses(request.status)}`}
                                    >
                                      {busyRequests.includes(request.id)
                                        ? "جارٍ تحديث الطلب..."
                                        : statusLabel(request.status)}
                                    </span>
                                    {request.status === "approved" && (
                                      <button
                                        type="button"
                                        aria-label="Reject approved student"
                                        title="Reject student"
                                        disabled={busyRequests.includes(
                                          request.id,
                                        )}
                                        onClick={() =>
                                          void decide(request, false)
                                        }
                                        className="grid size-8 place-items-center rounded-lg border border-rose-200 text-rose-600 transition hover:bg-rose-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-600 disabled:cursor-wait disabled:opacity-50"
                                      >
                                        <X size={15} />
                                      </button>
                                    )}
                                    {request.status === "rejected" && (
                                      <button
                                        type="button"
                                        aria-label="Approve rejected student again"
                                        title="Approve student again"
                                        disabled={busyRequests.includes(
                                          request.id,
                                        )}
                                        onClick={() =>
                                          void decide(request, true)
                                        }
                                        className="grid size-8 place-items-center rounded-lg border border-emerald-200 text-emerald-700 transition hover:bg-emerald-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 disabled:cursor-wait disabled:opacity-50"
                                      >
                                        <Check size={15} />
                                      </button>
                                    )}
                                  </div>
                                  <div className="mt-2 space-y-1 text-sm text-slate-500">
                                    {request.email && (
                                      <a
                                        href={`mailto:${request.email}`}
                                        className="block truncate hover:text-blue-700"
                                      >
                                        {request.email}
                                      </a>
                                    )}
                                    {request.phone && (
                                      <a
                                        href={`tel:${request.phone}`}
                                        dir="ltr"
                                        className="block w-fit hover:text-blue-700"
                                      >
                                        {request.phone}
                                      </a>
                                    )}
                                  </div>
                                </div>
                              </div>
                              <div className="mt-3 flex items-center gap-1.5 text-xs text-slate-400">
                                <Clock3 size={14} />
                                <time
                                  dateTime={request.requestedAt ?? undefined}
                                >
                                  {formatDate(request.requestedAt)}
                                </time>
                              </div>
                              {request.note && (
                                <p className="mt-3 rounded-lg bg-slate-50 p-3 text-sm leading-6 text-slate-600">
                                  {request.note}
                                </p>
                              )}
                              {request.status === "pending" && (
                                <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-3">
                                  <button
                                    type="button"
                                    disabled={busyRequests.includes(request.id)}
                                    onClick={() => void decide(request, true)}
                                    className="inline-flex min-h-10 flex-1 items-center justify-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 disabled:cursor-wait disabled:opacity-60"
                                  >
                                    <Check size={16} /> موافقة
                                  </button>
                                  {request.status === "pending" && (
                                    <button
                                      type="button"
                                      disabled={busyRequests.includes(
                                        request.id,
                                      )}
                                      onClick={() =>
                                        void decide(request, false)
                                      }
                                      className="inline-flex min-h-10 flex-1 items-center justify-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700 transition hover:border-rose-300 hover:bg-rose-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-600 disabled:cursor-wait disabled:opacity-60"
                                    >
                                      <X size={16} /> رفض
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </article>
            )
          })}
        </div>
      )}
    </section>
  )
}
