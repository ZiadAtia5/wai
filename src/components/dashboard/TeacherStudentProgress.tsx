import { useCallback, useMemo, useState } from "react"

import { ApiError } from "../../api/client"

import { quizzesApi, teachersApi } from "../../api/endpoints"

import ApiQueryState from "../ApiQueryState"

import { useApiQuery } from "../../hooks/useApiQuery"

type DataRecord = Record<string, unknown>

interface CourseInfo {
  id: string

  title: string
}

interface EnrollmentRow {
  studentKey: string

  studentName: string

  email: string

  phone: string

  courseId: string

  courseTitle: string

  status: string

  progressPercent: number | null

  completedLessons: number | null

  totalLessons: number | null
}

interface AttemptRow {
  studentKey: string

  studentName: string

  email: string

  courseId: string

  courseTitle: string

  quizTitle: string

  score: number | null

  totalScore: number | null

  percentage: number | null

  submittedAt: string
}

interface ProgressData {
  courses: CourseInfo[]

  enrollments: EnrollmentRow[]

  attempts: AttemptRow[]

  warnings: string[]
}

function asRecord(value: unknown): DataRecord {
  return typeof value === "object" && value !== null ? value as DataRecord : {}
}

function records(value: unknown): DataRecord[] {
  if (Array.isArray(value))
    return value.filter(
      (item): item is DataRecord => typeof item === "object" && item !== null,
    )

  const root = asRecord(value)

  for (const key of [
    "items",
    "results",

    "data",

    "courses",

    "modules",

    "lessons",

    "attempts",

    "requests",

    "enrollments",
  ]) {
    if (Array.isArray(root[key])) return records(root[key])
  }
  for (const key of ["data", "result", "response"]) {
    if (root[key] && typeof root[key] === "object") return records(root[key])
  }
  return []
}

function unwrap(value: unknown, ...keys: string[]): DataRecord {
  const root = asRecord(value)

  for (const key of keys) {
    if (root[key] !== undefined) return asRecord(root[key])

    const nestedData = asRecord(root.data)

    if (nestedData[key] !== undefined) return asRecord(nestedData[key])
  }

  return asRecord(root.data ?? root)
}

function getText(...values: unknown[]): string {
  const found = values.find(
    (value) =>
      (typeof value === "string" && value.trim()) || typeof value === "number",
  )

  return found === undefined ? "" : String(found).trim()
}

function getNumber(...values: unknown[]): number | null {
  const value = values.find(
    (candidate) =>
      candidate !== null &&
      candidate !== undefined &&
      candidate !== "" &&
      Number.isFinite(Number(candidate)),
  )

  return value === undefined ? null : Number(value)
}

function stableStudentKey(student: DataRecord, email: string, name: string) {
  return getText(student.id, student.studentId) || email.toLowerCase() || name
}

function enrollmentRows(
  response: unknown,

  courseById: Map<string, CourseInfo>,
): EnrollmentRow[] {
  if (Array.isArray(response))
    return response.flatMap((page) => enrollmentRows(page, courseById))

  const root = asRecord(response)

  const groupedRows: EnrollmentRow[] = []

  const add = (
    request: DataRecord,

    parent: DataRecord = {},

    index = 0,
  ) => {
    const course = asRecord(request.course ?? parent.course)
    const student = asRecord(request.student ?? request.studentProfile)

    const progressDetails = asRecord(request.progress ?? request.courseProgress)

    const courseId = getText(
      request.courseId,

      course.id,

      course.courseId,

      parent.courseId,

      parent.id,
    )

    const courseInfo = courseById.get(courseId)

    const email = getText(
      request.studentEmail,

      request.email,

      student.email,
    )

    const studentName =
      getText(
        request.studentName,

        request.fullName,

        student.fullName,

        student.displayName,

        student.name,

        [student.firstName, student.lastName]

          .filter((part) => typeof part === "string")

          .join(" "),

        email,
      ) || `طالب ${index + 1}`

    const studentKey =
      getText(
        student.id,
        student.studentId,
        request.studentId,
        request.userId,
      ) ||
      stableStudentKey(student, email, studentName) ||
      `${courseId || "course"}-${index}`

    const progressPercent = getNumber(
      request.progressPercentage,
      request.progressPercent,
      request.completionPercentage,
      progressDetails.progressPercentage,
      progressDetails.progressPercent,
      progressDetails.completionPercentage,
    )
    const completed = getNumber(
      request.completedLessons,
      request.completedLessonCount,
      request.lessonsCompleted,
      progressDetails.completedLessons,
      progressDetails.completedLessonCount,
    )
    const total = getNumber(
      request.totalLessons,
      request.lessonCount,
      request.lessonsCount,
      progressDetails.totalLessons,
      progressDetails.lessonCount,
    )

    groupedRows.push({
      studentKey,

      studentName,

      email,

      phone: getText(
        request.studentPhone,
        request.phoneNumber,
        student.phoneNumber,
      ),

      courseId,

      courseTitle:
        getText(
          request.courseTitle,

          course.title,

          course.name,

          parent.courseTitle,

          courseInfo?.title,
        ) || "دورة",

      status: getText(
        request.status,

        request.enrollmentStatus,

        request.isApproved === true ? "approved" : "",

        request.isApproved === false ? "pending" : "",
      ),

      progressPercent:
        progressPercent !== null &&
        progressPercent >= 0 &&
        progressPercent <= 100
          ? progressPercent
          : completed !== null && total !== null && total > 0 && completed >= 0
            ? Math.min(100, (completed / total) * 100)
            : null,

      completedLessons: completed,

      totalLessons: total,
    })
  }

  const nestedCourses = records(root.courses)

  for (const [courseIndex, course] of nestedCourses.entries()) {
    const requests = records(
      course.requests ?? course.enrollmentRequests ?? course.enrollments,
    )

    requests.forEach((request, index) => add(request, course, index))

    if (!requests.length && course.student) add(course, course, courseIndex)
  }

  const requestsRoot =
    root.requests ?? root.items ?? root.enrollments ?? root.data ?? response

  for (const [index, item] of records(requestsRoot).entries()) {
    const children = records(
      item.requests ?? item.enrollmentRequests ?? item.enrollments,
    )

    if (children.length) {
      children.forEach((child, childIndex) => add(child, item, childIndex))
    } else if (item.student || item.studentId || item.studentName) {
      add(item, {}, index)
    }
  }

  const unique = new Map<string, EnrollmentRow>()

  for (const row of groupedRows) {
    const key = `${row.studentKey}:${row.courseId}`

    unique.set(key, { ...unique.get(key), ...row })
  }

  return [...unique.values()]
}

function scoreValues(attempt: DataRecord) {
  const score = getNumber(
    attempt.score,

    attempt.pointsEarned,

    attempt.earnedPoints,

    attempt.grade,
  )

  const total = getNumber(
    attempt.totalPoints,

    attempt.maxScore,

    attempt.totalScore,

    attempt.outOf,
  )

  const percentage = getNumber(attempt.percentage, attempt.scorePercentage)

  return {
    score,

    total,

    percentage:
      percentage !== null
        ? percentage
        : score !== null && total !== null && total > 0
          ? (score / total) * 100
          : null,
  }
}

function formatDate(value: unknown): string {
  if (typeof value !== "string" || !value) return "غير محدد"

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) return value

  return new Intl.DateTimeFormat("ar-EG", {
    dateStyle: "medium",

    timeStyle: "short",
  }).format(date)
}

function statusLabel(status: string): string {
  if (/reject|declin|cancel/i.test(status)) return "مرفوض"

  if (/pending|await|review/i.test(status)) return "بانتظار الموافقة"

  if (/complete|finish/i.test(status)) return "مكتمل"

  if (/approv|active|accept|enroll/i.test(status)) return "ملتحق"

  return status || "غير محدد"
}

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

    return id
      ? [
          {
            id,

            title: getText(course.title, course.name) || `دورة ${id}`,
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

      const courseInfo = courseById.get(courseId)

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

export default function TeacherStudentProgress() {
  const [reloadKey, setReloadKey] = useState(0)

  const load = useCallback(() => loadStudentProgress(), [])

  const { data, error, loading } = useApiQuery(load, reloadKey)

  const [selectedStudent, setSelectedStudent] = useState<string | null>(null)

  const overview = useMemo(() => {
    const enrollments = data?.enrollments ?? []

    const attempts = data?.attempts ?? []

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
  }, [data])

  const totalQuizScore = (data?.attempts ?? [])

    .map((attempt) => attempt.percentage)

    .filter((value): value is number => value !== null)

  const averageQuizScore = totalQuizScore.length
    ? Math.round(
        totalQuizScore.reduce((total, score) => total + score, 0) /
          totalQuizScore.length,
      )
    : null

  const activeEnrollments = (data?.enrollments ?? []).filter(
    (enrollment) => !/reject|declin|cancel/i.test(enrollment.status),
  )

  const pendingEnrollments = activeEnrollments.filter((enrollment) =>
    /pending|await|review/i.test(enrollment.status),
  ).length

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
              تقدم الطلاب وإحصائياتهم
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-ink-muted">
              نظرة عامة على دوراتك وطلابك، ثم افتح أي طالب لمراجعة كل دورة
              ومحاولات الاختبارات والدرجات المتاحة له.
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
        {!loading && !error && data && (
          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            <SummaryCard label="الدورات" value={data.courses.length} />
            <SummaryCard label="الطلاب" value={overview.length} />
            <SummaryCard
              label="التحاقات نشطة"
              value={activeEnrollments.length}
            />
            <SummaryCard label="بانتظار الموافقة" value={pendingEnrollments} />
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
                {averageCompletion}٪
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
              <div
                className="h-full rounded-full bg-nuwa-base"
                style={{ width: `${averageCompletion}%` }}
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
        error={error}
        isEmpty={!overview.length}
        emptyMessage="لا توجد سجلات طلاب أو محاولات اختبارات مرتبطة بدوراتك حتى الآن."
        onRetry={() => setReloadKey((key) => key + 1)}
      >
        {overview.length > 0 && (
          <div className="space-y-3">
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
                    availableProgress.reduce((sum, value) => sum + value, 0) /
                      availableProgress.length,
                  )
                : null

              return (
                <article
                  key={student.key}
                  className="overflow-hidden rounded-2xl border border-stroke bg-white shadow-nuwa"
                >
                  <button
                    type="button"
                    onClick={() =>
                      setSelectedStudent(expanded ? null : student.key)
                    }
                    aria-expanded={expanded}
                    className="grid w-full gap-4 p-4 text-start transition hover:bg-canvas/70 sm:grid-cols-[minmax(180px,1.3fr)_repeat(3,minmax(100px,.7fr))_auto] sm:items-center sm:p-5"
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-bold text-ink">
                        {student.name}
                      </span>
                      <span className="mt-1 block truncate text-xs text-ink-muted">
                        {student.email ||
                          student.phone ||
                          "بيانات الاتصال غير متاحة"}
                      </span>
                    </span>
                    <Metric
                      label="الدورات"
                      value={student.enrollments.length}
                    />
                    <Metric
                      label="الاختبارات"
                      value={student.attempts.length}
                    />
                    <Metric
                      label="متوسط الدرجات"
                      value={
                        studentAverage === null ? "—" : `${studentAverage}٪`
                      }
                    />
                    <span className="text-xs font-bold text-nuwa-base">
                      {expanded ? "إخفاء التفاصيل" : "تفاصيل الطالب"}
                    </span>
                  </button>

                  {expanded && (
                    <div className="space-y-5 border-t border-stroke bg-canvas/50 p-4 sm:p-5">
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
                            studentAverage === null ? "—" : `${studentAverage}٪`
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
                                        {Math.round(enrollment.progressPercent)}
                                        ٪
                                      </span>
                                    </div>
                                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-nuwa-soft">
                                      <div
                                        className="h-full rounded-full bg-nuwa-base"
                                        style={{
                                          width: `${enrollment.progressPercent}%`,
                                        }}
                                      />
                                    </div>
                                    {enrollment.completedLessons !== null &&
                                      enrollment.totalLessons !== null && (
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
                            لا توجد بيانات التحاق لهذا الطالب ضمن الاستجابة
                            المتاحة.
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
                  )}
                </article>
              )
            })}
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
      <p className="mt-1 text-2xl font-bold tabular-nums text-ink">{value}</p>
    </div>
  )
}

interface MetricProps {
  label: string
  value: string | number
}

function Metric({ label, value }: MetricProps) {
  return (
    <span className="flex items-center justify-between gap-3 rounded-lg bg-canvas px-3 py-2 sm:block sm:bg-transparent sm:p-0">
      <span className="text-xs text-ink-muted sm:block">{label}</span>
      <span className="font-bold tabular-nums text-ink sm:mt-1 sm:block">
        {value}
      </span>
    </span>
  )
}
