import { useCallback, useState } from "react"

import {
  ArrowDown,
  ArrowLeft,
  BadgeCheck,
  BookOpen,
  CheckCircle2,
  GraduationCap,
  Layers3,
  Sparkles,
} from "lucide-react"

import { getAuthToken, resolveApiAssetUrl } from "../api/client"

import { studentsApi, teachersApi } from "../api/endpoints"

import ApiQueryState from "../components/ApiQueryState"

import { Skeleton, SkeletonText } from "../components/Skeleton"

import { TeacherCoursesSkeleton } from "../components/loading/SkeletonLayouts"

import CourseCard from "../components/CourseCard"

import CoursePagination from "../components/CoursePagination"

import CourseEnrollmentContactDialog from "../components/dashboard/CourseEnrollmentContactDialog"

import { readPendingEnrollments } from "../utils/pendingEnrollments"

import { useApiQuery } from "../hooks/useApiQuery"

import type { NavigateFn } from "../types"

type PublicRecord = Record<string, unknown>

interface TeacherPlatformData {
  teacher: PublicRecord

  courses: PublicRecord[]

  totalCourses: number

  enrolledCourseIds: string[]
}

function asRecord(value: unknown): PublicRecord | null {
  return typeof value === "object" && value !== null
    ? value as PublicRecord
    : null
}

function paginationFrom(
  value: unknown,
): {
  totalPages: number
  totalCount: number
} | null {
  let current = value

  for (let depth = 0; depth < 5; depth += 1) {
    const record = asRecord(current)

    if (!record) return null

    if (
      typeof record.totalPages === "number" &&
      typeof record.totalCount === "number"
    ) {
      return {
        totalPages: record.totalPages,
        totalCount: record.totalCount,
      }
    }

    current = record.data ?? record.result
  }

  return null
}

function recordsFrom(value: unknown): PublicRecord[] {
  if (Array.isArray(value)) {
    return value

      .map(asRecord)

      .filter((item): item is PublicRecord => item !== null)
  }

  const record = asRecord(value)

  if (!record) return []

  for (const key of ["items", "courses", "enrollments", "results"]) {
    if (Array.isArray(record[key])) {
      return recordsFrom(record[key])
    }
  }

  if (record.data !== undefined) return recordsFrom(record.data)

  if (record.result !== undefined) return recordsFrom(record.result)

  throw new Error("استجابة دورات المعلم غير متوقعة.")
}

function teacherRecordFrom(value: unknown): PublicRecord {
  const record = asRecord(value)

  if (!record) throw new Error("استجابة بيانات المعلم غير متوقعة.")

  for (const key of ["data", "teacher", "result"]) {
    if (record[key] !== undefined) return teacherRecordFrom(record[key])
  }

  return record
}

function teacherNameOf(record: PublicRecord): string {
  const name =
    record.fullName ??
    record.name ??
    record.teacherName ??
    [record.firstName, record.lastName].filter(Boolean).join(" ")

  return typeof name === "string" && name.trim() ? name.trim() : "معلم"
}

function teacherSpecializationOf(record: PublicRecord): string {
  const specialization =
    record.specialization ??
    record.specialty ??
    record.subjectName ??
    record.subject

  if (typeof specialization === "string" && specialization.trim()) {
    return specialization.trim()
  }

  if (Array.isArray(specialization)) {
    return specialization

      .map((item) => {
        const subject = asRecord(item)

        return String(
          subject?.name ?? subject?.subjectName ?? item ?? "",
        ).trim()
      })

      .filter(Boolean)

      .join("، ")
  }

  return ""
}

function teacherImageOf(record: PublicRecord): string {
  const avatar = record.avatar

  const avatarRecord = asRecord(avatar)

  const candidate =
    record.avatarUrl ??
    record.avatar_url ??
    record.profileImageUrl ??
    record.profile_image_url ??
    record.profileImage ??
    record.profile_image ??
    record.profilePictureUrl ??
    record.profilePicture ??
    record.imageUrl ??
    record.image_url ??
    record.pictureUrl ??
    (typeof avatar === "string" ? avatar : undefined) ??
    avatarRecord?.url ??
    avatarRecord?.src

  return typeof candidate === "string" && candidate.trim()
    ? resolveApiAssetUrl(candidate.trim())
    : ""
}

function isApprovedEnrollment(enrollment: PublicRecord): boolean {
  if (enrollment.isApproved === false) return false

  if (enrollment.isApproved === true) return true

  const status = String(
    enrollment.status ?? enrollment.enrollmentStatus ?? "",
  )
    .trim()
    .toLowerCase()

  return [
    "1",
    "3",
    "approved",
    "accepted",
    "active",
    "enrolled",
    "completed",
    "complete",
  ].includes(status)
}

async function loadTeacherPlatform(
  teacherId: string,
): Promise<TeacherPlatformData> {
  const role = (window.sessionStorage.getItem("eduhub.auth.role") ?? "")
    .toLowerCase()
  const shouldLoadEnrollments =
    Boolean(getAuthToken()) && role.includes("student")
  const [
    teacherResponse,
    coursesResponse,
    enrollmentsResponse,
  ] = await Promise.all([
    teachersApi.byId(teacherId),
    teachersApi.courses(teacherId, { page: 1, pageSize: 100 }),
    shouldLoadEnrollments
      ? studentsApi.enrollments({ page: 1, pageSize: 100 })
      : Promise.resolve(undefined),
  ])

  const teacher = teacherRecordFrom(teacherResponse)

  const firstPageCourses = recordsFrom(coursesResponse)
  const pagination = paginationFrom(coursesResponse)
  const remainingPages = pagination
    ? await Promise.all(
        Array.from(
          { length: Math.max(0, pagination.totalPages - 1) },
          (_, index) =>
            teachersApi.courses(teacherId, {
              page: index + 2,
              pageSize: 100,
            }),
        ),
      )
    : []
  const courses = [...firstPageCourses, ...remainingPages.flatMap(recordsFrom)]
  const enrollmentPages = enrollmentsResponse
    ? [recordsFrom(enrollmentsResponse)]
    : []
  const enrollmentPagination = enrollmentsResponse
    ? paginationFrom(enrollmentsResponse)
    : null
  if (enrollmentPagination) {
    enrollmentPages.push(
      ...await Promise.all(
        Array.from(
          { length: Math.max(0, enrollmentPagination.totalPages - 1) },
          (_, index) =>
            studentsApi.enrollments({
              page: index + 2,
              pageSize: 100,
            }).then(recordsFrom),
        ),
      ),
    )
  }
  const enrolledCourseIds = [
    ...new Set(
      enrollmentPages
        .flat()
        .filter(isApprovedEnrollment)
        .map((enrollment) => {
          const course = asRecord(enrollment.course)
          const id = enrollment.courseId ?? course?.id ?? course?.courseId
          return id == null ? "" : String(id)
        })
        .filter(Boolean),
    ),
  ]

  return {
    teacher,
    courses,
    totalCourses: pagination?.totalCount ?? courses.length,
    enrolledCourseIds,
  }
}

export default function TeacherPlatformPage({
  teacherId,

  navigate,
}: {
  teacherId: string

  navigate: NavigateFn
}) {
  const [reloadKey, setReloadKey] = useState(0)

  const [coursePage, setCoursePage] = useState(1)

  const [contactCourse, setContactCourse] = useState<PublicRecord | null>(null)

  const [requestedCourseIds, setRequestedCourseIds] = useState<Set<string>>(
    () => new Set(readPendingEnrollments().keys()),
  )

  const markEnrollmentRequested = useCallback((id: string) => {
    setRequestedCourseIds((current) => new Set(current).add(id))
  }, [])

  const markEnrollmentCancelled = useCallback((id: string) => {
    setRequestedCourseIds((current) => {
      const next = new Set(current)
      next.delete(id)
      return next
    })
  }, [])

  const [failedTeacherImageUrl, setFailedTeacherImageUrl] =
    useState<string | null>(null)

  const loadPage = useCallback(
    () => loadTeacherPlatform(teacherId),

    [teacherId],
  )

  const { data, error, loading } = useApiQuery(
    loadPage,

    reloadKey,

    true,

    `teacher-platform:${teacherId}`,
  )

  const teacher = data?.teacher

  const teacherName = teacher ? teacherNameOf(teacher) : "منصة المعلم"

  const teacherSpecialization = teacher ? teacherSpecializationOf(teacher) : ""

  const teacherImage = teacher ? teacherImageOf(teacher) : ""

  const teacherBio =
    typeof teacher?.bio === "string"
      ? teacher.bio
      : typeof teacher?.description === "string"
        ? teacher.description
        : ""

  const subjectNames = [
    ...new Set(
      (data?.courses ?? [])

        .map((course) => course.subjectName)

        .filter(
          (subject): subject is string =>
            typeof subject === "string" && subject.trim().length > 0,
        )

        .map((subject) => subject.trim()),
    ),
  ]

  const moduleCount = (data?.courses ?? []).reduce((total, course) => {
    const count = Number(course.modulesCount ?? course.moduleCount ?? 0)

    return Number.isFinite(count) && count > 0 ? total + count : total
  }, 0)

  const coursesPerPage = 3
  const courseTotalPages = Math.ceil(
    (data?.courses.length ?? 0) / coursesPerPage,
  )
  const visibleCourses = (data?.courses ?? []).slice(
    (coursePage - 1) * coursesPerPage,
    coursePage * coursesPerPage,
  )

  return (
    <div className="min-h-screen overflow-hidden bg-[#edf2ef] pb-16 text-ink">
      <header className="px-4 pb-2 pt-5 sm:px-6 sm:pt-8 lg:px-8">
        <section className="relative mx-auto grid max-w-7xl overflow-hidden rounded-[28px] border border-white/80 bg-white shadow-[0_22px_60px_-38px_rgba(11,59,37,.38)] sm:rounded-[34px] lg:min-h-[430px] lg:grid-cols-2">
          <div className="relative order-1 min-h-[270px] overflow-hidden bg-gradient-to-br from-emerald-950 via-emerald-800 to-teal-700 sm:min-h-[380px] lg:min-h-[430px]">
            <div
              aria-hidden="true"
              className="absolute -right-16 -top-20 size-56 rounded-full border border-white/15 sm:size-72"
            />
            <div
              aria-hidden="true"
              className="absolute -bottom-28 -left-16 size-72 rounded-full border border-white/15 sm:size-96"
            />
            {loading ? (
              <Skeleton className="absolute inset-0 rounded-none bg-white/10" />
            ) : teacherImage && failedTeacherImageUrl !== teacherImage ? (
              <img
                src={teacherImage}
                alt={`صورة ${teacherName}`}
                className="absolute inset-0 size-full object-cover object-center"
                onError={() => setFailedTeacherImageUrl(teacherImage)}
              />
            ) : (
              <div className="absolute inset-0 grid place-items-center">
                <div className="grid size-36 place-items-center rounded-full border border-white/20 bg-white/10 text-5xl font-bold text-white/90 shadow-2xl backdrop-blur-sm sm:size-52 sm:text-7xl">
                  {teacherName

                    .trim()

                    .split(/\s+/)

                    .slice(0, 2)

                    .map((part) => part[0] ?? "")

                    .join("")}
                </div>
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-emerald-950/90 via-emerald-950/10 to-emerald-950/15" />
            <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 p-4 text-white sm:p-7">
              <div className="min-w-0">
                <span className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-white/25 bg-white/10 px-3 py-1.5 text-[11px] font-semibold backdrop-blur sm:text-xs">
                  <GraduationCap size={15} aria-hidden="true" />
                  <span className="truncate">
                    {teacherSpecialization ||
                      subjectNames.join("، ") ||
                      "معلم على منصة وَعي"}
                  </span>
                </span>
                <p
                  dir="auto"
                  className="mt-2 truncate text-xl font-bold sm:mt-3 sm:text-3xl"
                >
                  {loading ? (
                    <Skeleton className="h-8 w-48 bg-white/25 sm:h-9" />
                  ) : (
                    teacherName
                  )}
                </p>
              </div>
              <div className="grid size-14 shrink-0 place-items-center rounded-2xl border border-white/20 bg-black/20 text-center backdrop-blur sm:size-[4.5rem]">
                {loading ? (
                  <Skeleton className="h-7 w-8 bg-white/25" />
                ) : (
                  <>
                    <strong className="self-end text-xl leading-none sm:text-2xl">
                      {data?.totalCourses ?? 0}
                    </strong>
                    <span className="self-start text-[9px] text-white/75 sm:text-[10px]">
                      دورة
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="order-2 flex flex-col justify-center px-5 py-7 sm:px-9 sm:py-10 lg:px-12 xl:px-16">
            <span className="inline-flex w-fit items-center gap-2 rounded-full border border-nuwa-base/10 bg-nuwa-soft px-3.5 py-2 text-xs font-bold text-nuwa-deep">
              <BadgeCheck size={15} aria-hidden="true" />
              معلم على منصة وَعي
            </span>
            <p className="mt-5 text-sm font-semibold text-nuwa-base sm:mt-7">
              تعلّم من خبرة متخصصة
            </p>
            <h1
              dir="auto"
              className="mt-2 text-3xl font-extrabold leading-tight tracking-tight text-ink sm:text-4xl xl:text-5xl"
            >
              تعلّم مع
              <span className="mt-1 block text-nuwa-base">
                {loading ? (
                  <Skeleton className="h-10 w-52 bg-nuwa-soft sm:h-12" />
                ) : (
                  teacherName
                )}
              </span>
            </h1>
            <p
              dir="auto"
              className="mt-4 max-w-xl whitespace-pre-line text-sm leading-7 text-ink-muted sm:mt-5 sm:text-base sm:leading-8"
            >
              {loading ? (
                <SkeletonText className="mt-3 max-w-xl" lines={3} />
              ) : (
                teacherBio ||
                "اكتشف الدورات التعليمية وتعلّم بأسلوب واضح ومنظم، خطوة بخطوة."
              )}
            </p>

            <div className="mt-6 grid grid-cols-2 gap-2.5 sm:mt-7 sm:gap-3">
              <div className="flex min-w-0 items-center gap-2.5 rounded-2xl border border-stroke bg-[#f7faf8] p-3 sm:p-3.5">
                <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-nuwa-soft text-nuwa-base">
                  <BookOpen size={17} aria-hidden="true" />
                </span>
                <span className="min-w-0">
                  <strong className="block truncate text-sm font-bold text-ink">
                    {data?.totalCourses ?? 0}
                  </strong>
                  <span className="block truncate text-[10px] text-ink-muted sm:text-xs">
                    دورة تعليمية
                  </span>
                </span>
              </div>
              {moduleCount > 0 && (
                <div className="flex min-w-0 items-center gap-2.5 rounded-2xl border border-stroke bg-[#f7faf8] p-3 sm:p-3.5">
                  <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-nuwa-soft text-nuwa-base">
                    <Layers3 size={17} aria-hidden="true" />
                  </span>
                  <span className="min-w-0">
                    <strong className="block truncate text-sm font-bold text-ink">
                      {moduleCount.toLocaleString("ar-EG")}
                    </strong>
                    <span className="block truncate text-[10px] text-ink-muted sm:text-xs">
                      وحدة تعليمية
                    </span>
                  </span>
                </div>
              )}
            </div>

            <div className="mt-6 flex flex-wrap items-center gap-3 sm:mt-7">
              <button
                type="button"
                disabled={loading}
                onClick={() =>
                  document

                    .getElementById("teacher-courses")

                    ?.scrollIntoView({ behavior: "smooth", block: "start" })
                }
                className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-nuwa-base px-5 text-sm font-bold text-white shadow-lg shadow-emerald-900/15 transition hover:-translate-y-0.5 hover:bg-nuwa-deep focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nuwa-bright focus-visible:ring-offset-2 disabled:opacity-60"
              >
                استكشف الدورات
                <ArrowDown size={17} aria-hidden="true" />
              </button>
              <span className="text-xs font-medium text-ink-muted">
                {subjectNames.length
                  ? subjectNames.slice(0, 2).join(" · ")
                  : "محتوى تعليمي أُعدّ بعناية"}
              </span>
            </div>
          </div>
        </section>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
        <section id="teacher-courses" className="scroll-mt-24">
          <div className="mb-6 flex flex-wrap items-end justify-between gap-4 sm:mb-8">
            <div>
              <p className="inline-flex items-center gap-2 text-xs font-bold text-nuwa-base sm:text-sm">
                <span className="size-1.5 rounded-full bg-nuwa-bright" />
                ابدأ رحلتك التعليمية
              </p>
              <h2 className="mt-2 text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">
                الدورات التعليمية
              </h2>
              <p className="mt-1.5 text-xs leading-6 text-ink-muted sm:text-sm">
                اختر الدورة المناسبة لك وتعرّف على محتواها قبل أن تبدأ.
              </p>
            </div>
            {data && data.courses.length > 0 && (
              <span className="inline-flex items-center gap-2 rounded-full border border-stroke bg-white px-3.5 py-2 text-xs font-bold text-ink-muted shadow-sm">
                <BookOpen
                  size={15}
                  className="text-nuwa-base"
                  aria-hidden="true"
                />
                {data.totalCourses.toLocaleString("ar-EG")} دورات
              </span>
            )}
          </div>

          <ApiQueryState
            loading={loading}
            loadingContent={
              <TeacherCoursesSkeleton
                count={data === null ? undefined : data.courses.length}
              />
            }
            error={error}
            isEmpty={Boolean(data && data.courses.length === 0)}
            emptyMessage="لا توجد دورات منشورة متاحة لهذا المعلم حاليًا."
            onRetry={() => setReloadKey((key) => key + 1)}
          >
            {data && data.courses.length > 0 && (
              <div className="grid gap-4 sm:grid-cols-2 sm:gap-5 xl:grid-cols-3">
                {visibleCourses.map((course, index) => {
                  const courseId = course.id ?? course.courseId

                  const title = String(
                    course.title ?? course.name ?? "دورة تعليمية",
                  )
                  const moduleCount = Number(
                    course.modulesCount ?? course.moduleCount ?? 0,
                  )
                  const isEnrolled =
                    courseId != null &&
                    (data.enrolledCourseIds.includes(String(courseId)) ||
                      course.isEnrolled === true)
                  const enrollmentActionLabel = isEnrolled
                    ? "مسجل بالفعل"
                    : courseId != null && requestedCourseIds.has(String(courseId))
                      ? "تواصل مع المدرس"
                      : "طلب الالتحاق"

                  return (
                    <CourseCard
                      key={String(courseId ?? index)}
                      course={course}
                      title={title}
                      teacherName={teacherName}
                      footer={
                        moduleCount > 0 ? (
                          <p className="mt-3 text-xs font-semibold text-ink-muted">
                            {moduleCount.toLocaleString("ar-EG")} وحدات تعليمية
                          </p>
                        ) : undefined
                      }
                    >
                      <div className="grid gap-2 sm:grid-cols-2">
                        <button
                          type="button"
                          disabled={
                            courseId === undefined ||
                            courseId === null ||
                            isEnrolled
                          }
                          onClick={() =>
                            setContactCourse({
                              ...course,
                              teacher: course.teacher ?? data.teacher,
                              teacherId:
                                course.teacherId ??
                                data.teacher.id ??
                                data.teacher.teacherId,
                              teacherName,
                            })
                          }
                          className="w-full rounded-xl bg-nuwa-base px-3 py-3 text-xs font-bold text-white transition hover:bg-nuwa-deep focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nuwa-bright focus-visible:ring-offset-2 disabled:cursor-default disabled:opacity-60"
                        >
                          {enrollmentActionLabel}
                        </button>
                        <button
                          type="button"
                          disabled={courseId === undefined || courseId === null}
                          onClick={() => {
                            if (courseId !== undefined && courseId !== null) {
                              navigate("public:course-detail", {
                                courseId: String(courseId),
                              })
                            }
                          }}
                          className="w-full rounded-xl bg-nuwa-soft px-3 py-3 text-xs font-bold text-nuwa-deep transition hover:bg-nuwa-base hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nuwa-bright focus-visible:ring-offset-2 disabled:cursor-default disabled:opacity-60"
                        >
                          تفاصيل الدورة
                        </button>
                      </div>
                    </CourseCard>
                  )
                })}
              </div>
            )}
          </ApiQueryState>
          {data && (
            <CoursePagination
              page={coursePage}
              totalPages={courseTotalPages}
              onPageChange={(nextPage) => {
                setCoursePage(nextPage)
                document
                  .getElementById("teacher-courses")
                  ?.scrollIntoView({ behavior: "smooth", block: "start" })
              }}
              disabled={loading}
            />
          )}
        </section>

        <section
          aria-labelledby="teacher-learning-path"
          className="mt-12 overflow-hidden rounded-[28px] border border-emerald-900/5 bg-white shadow-sm sm:mt-16 sm:rounded-[32px]"
        >
          <div className="grid lg:grid-cols-[.8fr_1.2fr]">
            <div className="relative overflow-hidden bg-gradient-to-br from-[#0b3b25] via-[#125b39] to-[#176b43] p-6 text-white sm:p-9 lg:p-10">
              <span
                aria-hidden="true"
                className="absolute -bottom-20 -left-14 size-56 rounded-full border border-white/10"
              />
              <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-bold text-emerald-100">
                <Sparkles size={15} aria-hidden="true" />
                خطوة بخطوة
              </span>
              <h2
                id="teacher-learning-path"
                className="relative mt-4 text-2xl font-extrabold leading-tight sm:text-3xl"
              >
                طريقك للتعلّم
                <span className="block text-emerald-200">يبدأ من هنا</span>
              </h2>
              <p className="relative mt-3 max-w-md text-sm leading-7 text-white/75">
                تصفّح الدورات، اختر ما يناسب هدفك، وابدأ التعلّم بالوتيرة المناسبة
                لك.
              </p>
              <button
                type="button"
                onClick={() =>
                  document

                    .getElementById("teacher-courses")

                    ?.scrollIntoView({ behavior: "smooth", block: "start" })
                }
                className="relative mt-6 inline-flex min-h-11 items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-nuwa-deep transition hover:-translate-y-0.5 hover:bg-emerald-50"
              >
                اختر دورتك
                <ArrowLeft size={16} aria-hidden="true" />
              </button>
            </div>
            <div className="grid gap-3 p-4 sm:grid-cols-3 sm:gap-4 sm:p-6 lg:p-8">
              {[
                {
                  icon: BookOpen,

                  number: "١",

                  title: "اختر الدورة",

                  detail: "تعرّف على الدورات ومحتوى كل واحدة.",
                },

                {
                  icon: Layers3,

                  number: "٢",

                  title: "استكشف المحتوى",

                  detail: "ابدأ بالوحدات التعليمية المرتبة.",
                },

                {
                  icon: CheckCircle2,

                  number: "٣",

                  title: "تابع تقدّمك",

                  detail: "واصل التعلّم خطوة جديدة كل مرة.",
                },
              ].map(({ icon: Icon, number, title, detail }) => (
                <div
                  key={number}
                  className="rounded-2xl border border-stroke bg-[#f8faf8] p-4 sm:p-5"
                >
                  <div className="flex items-center justify-between">
                    <span className="grid size-10 place-items-center rounded-xl bg-nuwa-soft text-nuwa-base">
                      <Icon size={19} aria-hidden="true" />
                    </span>
                    <span className="text-sm font-extrabold text-nuwa-base/40">
                      {number}
                    </span>
                  </div>
                  <h3 className="mt-4 text-sm font-extrabold text-ink">
                    {title}
                  </h3>
                  <p className="mt-1.5 text-xs leading-6 text-ink-muted">
                    {detail}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>
      <CourseEnrollmentContactDialog
        course={contactCourse}
        onClose={() => setContactCourse(null)}
        navigate={navigate}
        onEnrollmentRequested={markEnrollmentRequested}
        onEnrollmentCancelled={markEnrollmentCancelled}
      />
    </div>
  )
}
