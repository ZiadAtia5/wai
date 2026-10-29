import { useEffect, useState } from "react"

import {
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  ChevronLeft,
  GraduationCap,
  Mail,
  RefreshCw,
  UsersRound,
} from "lucide-react"

import { adminApi, enrollmentsApi, type PageQuery } from "../../api/endpoints"

import PersonAvatar from "../PersonAvatar"

interface AdminSubscriptionsProps {
  data: unknown

  loading: boolean

  error: string | null

  reloadKey: number

  onRetry: () => void
}

type RecordValue = Record<string, unknown>

function isRecord(value: unknown): value is RecordValue {
  return typeof value === "object" && value !== null
}

function unwrap(value: unknown): unknown {
  let current = value

  for (let depth = 0; depth < 5; depth += 1) {
    const response = current

    if (!isRecord(response) || !("data" in response)) break

    const keys = Object.keys(response)

    if (
      keys.length > 3 &&
      !["success", "message", "status", "errors", "meta"].some(
        (key) => key in response,
      )
    ) {
      break
    }

    current = response.data
  }

  return current
}

function recordsFrom(value: unknown, keys: string[]): RecordValue[] {
  const payload = unwrap(value)

  if (Array.isArray(payload)) return payload.filter(isRecord)

  if (!isRecord(payload)) return []

  for (const key of keys) {
    if (Array.isArray(payload[key])) {
      return (payload[key] as unknown[]).filter(isRecord)
    }
  }

  return []
}

function pageCount(value: unknown): number {
  const payload = unwrap(value)

  if (!isRecord(payload)) return 1

  const pagination = isRecord(payload.pagination)
    ? payload.pagination
    : isRecord(payload.meta)
      ? payload.meta
      : payload

  const explicitPages = Number(pagination.totalPages ?? pagination.pageCount)

  if (Number.isInteger(explicitPages) && explicitPages > 0) return explicitPages

  const totalCount = Number(pagination.totalCount ?? pagination.totalItems)

  const total = Number(pagination.total)

  const pageSize = Number(pagination.pageSize ?? pagination.perPage)

  const count = Number.isFinite(totalCount) ? totalCount : total

  return Number.isFinite(count) && count > 0 && pageSize > 0
    ? Math.ceil(count / pageSize)
    : 1
}

async function loadAllPages(
  load: (query: PageQuery) => Promise<unknown>,

  query: PageQuery,

  keys: string[],
): Promise<RecordValue[]> {
  const pageSize = 100

  const firstPage = await load({ ...query, page: 1, pageSize })

  const totalPages = pageCount(firstPage)

  const pages = await Promise.all(
    Array.from({ length: totalPages - 1 }, (_, index) =>
      load({ ...query, page: index + 2, pageSize }),
    ),
  )

  return [firstPage, ...pages].flatMap((page) => recordsFrom(page, keys))
}

function text(value: unknown): string {
  return typeof value === "string" || typeof value === "number"
    ? String(value).trim()
    : ""
}

function nestedRecord(value: unknown, key: string): RecordValue {
  return isRecord(value) && isRecord(value[key]) ? value[key] : {}
}

function teacherName(teacher: RecordValue): string {
  const profile = nestedRecord(teacher, "profile")

  const user = nestedRecord(teacher, "user")

  const direct =
    text(teacher.fullName) ||
    text(teacher.displayName) ||
    text(teacher.name) ||
    text(profile.fullName) ||
    text(profile.name) ||
    text(user.fullName) ||
    text(user.name)

  if (direct) return direct

  const parts = [
    teacher.firstName ?? profile.firstName ?? user.firstName,

    teacher.secondName ?? profile.secondName ?? user.secondName,

    teacher.lastName ?? profile.lastName ?? user.lastName,
  ]

    .map(text)

    .filter(Boolean)

  return parts.join(" ") || "معلم بدون اسم"
}

function teacherImage(teacher: RecordValue): string | undefined {
  const profile = nestedRecord(teacher, "profile")

  const user = nestedRecord(teacher, "user")

  const image =
    teacher.avatarUrl ??
    teacher.profileImageUrl ??
    teacher.profileImage ??
    profile.avatarUrl ??
    profile.profileImageUrl ??
    user.avatarUrl ??
    user.profileImageUrl

  return typeof image === "string" && image.trim() ? image : undefined
}

function courseId(course: RecordValue): string {
  return text(course.courseId ?? course.id)
}

function courseTitle(course: RecordValue): string {
  return (
    text(course.title) ||
    text(course.name) ||
    text(course.courseName) ||
    "دورة بدون عنوان"
  )
}

function isApprovedEnrollment(enrollment: RecordValue): boolean {
  const status = String(
    enrollment.status ?? enrollment.enrollmentStatus ?? enrollment.state ?? "",
  )

    .trim()

    .toLowerCase()

  return (
    ["approved", "accepted", "active", "enrolled", "1", "3"].includes(status) ||
    enrollment.isApproved === true
  )
}

function enrollmentCourseId(enrollment: RecordValue): string {
  const course = nestedRecord(enrollment, "course")
  const courseDetails =
    Object.keys(course).length > 0
      ? course
      : nestedRecord(enrollment, "courseDetails")

  return text(
    enrollment.courseId ??
      enrollment.courseID ??
      enrollment.CourseId ??
      enrollment.CourseID ??
      course.id ??
      course.courseId ??
      course.courseID ??
      courseDetails.courseId ??
      courseDetails.id,
  )
}

function courseMatchesEnrollment(
  enrollment: RecordValue,
  targetCourseId: string,
): boolean {
  const course = nestedRecord(enrollment, "course")
  const courseDetails = nestedRecord(enrollment, "courseDetails")

  const ids = [
    enrollmentCourseId(enrollment),
    text(
      enrollment.courseId ??
        enrollment.courseID ??
        enrollment.CourseId ??
        enrollment.CourseID,
    ),
    text(course.id ?? course.courseId ?? course.courseID),
    text(courseDetails.id ?? courseDetails.courseId ?? courseDetails.courseID),
  ]

  return ids.some((value) => value && value === targetCourseId)
}

function teacherId(teacher: RecordValue): string {
  return text(teacher.teacherId ?? teacher.id ?? teacher.userId)
}

function IconMetric({
  icon,

  label,

  value,
}: {
  icon: "courses" | "students"

  label: string

  value: string
}) {
  const Icon = icon === "courses" ? BookOpen : UsersRound

  return (
    <div className="flex items-center gap-3 rounded-2xl border border-stroke/70 bg-white p-4">
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-nuwa-soft text-nuwa-base">
        <Icon size={19} />
      </span>
      <div>
        <p className="text-xs font-medium text-ink-muted">{label}</p>
        <p className="mt-1 text-xl font-bold tabular-nums text-ink">{value}</p>
      </div>
    </div>
  )
}

export default function AdminSubscriptions({
  data,

  loading,

  error,

  reloadKey,

  onRetry,
}: AdminSubscriptionsProps) {
  const teachers = recordsFrom(data, ["items", "teachers", "records"])

  const [selectedTeacher, setSelectedTeacher] = useState<RecordValue | null>(
    null,
  )

  const [courses, setCourses] = useState<RecordValue[]>([])

  const [coursesLoading, setCoursesLoading] = useState(false)

  const [coursesError, setCoursesError] = useState<string | null>(null)

  const [selectedCourse, setSelectedCourse] = useState<RecordValue | null>(null)

  const [studentsCount, setStudentsCount] = useState<number | null>(null)

  const [studentsLoading, setStudentsLoading] = useState(false)

  const [studentsError, setStudentsError] = useState<string | null>(null)

  const [detailReloadKey, setDetailReloadKey] = useState(0)

  useEffect(() => {
    if (!selectedTeacher) {
      setCourses([])

      setCoursesError(null)

      setSelectedCourse(null)

      return
    }

    const id = teacherId(selectedTeacher)

    if (!id) {
      setCourses([])

      setCoursesError("تعذر تحديد رقم المعلم لعرض دوراته.")

      return
    }

    let active = true

    setCoursesLoading(true)

    setCoursesError(null)

    setCourses([])

    setSelectedCourse(null)

    loadAllPages(
      adminApi.courses,

      { teacherId: id },

      ["items", "courses", "records"],
    )

      .then((result) => {
        if (active) setCourses(result)
      })

      .catch((cause: unknown) => {
        if (active) {
          setCoursesError(
            cause instanceof Error
              ? cause.message
              : "تعذر تحميل دورات هذا المعلم.",
          )
        }
      })

      .finally(() => {
        if (active) setCoursesLoading(false)
      })

    return () => {
      active = false
    }
  }, [selectedTeacher, reloadKey, detailReloadKey])

  useEffect(() => {
    if (!selectedCourse) {
      setStudentsCount(null)

      setStudentsError(null)

      return
    }

    const id = courseId(selectedCourse)

    if (!id) {
      setStudentsCount(null)

      setStudentsError("تعذر تحديد رقم الدورة لعرض عدد الطلاب.")

      return
    }

    let active = true

    setStudentsCount(null)

    setStudentsLoading(true)

    setStudentsError(null)

    loadAllPages(
      enrollmentsApi.adminList,

      { courseId: id },

      ["items", "enrollments", "requests", "records"],
    )
      .then((enrollments) => {
        if (active) {
          const matchingEnrollments = enrollments.filter((enrollment) =>
            courseMatchesEnrollment(enrollment, id),
          )

          if (matchingEnrollments.length === 0) {
            setStudentsCount(0)
            setStudentsError(null)
            return
          }

          setStudentsCount(
            matchingEnrollments.filter(isApprovedEnrollment).length,
          )
        }
      })

      .catch((cause: unknown) => {
        if (active) {
          setStudentsError(
            cause instanceof Error
              ? cause.message
              : "تعذر تحميل عدد الطلاب المسجلين.",
          )
        }
      })

      .finally(() => {
        if (active) setStudentsLoading(false)
      })

    return () => {
      active = false
    }
  }, [selectedCourse])

  const teacherEmail =
    text(selectedTeacher?.email) ||
    text(nestedRecord(selectedTeacher, "profile").email) ||
    text(nestedRecord(selectedTeacher, "user").email)

  return (
    <section className="overflow-hidden rounded-[28px] border border-stroke bg-white shadow-nuwa">
      <div className="relative isolate overflow-hidden bg-gradient-to-l from-nuwa-deep via-nuwa-base to-[#24865b] px-5 py-7 text-white sm:px-8 sm:py-9">
        <div
          aria-hidden="true"
          className="absolute -left-10 -top-20 -z-10 size-64 rounded-full border-[34px] border-white/[0.08]"
        />
        <div className="flex flex-wrap items-end justify-between gap-5">
          <div className="max-w-2xl">
            <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1.5 text-xs font-semibold text-white/90">
              <CheckCircle2 size={15} />
              متابعة وتفاصيل
            </span>
            <h2 className="mt-4 text-2xl font-bold sm:text-3xl">
              تفاصيل اشتراكات المعلمين
            </h2>
            <p className="mt-2 max-w-xl text-sm leading-7 text-white/75">
              اختر معلماً لمراجعة دوراته، ثم اختر دورة لمعرفة عدد الطلاب المسجلين
              بها.
            </p>
          </div>
          <div className="rounded-2xl border border-white/15 bg-white/10 px-5 py-3 text-center backdrop-blur-sm">
            <p className="text-xs font-medium text-white/75">
              المعلمون بالصفحة
            </p>
            <p className="mt-1 text-2xl font-bold tabular-nums">
              {teachers.length}
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-5 p-4 sm:p-6 xl:grid-cols-[minmax(280px,0.8fr)_minmax(0,1.8fr)]">
        <aside className="min-w-0">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-ink">قائمة المعلمين</h3>
              <p className="mt-1 text-xs text-ink-muted">
                اضغط على المعلم لعرض دوراته
              </p>
            </div>
            <span className="rounded-full bg-nuwa-soft px-3 py-1 text-xs font-bold text-nuwa-deep">
              {teachers.length}
            </span>
          </div>

          {loading ? (
            <div
              aria-busy="true"
              className="grid gap-2 rounded-2xl border border-stroke bg-canvas/40 p-3"
            >
              {[0, 1, 2, 3].map((item) => (
                <div
                  key={item}
                  className="h-[72px] animate-pulse rounded-xl bg-white"
                />
              ))}
            </div>
          ) : error ? (
            <div className="rounded-2xl border border-danger/20 bg-danger-light p-4">
              <p className="text-sm leading-6 text-danger">{error}</p>
              <button
                type="button"
                onClick={onRetry}
                className="mt-3 inline-flex h-9 items-center gap-2 rounded-lg bg-white px-3 text-xs font-bold text-danger"
              >
                <RefreshCw size={14} />
                إعادة المحاولة
              </button>
            </div>
          ) : teachers.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-stroke-strong bg-canvas/40 px-4 py-10 text-center">
              <GraduationCap className="mx-auto text-ink-muted" size={27} />
              <p className="mt-3 text-sm font-semibold text-ink">
                لا يوجد معلمون مطابقون للبحث
              </p>
              <p className="mt-1 text-xs text-ink-muted">
                جرّب تغيير عبارة البحث أو مسحها.
              </p>
            </div>
          ) : (
            <div className="max-h-[620px] space-y-2 overflow-y-auto pe-1">
              {teachers.map((teacher, index) => {
                const id = teacherId(teacher) || `teacher-${index}`

                const name = teacherName(teacher)

                const isSelected =
                  teacherId(selectedTeacher ?? {}) === teacherId(teacher)

                return (
                  <button
                    key={id}
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() => setSelectedTeacher(teacher)}
                    className={`group flex min-h-[76px] w-full items-center gap-3 rounded-2xl border p-3 text-start transition ${
                      isSelected
                        ? "border-nuwa-base bg-nuwa-ice shadow-sm"
                        : "border-stroke bg-white hover:border-nuwa-base/40 hover:bg-canvas/50"
                    }`}
                  >
                    <PersonAvatar
                      name={name}
                      imageUrl={teacherImage(teacher)}
                      size="md"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-bold text-ink">
                        {name}
                      </span>
                      <span className="mt-1 block truncate text-xs text-ink-muted">
                        {text(teacher.email) || "اضغط لعرض تفاصيل الدورات"}
                      </span>
                    </span>
                    <ChevronLeft
                      size={17}
                      className={`shrink-0 transition ${
                        isSelected
                          ? "text-nuwa-base"
                          : "text-ink-muted group-hover:text-nuwa-base"
                      }`}
                    />
                  </button>
                )
              })}
            </div>
          )}
        </aside>

        <div className="min-w-0 rounded-[24px] border border-stroke bg-canvas/35 p-4 sm:p-5">
          {!selectedTeacher ? (
            <div className="grid min-h-[330px] place-items-center rounded-2xl border border-dashed border-stroke-strong bg-white/70 p-6 text-center">
              <div>
                <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-nuwa-soft text-nuwa-base">
                  <ArrowLeft size={24} />
                </span>
                <h3 className="mt-4 text-base font-bold text-ink">
                  ابدأ باختيار أحد المعلمين
                </h3>
                <p className="mt-2 max-w-sm text-sm leading-6 text-ink-muted">
                  ستظهر هنا الدورات التي يقدمها المعلم وعدد الطلاب المسجلين في
                  كل دورة.
                </p>
              </div>
            </div>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-stroke/70 bg-white p-4 sm:p-5">
                <div className="flex min-w-0 items-center gap-3">
                  <PersonAvatar
                    name={teacherName(selectedTeacher)}
                    imageUrl={teacherImage(selectedTeacher)}
                    size="lg"
                  />
                  <div className="min-w-0">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-nuwa-soft px-2.5 py-1 text-[11px] font-bold text-nuwa-deep">
                      <GraduationCap size={13} />
                      ملف المعلم
                    </span>
                    <h3 className="mt-2 truncate text-lg font-bold text-ink">
                      {teacherName(selectedTeacher)}
                    </h3>
                    {teacherEmail && (
                      <p className="mt-1 flex items-center gap-1.5 truncate text-xs text-ink-muted">
                        <Mail size={13} />
                        {teacherEmail}
                      </p>
                    )}
                  </div>
                </div>
                <IconMetric
                  icon="courses"
                  label="إجمالي الدورات"
                  value={
                    coursesLoading
                      ? "..."
                      : coursesError
                        ? "—"
                        : String(courses.length)
                  }
                />
              </div>

              <div className="mt-5">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <h4 className="text-base font-bold text-ink">
                      دورات المعلم
                    </h4>
                    <p className="mt-1 text-xs text-ink-muted">
                      اختر دورة لعرض عدد الطلاب المسجلين
                    </p>
                  </div>
                  <button
                    type="button"
                    aria-label="تحديث دورات المعلم"
                    title="تحديث الدورات"
                    onClick={() => setDetailReloadKey((value) => value + 1)}
                    disabled={coursesLoading}
                    className="grid size-9 place-items-center rounded-xl border border-stroke bg-white text-ink-muted transition hover:text-nuwa-base disabled:opacity-50"
                  >
                    <RefreshCw
                      size={15}
                      className={coursesLoading ? "animate-spin" : ""}
                    />
                  </button>
                </div>

                {coursesLoading ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {[0, 1].map((item) => (
                      <div
                        key={item}
                        className="h-28 animate-pulse rounded-2xl border border-stroke bg-white"
                      />
                    ))}
                  </div>
                ) : coursesError ? (
                  <div className="rounded-2xl border border-danger/20 bg-danger-light p-4">
                    <p className="text-sm leading-6 text-danger">
                      {coursesError}
                    </p>
                    <button
                      type="button"
                      onClick={() => setDetailReloadKey((value) => value + 1)}
                      className="mt-3 inline-flex h-9 items-center gap-2 rounded-lg bg-white px-3 text-xs font-bold text-danger"
                    >
                      <RefreshCw size={14} />
                      إعادة المحاولة
                    </button>
                  </div>
                ) : courses.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-stroke-strong bg-white px-4 py-8 text-center">
                    <BookOpen className="mx-auto text-ink-muted" size={25} />
                    <p className="mt-3 text-sm font-semibold text-ink">
                      لا توجد دورات مسجلة لهذا المعلم
                    </p>
                  </div>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {courses.map((course, index) => {
                      const id = courseId(course) || `course-${index}`

                      const selected = courseId(selectedCourse ?? {}) === id

                      return (
                        <button
                          key={id}
                          type="button"
                          aria-pressed={selected}
                          onClick={() => setSelectedCourse(course)}
                          className={`group flex min-h-[104px] items-center gap-3 rounded-2xl border bg-white p-4 text-start transition ${
                            selected
                              ? "border-nuwa-base ring-2 ring-nuwa-base/10"
                              : "border-stroke hover:border-nuwa-base/40 hover:shadow-sm"
                          }`}
                        >
                          <span
                            className={`grid size-11 shrink-0 place-items-center rounded-xl ${
                              selected
                                ? "bg-nuwa-base text-white"
                                : "bg-nuwa-soft text-nuwa-base"
                            }`}
                          >
                            <BookOpen size={19} />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-bold text-ink">
                              {courseTitle(course)}
                            </span>
                            <span className="mt-1 inline-flex items-center gap-1.5 text-xs text-ink-muted">
                              <UsersRound size={13} />
                              اضغط لعرض عدد الطلاب
                            </span>
                          </span>
                          <ChevronLeft
                            size={16}
                            className="shrink-0 text-ink-muted group-hover:text-nuwa-base"
                          />
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>

              {selectedCourse && (
                <div className="mt-5 rounded-2xl border border-nuwa-base/15 bg-white p-4 sm:p-5">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="min-w-0">
                      <span className="text-xs font-semibold text-ink-muted">
                        تفاصيل الدورة المحددة
                      </span>
                      <h4 className="mt-1 truncate text-base font-bold text-ink">
                        {courseTitle(selectedCourse)}
                      </h4>
                    </div>
                    {studentsLoading ? (
                      <div
                        aria-label="جارٍ تحميل عدد الطلاب"
                        className="h-[72px] w-40 animate-pulse rounded-2xl bg-canvas"
                      />
                    ) : studentsError ? (
                      <div className="rounded-xl border border-danger/20 bg-danger-light px-3 py-2">
                        <p className="text-xs leading-5 text-danger">
                          {studentsError}
                        </p>
                        <button
                          type="button"
                          onClick={() =>
                            setSelectedCourse({ ...selectedCourse })
                          }
                          className="mt-1 text-xs font-bold text-danger underline"
                        >
                          إعادة المحاولة
                        </button>
                      </div>
                    ) : (
                      <IconMetric
                        icon="students"
                        label="الطلاب المسجلون"
                        value={String(studentsCount ?? 0)}
                      />
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </section>
  )
}
