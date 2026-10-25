export type DataRecord = Record<string, unknown>

export interface CourseInfo {
  id: string

  title: string

  subjectId: string

  subjectName: string
}

export interface EnrollmentRow {
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

export interface AttemptRow {
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

export interface ProgressData {
  courses: CourseInfo[]

  enrollments: EnrollmentRow[]

  attempts: AttemptRow[]

  warnings: string[]
}

export function asRecord(value: unknown): DataRecord {
  return typeof value === "object" && value !== null ? value as DataRecord : {}
}

// API resources wrap lists under different keys, so normalize them in one place.

export function records(value: unknown): DataRecord[] {
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

export function unwrap(value: unknown, ...keys: string[]): DataRecord {
  const root = asRecord(value)

  for (const key of keys) {
    if (root[key] !== undefined) return asRecord(root[key])

    const nestedData = asRecord(root.data)

    if (nestedData[key] !== undefined) return asRecord(nestedData[key])
  }

  return asRecord(root.data ?? root)
}

export function getText(...values: unknown[]): string {
  const found = values.find(
    (value) =>
      (typeof value === "string" && value.trim()) || typeof value === "number",
  )

  return found === undefined ? "" : String(found).trim()
}

export function getNumber(...values: unknown[]): number | null {
  const value = values.find(
    (candidate) =>
      candidate !== null &&
      candidate !== undefined &&
      candidate !== "" &&
      Number.isFinite(Number(candidate)),
  )

  return value === undefined ? null : Number(value)
}

export function stableStudentKey(
  student: DataRecord,

  email: string,

  name: string,
) {
  return getText(student.id, student.studentId) || email.toLowerCase() || name
}

export function enrollmentRows(
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

export function scoreValues(attempt: DataRecord) {
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

export function formatDate(value: unknown): string {
  if (typeof value !== "string" || !value) return "غير محدد"

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) return value

  return new Intl.DateTimeFormat("ar-EG", {
    dateStyle: "medium",

    timeStyle: "short",
  }).format(date)
}

export function statusLabel(status: string): string {
  if (/reject|declin|cancel/i.test(status)) return "مرفوض"

  if (/pending|await|review/i.test(status)) return "بانتظار الموافقة"

  if (/complete|finish/i.test(status)) return "مكتمل"

  if (/approv|active|accept|enroll/i.test(status)) return "ملتحق"

  return status || "غير محدد"
}
