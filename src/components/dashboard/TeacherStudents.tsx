import { useCallback, useMemo, useState } from "react"

import { BookOpen, Search, UsersRound } from "lucide-react"

import { teachersApi } from "../../api/endpoints"

import { useApiQuery } from "../../hooks/useApiQuery"

import ApiQueryState from "../ApiQueryState"

import PersonAvatar from "../PersonAvatar"

import StudentDetailDialog from "./StudentDetailDialog"

import { fieldLabels, formatValue } from "./StudentDetailsCard"

type DataRecord = Record<string, unknown>

interface EnrolledStudent {
  key: string

  name: string

  email: string

  phone: string

  avatarUrl: string

  fields: DataRecord

  courses: Map<string, string>
}

interface EnrollmentEntry {
  request: DataRecord
  course: DataRecord
}

function record(value: unknown): DataRecord {
  return typeof value === "object" && value !== null ? value as DataRecord : {}
}

function text(...values: unknown[]): string {
  const value = values.find(
    (item) =>
      (typeof item === "string" && item.trim()) || typeof item === "number",
  )

  return value === undefined ? "" : String(value).trim()
}

function pageCount(value: unknown): number {
  const root = record(value)

  const nested = record(root.data)

  const count = Number(root.totalPages ?? nested.totalPages ?? 1)

  return Number.isFinite(count) ? Math.max(1, Math.ceil(count)) : 1
}

async function loadAllEnrollmentRequests(): Promise<unknown[]> {
  const firstPage = await teachersApi.enrollmentRequests({
    page: 1,

    pageSize: 500,
  })

  const pages = await Promise.all(
    Array.from({ length: pageCount(firstPage) - 1 }, (_, index) =>
      teachersApi.enrollmentRequests({ page: index + 2, pageSize: 500 }),
    ),
  )

  return [firstPage, ...pages]
}

function approved(value: DataRecord): boolean {
  const status = String(
    value.status ?? value.enrollmentStatus ?? value.state ?? "",
  )

    .trim()

    .toLowerCase()

  return (
    value.isApproved === true ||
    [
      "approved",
      "accepted",
      "active",
      "enrolled",
      "completed",
      "1",
      "3",
    ].includes(status)
  )
}

function collectEnrollments(
  value: unknown,

  output: EnrollmentEntry[] = [],

  course: DataRecord = {},

  depth = 0,
) {
  if (depth > 8) return output

  if (Array.isArray(value)) {
    value.forEach((item) => collectEnrollments(item, output, course, depth + 1))

    return output
  }

  const current = record(value)

  const ownCourse = record(current.course)

  const courseContext = {
    ...course,

    ...ownCourse,

    ...(current.title || current.courseTitle ? current : {}),
  }

  const nestedRequests =
    current.requests ?? current.enrollmentRequests ?? current.enrollments

  if (Array.isArray(nestedRequests)) {
    collectEnrollments(nestedRequests, output, courseContext, depth + 1)
  }

  const student = record(current.student ?? current.studentProfile)

  const hasStudent =
    Object.keys(student).length > 0 ||
    current.studentId !== undefined ||
    current.studentName !== undefined

  if (hasStudent) output.push({ request: current, course: courseContext })

  if (!hasStudent && !Array.isArray(nestedRequests)) {
    for (const key of ["items", "results", "data", "requests", "courses"]) {
      if (current[key] !== undefined)
        collectEnrollments(current[key], output, courseContext, depth + 1)
    }
  }

  return output
}

function studentFields(
  student: DataRecord,
  enrollment: DataRecord,
): DataRecord {
  const merged = { ...student, ...enrollment }

  for (const key of Object.keys(merged)) {
    if (/password|token|secret/i.test(key)) delete merged[key]
    else if (["student", "studentProfile", "course", "teacher"].includes(key))
      delete merged[key]
  }

  return merged
}

function normalizeStudents(value: unknown): EnrolledStudent[] {
  const students = new Map<string, EnrolledStudent>()

  for (const { request, course } of collectEnrollments(value)) {
    if (!approved(request)) continue

    const profile = record(request.student ?? request.studentProfile)

    const id = text(
      profile.id,
      profile.studentId,
      request.studentId,
      request.userId,
    )

    const email = text(request.studentEmail, request.email, profile.email)

    const name =
      text(
        request.studentName,

        request.fullName,

        profile.fullName,

        profile.displayName,

        profile.name,

        [profile.firstName, profile.lastName].filter(Boolean).join(" "),

        email,
      ) || "طالب بدون اسم"

    const key = id || email.toLowerCase() || name

    const student = students.get(key) ?? {
      key,

      name,

      email,

      phone: "",

      avatarUrl: "",

      fields: {},

      courses: new Map<string, string>(),
    }

    student.email ||= email

    student.phone ||= text(
      request.studentPhone,

      request.phoneNumber,

      request.phone,

      profile.phoneNumber,
    )

    student.avatarUrl ||= text(
      request.avatarUrl,

      request.profileImageUrl,

      profile.avatarUrl,

      profile.profileImageUrl,
    )

    Object.assign(student.fields, studentFields(profile, request))

    const courseId = text(request.courseId, course.id, course.courseId)

    const courseName = text(
      request.courseTitle,

      course.title,

      course.name,

      course.courseTitle,
    )

    if (courseId || courseName)
      student.courses.set(courseId || courseName, courseName || "دورة تعليمية")

    students.set(key, student)
  }

  return [...students.values()].sort((left, right) =>
    left.name.localeCompare(right.name, "ar"),
  )
}

function displayField(value: unknown): string {
  if (Array.isArray(value))
    return value
      .map((item) => text(item))
      .filter(Boolean)
      .join("، ")

  if (typeof value === "object" && value !== null) {
    const nested = record(value)

    return (
      text(nested.arabicName, nested.name, nested.title, nested.value) || "—"
    )
  }

  return String(value)
}

export default function TeacherStudents() {
  const [reloadKey, setReloadKey] = useState(0)

  const [query, setQuery] = useState("")

  const [selectedStudentKey, setSelectedStudentKey] = useState<string | null>(
    null,
  )

  const load = useCallback(loadAllEnrollmentRequests, [])

  const { data, error, loading } = useApiQuery(load, reloadKey)

  const students = useMemo(() => normalizeStudents(data), [data])

  const normalizedQuery = query.trim().toLocaleLowerCase("ar-EG")

  const visibleStudents = useMemo(
    () =>
      students.filter((student) =>
        [student.name, student.email, student.phone]

          .join(" ")

          .toLocaleLowerCase("ar-EG")

          .includes(normalizedQuery),
      ),

    [normalizedQuery, students],
  )

  const selectedStudent =
    students.find((student) => student.key === selectedStudentKey) ?? null

  return (
    <section className="mb-6 space-y-5">
      <div className="rounded-2xl border border-stroke bg-white p-5 shadow-nuwa sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <span className="text-xs font-bold text-nuwa-base">
              مساحة المعلم
            </span>
            <h2 className="mt-1 text-xl font-bold text-ink">طلابي</h2>
            <p className="mt-1 text-sm text-ink-muted">
              الطلاب المعتمدون للالتحاق بدوراتك.
            </p>
          </div>
          <span className="inline-flex items-center gap-2 rounded-full bg-nuwa-soft px-3 py-1.5 text-xs font-bold text-nuwa-deep">
            <UsersRound size={15} aria-hidden="true" />
            {students.length} طالب
          </span>
        </div>
        <label className="mt-5 flex min-h-11 items-center gap-2 rounded-xl border border-stroke bg-canvas/60 px-3 transition-colors focus-within:border-nuwa-base">
          <Search
            size={17}
            className="shrink-0 text-ink-muted"
            aria-hidden="true"
          />
          <span className="sr-only">البحث عن طالب</span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="ابحث باسم الطالب أو بريده أو هاتفه"
            className="search-focus-input min-w-0 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-ink-muted"
          />
        </label>
      </div>

      <ApiQueryState
        loading={loading}
        loadingContent={
          <div className="min-h-48 rounded-2xl bg-white" aria-hidden="true" />
        }
        error={error}
        isEmpty={students.length === 0}
        emptyMessage="لا يوجد طلاب معتمدون للالتحاق بدوراتك حتى الآن."
        onRetry={() => setReloadKey((key) => key + 1)}
      >
        {students.length > 0 && visibleStudents.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-stroke-strong bg-white p-6 text-center text-sm text-ink-muted">
            لا توجد نتائج مطابقة للبحث.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {visibleStudents.map((student) => (
              <button
                key={student.key}
                type="button"
                onClick={() => setSelectedStudentKey(student.key)}
                className="flex min-h-[76px] min-w-0 items-center gap-3 rounded-2xl border border-stroke bg-white p-3 text-start shadow-nuwa transition hover:-translate-y-0.5 hover:border-nuwa-bright hover:shadow-nuwa-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nuwa-bright"
              >
                <PersonAvatar
                  name={student.name}
                  imageUrl={student.avatarUrl}
                  size="sm"
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-bold text-ink">
                    {student.name}
                  </span>
                  <span className="mt-1 flex items-center gap-1 text-xs text-ink-muted">
                    <BookOpen size={13} aria-hidden="true" />
                    {student.courses.size} دورة
                  </span>
                </span>
              </button>
            ))}
          </div>
        )}
      </ApiQueryState>

      {selectedStudent && (
        <StudentDetailDialog
          title={selectedStudent.name}
          description="بيانات الطالب ودوراته المسجل بها"
          onClose={() => setSelectedStudentKey(null)}
        >
          {(selectedStudent.email || selectedStudent.phone) && (
            <div className="mb-5 flex flex-wrap gap-x-5 gap-y-2 rounded-2xl bg-nuwa-ice p-4 text-sm text-ink-muted">
              {selectedStudent.email && <span>{selectedStudent.email}</span>}
              {selectedStudent.phone && <span>{selectedStudent.phone}</span>}
            </div>
          )}
          <h3 className="mb-3 text-sm font-bold text-ink">
            الدورات المسجل بها
          </h3>
          {selectedStudent.courses.size > 0 ? (
            <div className="mb-6 flex flex-wrap gap-2">
              {[...selectedStudent.courses.values()].map((course) => (
                <span
                  key={course}
                  className="rounded-full bg-nuwa-soft px-3 py-1.5 text-xs font-semibold text-nuwa-deep"
                >
                  {course}
                </span>
              ))}
            </div>
          ) : (
            <p className="mb-6 text-sm text-ink-muted">
              لا تتوفر أسماء الدورات في بيانات التسجيل.
            </p>
          )}
          <h3 className="mb-3 text-sm font-bold text-ink">بيانات الطالب</h3>
          <dl className="grid gap-2 sm:grid-cols-2">
            {Object.entries(selectedStudent.fields)

              .filter(
                ([key, value]) =>
                  !/password|token|secret|^course$|^teacher$/i.test(key) &&
                  value !== null &&
                  value !== undefined &&
                  value !== "",
              )

              .map(([key, value]) => (
                <div key={key} className="min-w-0 rounded-xl bg-canvas/70 p-3">
                  <dt className="text-xs font-semibold text-ink-muted">
                    {fieldLabels[key] ?? key}
                  </dt>
                  <dd className="mt-1 break-words text-sm text-ink">
                    {formatValue(key, displayField(value))}
                  </dd>
                </div>
              ))}
          </dl>
        </StudentDetailDialog>
      )}
    </section>
  )
}
