import { useCallback, useMemo, useState } from "react"

import { ArrowRight, BookOpen, ChevronDown } from "lucide-react"

import { ApiError } from "../../api/client"

import { quizzesApi, teachersApi } from "../../api/endpoints"

import ApiQueryState from "../ApiQueryState"
import { getLoadingItemCount, Skeleton } from "../Skeleton"

import PersonAvatar from "../PersonAvatar"
import StudentDetailDialog from "./StudentDetailDialog"
import { AnimatedBar, AnimatedNumber } from "./DashboardMotion"

import { useApiQuery } from "../../hooks/useApiQuery"

import {
  asRecord,
  enrollmentRows,
  formatDate,
  getText,
  records,
  scoreValues,
  stableStudentKey,
  statusLabel,
  unwrap,
  type AttemptRow,
  type CourseInfo,
  type EnrollmentRow,
  type ProgressData,
} from "./teacherStudentProgressData"

async function loadStudentProgress(): Promise<ProgressData> {
  const [coursesResult, enrollmentsResult] = await Promise.allSettled([
    teachersApi.coursesMine({ page: 1, pageSize: 100 }),

    teachersApi.enrollmentRequests({ page: 1, pageSize: 500 }),
  ])

  if (coursesResult.status === "rejected") throw coursesResult.reason

  const courseResponse = coursesResult.value

  const coursePageCountValue = Number(
    asRecord(courseResponse).totalPages ??
      asRecord(asRecord(courseResponse).data).totalPages ??
      1,
  )

  const coursePageCount = Math.max(
    1,

    Number.isFinite(coursePageCountValue) ? Math.ceil(coursePageCountValue) : 1,
  )

  const otherPages = await Promise.all(
    Array.from({ length: coursePageCount - 1 }, (_, index) =>
      teachersApi.coursesMine({ page: index + 2, pageSize: 100 }),
    ),
  )

  const courseRecords = [courseResponse, ...otherPages].flatMap(records)

  const enrollmentResponse =
    enrollmentsResult.status === "fulfilled" ? enrollmentsResult.value : null

  const enrollmentPageCountValue = Number(
    asRecord(enrollmentResponse).totalPages ??
      asRecord(asRecord(enrollmentResponse).data).totalPages ??
      1,
  )

  const enrollmentPageCount = Math.max(
    1,

    Number.isFinite(enrollmentPageCountValue)
      ? Math.ceil(enrollmentPageCountValue)
      : 1,
  )

  const enrollmentPages =
    enrollmentResponse === null
      ? []
      : await Promise.all(
          Array.from({ length: enrollmentPageCount - 1 }, (_, index) =>
            teachersApi.enrollmentRequests({
              page: index + 2,

              pageSize: 500,
            }),
          ),
        )

  const courses: CourseInfo[] = courseRecords.flatMap((course) => {
    const id = getText(course.id, course.courseId)

    const subject = asRecord(course.subject)

    const subjectId = getText(course.subjectId, subject.id)

    const subjectName = getText(
      course.subjectName,

      subject.name,

      subject.title,
    )

    return id
      ? [
          {
            id,

            title: getText(course.title, course.name) || `دورة ${id}`,

            subjectId,

            subjectName,
          },
        ]
      : []
  })

  const courseById = new Map(courses.map((course) => [course.id, course]))

  const warnings: string[] = []

  const enrollments =
    enrollmentResponse !== null
      ? enrollmentRows([enrollmentResponse, ...enrollmentPages], courseById)
      : (warnings.push("تعذر تحميل أسماء الطلاب وطلبات الالتحاق."), [])

  const courseDetails = await Promise.allSettled(
    courseRecords.map(async (course) => {
      const courseId = getText(course.id, course.courseId)

      if (!courseId) return []

      const detailResponse = await teachersApi.course(courseId)

      const detail = unwrap(detailResponse, "course")

      const detailedSubject = asRecord(detail.subject)

      const courseInfo = courseById.get(courseId)

      if (courseInfo) {
        courseInfo.subjectId ||= getText(detail.subjectId, detailedSubject.id)

        courseInfo.subjectName ||= getText(
          detail.subjectName,

          detailedSubject.name,

          detailedSubject.title,
        )
      }

      const modules = records(detail.modules ?? detail.courseModules)

      const lessons = [
        ...records(detail.lessons),

        ...modules.flatMap((module) =>
          records(module.lessons ?? module.courseLessons),
        ),
      ]

      const uniqueLessons = [
        ...new Map(
          lessons.flatMap((lesson) => {
            const id = getText(lesson.id, lesson.lessonId)

            return id ? [[id, lesson] as const] : []
          }),
        ).values(),
      ]

      return Promise.all(
        uniqueLessons.map(async (lesson) => {
          const lessonId = getText(lesson.id, lesson.lessonId)

          try {
            const quizResponse = await quizzesApi.forLesson(lessonId)

            const quiz = unwrap(quizResponse, "quiz")

            const quizId = getText(quiz.id, quiz.quizId)

            if (!quizId || quiz.isPublished === false) return []

            const attemptsResponse = await quizzesApi.attempts(quizId)

            return records(attemptsResponse).map((attempt, index) => {
              const student = asRecord(
                attempt.student ?? attempt.studentProfile,
              )

              const email = getText(
                attempt.studentEmail,

                attempt.email,

                student.email,
              )

              const studentName =
                getText(
                  attempt.studentName,

                  attempt.fullName,

                  student.fullName,

                  student.name,

                  [student.firstName, student.lastName]

                    .filter((part) => typeof part === "string")

                    .join(" "),

                  email,
                ) || `طالب ${index + 1}`

              const values = scoreValues(attempt)

              return {
                studentKey:
                  getText(
                    student.id,

                    student.studentId,

                    attempt.studentId,

                    attempt.userId,
                  ) ||
                  stableStudentKey(student, email, studentName) ||
                  `${quizId}-${index}`,

                studentName,

                email,

                courseId,

                courseTitle: courseInfo?.title ?? "دورة",

                quizTitle: getText(quiz.title, lesson.title, "اختبار"),

                ...values,

                totalScore: values.total,

                submittedAt: formatDate(
                  attempt.submittedAt ??
                    attempt.completedAt ??
                    attempt.createdAt,
                ),
              }
            })
          } catch (cause) {
            if (cause instanceof ApiError && cause.status === 404) return []

            warnings.push(
              cause instanceof Error
                ? cause.message
                : "تعذر تحميل محاولة اختبار.",
            )

            return []
          }
        }),
      ).then((groups) => groups.flat())
    }),
  )

  const attempts: AttemptRow[] = []

  for (const result of courseDetails) {
    if (result.status === "fulfilled") attempts.push(...result.value)
    else
      warnings.push(
        result.reason instanceof Error
          ? result.reason.message
          : "تعذر تحميل بعض تفاصيل الدورات أو نتائج الاختبارات.",
      )
  }

  return { courses, enrollments, attempts, warnings: [...new Set(warnings)] }
}

function ProgressSubjectSkeleton({ count }: { count?: number }) {
  return (
    <div
      aria-busy="true"
      aria-label="جارٍ تحميل المواد الدراسية"
      className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3"
    >
      {Array.from({ length: getLoadingItemCount(count) }, (_, item) => (
        <div
          key={item}
          aria-hidden="true"
          className="flex min-h-28 items-center gap-4 rounded-2xl border border-stroke bg-white p-5 shadow-nuwa"
        >
          <Skeleton className="size-12 shrink-0 rounded-2xl" />
          <div className="min-w-0 flex-1">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="mt-2 h-3 w-1/3" />
          </div>
          <Skeleton className="size-4 shrink-0 rounded-full" />
        </div>
      ))}
    </div>
  )
}

export default function TeacherStudentProgress() {
  const [reloadKey, setReloadKey] = useState(0)

  const load = useCallback(() => loadStudentProgress(), [])

  const { data, error, loading } = useApiQuery(
    load,
    reloadKey,
    true,
    "teacher:student-progress",
  )

  const [selectedStudent, setSelectedStudent] = useState<string | null>(null)

  const [selectedSubject, setSelectedSubject] = useState<string | null>(null)

  const subjectOptions = useMemo(() => {
    const courses = data?.courses ?? []

    const subjects = new Map<string, {
      key: string
      name: string
      courseCount: number
      courseIds: Set<string>
    }>()

    for (const course of courses) {
      const name = course.subjectName || "مادة غير محددة"

      const key = course.subjectId || name

      const subject = subjects.get(key) ?? {
        key,

        name,

        courseCount: 0,

        courseIds: new Set<string>(),
      }

      subject.courseIds.add(course.id)

      subject.courseCount = subject.courseIds.size

      subjects.set(key, subject)
    }

    return [...subjects.values()].sort((left, right) =>
      left.name.localeCompare(right.name, "ar"),
    )
  }, [data?.courses])

  const selectedSubjectInfo =
    subjectOptions.find((subject) => subject.key === selectedSubject) ?? null

  const subjectCourseIds = useMemo(
    () => selectedSubjectInfo?.courseIds ?? new Set<string>(),

    [selectedSubjectInfo],
  )

  const subjectEnrollments = useMemo(
    () =>
      selectedSubject
        ? (data?.enrollments ?? []).filter((enrollment) =>
            subjectCourseIds.has(enrollment.courseId),
          )
        : [],

    [data?.enrollments, selectedSubject, subjectCourseIds],
  )

  const subjectAttempts = useMemo(
    () =>
      selectedSubject
        ? (data?.attempts ?? []).filter((attempt) =>
            subjectCourseIds.has(attempt.courseId),
          )
        : [],

    [data?.attempts, selectedSubject, subjectCourseIds],
  )

  const overview = useMemo(() => {
    const enrollments = subjectEnrollments

    const attempts = subjectAttempts

    const students = new Map<string, {
      key: string

      name: string

      email: string

      phone: string

      enrollments: EnrollmentRow[]

      attempts: AttemptRow[]
    }>()

    const ensureStudent = (key: string, name: string, email: string) => {
      const student = students.get(key) ?? {
        key,

        name,

        email,

        phone: "",

        enrollments: [],

        attempts: [],
      }

      student.name ||= name

      student.email ||= email

      students.set(key, student)

      return student
    }

    enrollments.forEach((enrollment) => {
      const student = ensureStudent(
        enrollment.studentKey,

        enrollment.studentName,

        enrollment.email,
      )

      student.phone ||= enrollment.phone

      student.enrollments.push(enrollment)
    })

    attempts.forEach((attempt) => {
      const student = ensureStudent(
        attempt.studentKey,

        attempt.studentName,

        attempt.email,
      )

      student.attempts.push(attempt)
    })

    return [...students.values()].sort((left, right) =>
      left.name.localeCompare(right.name, "ar"),
    )
  }, [subjectAttempts, subjectEnrollments])

  const totalQuizScore = subjectAttempts

    .map((attempt) => attempt.percentage)

    .filter((value): value is number => value !== null)

  const averageQuizScore = totalQuizScore.length
    ? Math.round(
        totalQuizScore.reduce((total, score) => total + score, 0) /
          totalQuizScore.length,
      )
    : null

  const activeEnrollments = subjectEnrollments.filter(
    (enrollment) => !/reject|declin|cancel/i.test(enrollment.status),
  )

  const completionValues = activeEnrollments

    .map((enrollment) => enrollment.progressPercent)

    .filter((value): value is number => value !== null)

  const averageCompletion = completionValues.length
    ? Math.round(
        completionValues.reduce((total, value) => total + value, 0) /
          completionValues.length,
      )
    : null

  return (
    <section className="mb-6 space-y-5">
      <div className="rounded-2xl border border-stroke bg-white p-5 shadow-nuwa sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <span className="text-xs font-bold text-nuwa-base">
              لوحة متابعة المعلم
            </span>
            <h2 className="mt-1 text-xl font-bold text-ink">
              متابعة تقدم الطلاب حسب المادة
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-ink-muted">
              اختر المادة الدراسية لعرض طلابها، ثم افتح بطاقة الطالب لمراجعة
              تقدمه ونتائج اختباراته.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setReloadKey((key) => key + 1)}
            disabled={loading}
            className="rounded-lg border border-stroke px-4 py-2 text-sm font-semibold text-ink transition hover:bg-canvas disabled:opacity-50"
          >
            تحديث البيانات
          </button>
        </div>
        {!loading && !error && selectedSubjectInfo && (
          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <SummaryCard
              label="الدورات في المادة"
              value={selectedSubjectInfo.courseCount}
            />
            <SummaryCard label="الطلاب" value={overview.length} />
            <SummaryCard
              label="التحاقات نشطة"
              value={activeEnrollments.length}
            />
            <SummaryCard
              label="متوسط درجات الاختبارات"
              value={averageQuizScore === null ? "—" : `${averageQuizScore}٪`}
            />
          </div>
        )}
        {!loading && !error && averageCompletion !== null && (
          <div className="mt-3 rounded-xl border border-stroke bg-canvas/70 p-4">
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="font-semibold text-ink-muted">
                متوسط التقدم الدراسي المتاح
              </span>
              <span className="font-bold tabular-nums text-ink">
                <AnimatedNumber value={`${averageCompletion}٪`} />
              </span>
            </div>
            <div
              className="mt-2 h-2 overflow-hidden rounded-full bg-nuwa-soft"
              role="progressbar"
              aria-label="متوسط تقدم الطلاب"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={averageCompletion}
            >
              <AnimatedBar
                className="h-full rounded-full bg-nuwa-base"
                value={averageCompletion}
              />
            </div>
          </div>
        )}
      </div>

      {data?.warnings.map((warning) => (
        <p
          key={warning}
          role="status"
          className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900"
        >
          {warning}
        </p>
      ))}

      <ApiQueryState
        loading={loading}
        loadingContent={
          <ProgressSubjectSkeleton
            count={data === null ? undefined : subjectOptions.length}
          />
        }
        error={
          error ? "تعذر تحميل تقدم الطلاب الآن. حاول تحديث البيانات." : null
        }
        isEmpty={!subjectOptions.length}
        emptyMessage="لا توجد مواد مرتبطة بدوراتك حتى الآن."
        onRetry={() => setReloadKey((key) => key + 1)}
      >
        {!selectedSubjectInfo ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {subjectOptions.map((subject) => (
              <button
                key={subject.key}
                type="button"
                onClick={() => {
                  setSelectedStudent(null)

                  setSelectedSubject(subject.key)
                }}
                className="group flex min-h-28 items-center gap-4 rounded-2xl border border-stroke bg-white p-5 text-start shadow-nuwa transition hover:-translate-y-0.5 hover:border-nuwa-bright hover:shadow-nuwa-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nuwa-bright"
              >
                <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-nuwa-soft text-nuwa-base transition group-hover:bg-nuwa-base group-hover:text-white">
                  <BookOpen size={21} aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-bold text-ink">
                    {subject.name}
                  </span>
                  <span className="mt-1 block text-xs text-ink-muted">
                    {subject.courseCount}{" "}
                    {subject.courseCount === 1 ? "دورة" : "دورات"}
                  </span>
                </span>
                <ArrowRight
                  size={18}
                  className="shrink-0 text-ink-muted transition group-hover:-translate-x-1 group-hover:text-nuwa-base"
                  aria-hidden="true"
                />
              </button>
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-stroke bg-white p-4 shadow-nuwa">
              <div className="flex min-w-0 items-center gap-3">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-nuwa-soft text-nuwa-base">
                  <BookOpen size={19} aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <h3 className="truncate font-bold text-ink">
                    {selectedSubjectInfo.name}
                  </h3>
                  <p className="text-xs text-ink-muted">
                    {overview.length} طالب · {selectedSubjectInfo.courseCount}{" "}
                    دورات
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelectedSubject(null)

                  setSelectedStudent(null)
                }}
                className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-stroke px-3 text-sm font-semibold text-ink-muted transition hover:bg-canvas hover:text-ink"
              >
                <ArrowRight size={16} aria-hidden="true" />
                كل المواد
              </button>
            </div>
            {overview.length > 0 ? (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {overview.map((student) => {
                  const expanded = selectedStudent === student.key

                  const studentScores = student.attempts

                    .map((attempt) => attempt.percentage)

                    .filter((value): value is number => value !== null)

                  const studentAverage = studentScores.length
                    ? Math.round(
                        studentScores.reduce((sum, value) => sum + value, 0) /
                          studentScores.length,
                      )
                    : null

                  const availableProgress = student.enrollments

                    .map((enrollment) => enrollment.progressPercent)

                    .filter((value): value is number => value !== null)

                  const progressAverage = availableProgress.length
                    ? Math.round(
                        availableProgress.reduce(
                          (sum, value) => sum + value,
                          0,
                        ) / availableProgress.length,
                      )
                    : null

                  return (
                    <article
                      key={student.key}
                      className="overflow-hidden rounded-[24px] border border-stroke bg-white shadow-nuwa transition-shadow hover:shadow-nuwa-md"
                    >
                      <button
                        type="button"
                        onClick={() =>
                          setSelectedStudent(expanded ? null : student.key)
                        }
                        aria-expanded={expanded}
                        className="flex min-h-[76px] w-full items-center gap-3 p-3 text-start transition hover:bg-canvas/50"
                      >
                        <PersonAvatar name={student.name} size="sm" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-bold text-ink">
                            {student.name}
                          </span>
                          <span className="mt-1 block text-xs text-ink-muted">
                            {expanded
                              ? "تفاصيل التقدم مفتوحة"
                              : "فتح تفاصيل التقدم"}
                          </span>
                        </span>
                        <ChevronDown
                          size={18}
                          className={`shrink-0 text-ink-muted transition-transform ${
                            expanded ? "rotate-180" : ""
                          }`}
                          aria-hidden="true"
                        />
                      </button>

                      {expanded && (
                        <StudentDetailDialog
                          title={student.name}
                          description={`تقدم الطالب في مادة ${selectedSubjectInfo.name}`}
                          onClose={() => setSelectedStudent(null)}
                        >
                          <div className="space-y-5 border-t border-stroke bg-canvas/50 p-4 sm:p-5">
                            {(student.email || student.phone) && (
                              <p className="text-xs text-ink-muted">
                                {[student.email, student.phone]

                                  .filter(Boolean)

                                  .join(" · ")}
                              </p>
                            )}
                            <div className="grid gap-3 sm:grid-cols-3">
                              <SummaryCard
                                label="متوسط تقدم الدورات"
                                value={
                                  progressAverage === null
                                    ? "غير متاح"
                                    : `${progressAverage}٪`
                                }
                              />
                              <SummaryCard
                                label="محاولات الاختبارات"
                                value={student.attempts.length}
                              />
                              <SummaryCard
                                label="متوسط نتيجة الاختبار"
                                value={
                                  studentAverage === null
                                    ? "—"
                                    : `${studentAverage}٪`
                                }
                              />
                            </div>

                            <div>
                              <h3 className="mb-2 text-sm font-bold text-ink">
                                الدورات والالتحاق
                              </h3>
                              {student.enrollments.length ? (
                                <div className="grid gap-2 sm:grid-cols-2">
                                  {student.enrollments.map((enrollment) => (
                                    <div
                                      key={`${enrollment.courseId}-${enrollment.status}`}
                                      className="rounded-xl border border-stroke bg-white p-4"
                                    >
                                      <div className="flex items-start justify-between gap-3">
                                        <p className="font-semibold text-ink">
                                          {enrollment.courseTitle}
                                        </p>
                                        <span className="rounded-full bg-nuwa-soft px-2.5 py-1 text-[11px] font-bold text-nuwa-deep">
                                          {statusLabel(enrollment.status)}
                                        </span>
                                      </div>
                                      {enrollment.progressPercent !== null ? (
                                        <div className="mt-3">
                                          <div className="flex justify-between text-xs text-ink-muted">
                                            <span>التقدم</span>
                                            <span className="font-bold tabular-nums">
                                              <AnimatedNumber
                                                value={`${Math.round(enrollment.progressPercent)}٪`}
                                              />
                                            </span>
                                          </div>
                                          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-nuwa-soft">
                                            <AnimatedBar
                                              className="h-full rounded-full bg-nuwa-base"
                                              value={enrollment.progressPercent}
                                            />
                                          </div>
                                          {enrollment.completedLessons !==
                                            null &&
                                            enrollment.totalLessons !==
                                              null && (
                                              <p className="mt-1 text-[11px] text-ink-muted">
                                                {enrollment.completedLessons} من{" "}
                                                {enrollment.totalLessons} درس
                                              </p>
                                            )}
                                        </div>
                                      ) : (
                                        <p className="mt-2 text-xs text-ink-muted">
                                          تقدم الدروس غير متاح من بيانات الخادم.
                                        </p>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <p className="rounded-xl border border-dashed border-stroke-strong bg-white p-4 text-sm text-ink-muted">
                                  لا توجد بيانات التحاق لهذا الطالب ضمن
                                  الاستجابة المتاحة.
                                </p>
                              )}
                            </div>

                            <div>
                              <h3 className="mb-2 text-sm font-bold text-ink">
                                نتائج الاختبارات
                              </h3>
                              {student.attempts.length ? (
                                <div className="overflow-x-auto rounded-xl border border-stroke bg-white">
                                  <table className="w-full min-w-[600px] text-start text-sm">
                                    <thead className="bg-canvas text-xs text-ink-muted">
                                      <tr>
                                        <th className="px-4 py-3 font-semibold">
                                          الدورة والاختبار
                                        </th>
                                        <th className="px-4 py-3 font-semibold">
                                          الدرجة
                                        </th>
                                        <th className="px-4 py-3 font-semibold">
                                          النسبة
                                        </th>
                                        <th className="px-4 py-3 font-semibold">
                                          التسليم
                                        </th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-stroke">
                                      {student.attempts.map((attempt) => (
                                        <tr
                                          key={`${attempt.courseId}-${attempt.quizTitle}-${attempt.submittedAt}`}
                                        >
                                          <td className="px-4 py-3">
                                            <p className="font-semibold text-ink">
                                              {attempt.courseTitle}
                                            </p>
                                            <p className="mt-1 text-xs text-ink-muted">
                                              {attempt.quizTitle}
                                            </p>
                                          </td>
                                          <td className="px-4 py-3 font-bold tabular-nums text-ink">
                                            {attempt.score === null
                                              ? "غير متاح"
                                              : attempt.totalScore === null
                                                ? attempt.score
                                                : `${attempt.score} / ${attempt.totalScore}`}
                                          </td>
                                          <td className="px-4 py-3 text-ink-muted">
                                            {attempt.percentage === null
                                              ? "—"
                                              : `${Math.round(attempt.percentage)}٪`}
                                          </td>
                                          <td className="px-4 py-3 text-xs text-ink-muted">
                                            {attempt.submittedAt}
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              ) : (
                                <p className="rounded-xl border border-dashed border-stroke-strong bg-white p-4 text-sm text-ink-muted">
                                  لا توجد محاولات اختبار مسجلة لهذا الطالب.
                                </p>
                              )}
                            </div>
                          </div>
                        </StudentDetailDialog>
                      )}
                    </article>
                  )
                })}
              </div>
            ) : (
              <p className="rounded-2xl border border-dashed border-stroke-strong bg-white p-6 text-center text-sm text-ink-muted">
                لا توجد سجلات تقدم لطلاب هذه المادة حتى الآن.
              </p>
            )}
          </div>
        )}
      </ApiQueryState>
    </section>
  )
}

function SummaryCard({
  label,

  value,
}: {
  label: string

  value: string | number
}) {
  return (
    <div className="rounded-xl border border-stroke bg-canvas/70 p-4">
      <p className="text-xs font-semibold text-ink-muted">{label}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums text-ink">
        <AnimatedNumber value={value} />
      </p>
    </div>
  )
}
