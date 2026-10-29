import { useEffect, useState } from "react"

import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  CircleDollarSign,
  GraduationCap,
  FileText,
  LockKeyhole,
  MessageCircle,
  Play,
  ShieldCheck,
  UserRound,
  X,
} from "lucide-react"

import { ApiError, getAuthToken, resolveApiAssetUrl } from "../api/client"

import { coursesApi, quizzesApi, studentsApi, teachersApi } from "../api/endpoints"

import LessonVideoPlayer, {
  youtubeVideoId,
} from "../components/dashboard/LessonVideoPlayer"

import {
  Skeleton,
  SkeletonButton,
  SkeletonIcon,
  SkeletonText,
} from "../components/Skeleton"

import { notifyError, notifySuccess } from "../utils/notifications"

import type { NavigateFn } from "../types"

import { formatEgp } from "../utils/currency"

import {
  forgetPendingEnrollment,
  readPendingEnrollments,
  rememberPendingEnrollment,
} from "../utils/pendingEnrollments"

type RecordValue = Record<string, unknown>

type AccessState = "checking" | "guest" | "not-student" | "not-enrolled" | "pending" | "approved" | "rejected" | "verification-failed"

function record(value: unknown): RecordValue {
  return typeof value === "object" && value !== null ? value as RecordValue : {}
}

function unwrap(value: unknown): unknown {
  let current = value

  for (let index = 0; index < 5; index += 1) {
    const item = record(current)

    if (!("data" in item) || Object.keys(item).length > 4) break

    current = item.data
  }

  return current
}

function list(value: unknown): RecordValue[] {
  const result = unwrap(value)

  if (Array.isArray(result))
    return result.map(record).filter((item) => Object.keys(item).length > 0)

  const item = record(result)

  for (const key of [
    "items",

    "modules",

    "courseModules",

    "lessons",

    "resources",

    "lessonResources",

    "attachments",

    "materials",

    "files",

    "enrollments",
  ]) {
    if (Array.isArray(item[key])) return (item[key] as unknown[]).map(record)
  }

  return []
}

function progressRows(value: unknown): RecordValue[] {
  const result = record(unwrap(value))

  const nested = record(result.courseProgress ?? result.progress)

  const direct = list(
    result.lessons ??
      result.lessonProgress ??
      nested.lessons ??
      nested.lessonProgress,
  )

  if (direct.length) return direct

  return list(result.modules ?? nested.modules).flatMap((module) =>
    list(module.lessons ?? module.courseLessons).map((lesson) => ({
      ...lesson,

      moduleTitle: module.title ?? module.name,
    })),
  )
}

function isTrue(value: unknown): boolean {
  return (
    value === true ||
    value === 1 ||
    (typeof value === "string" && /^(true|1|yes|completed|done)$/i.test(value))
  )
}

function lessonId(lesson: RecordValue): string {
  const id = lesson.id ?? lesson.lessonId

  return id === undefined || id === null ? "" : String(id)
}

function lessonCompleted(
  lesson: RecordValue,

  progressByLesson: Map<string, RecordValue>,
): boolean {
  const progress = progressByLesson.get(lessonId(lesson)) ?? {}

  const nested = record(progress.progress ?? progress.lessonProgress)

  return isTrue(
    progress.isCompleted ??
      progress.completed ??
      nested.isCompleted ??
      nested.completed ??
      lesson.isCompleted ??
      lesson.completed,
  )
}

function quizPassed(attempt: RecordValue): boolean {
  return attempt.passed === true || attempt.isPassed === true
}

function attemptRecords(value: unknown): RecordValue[] {
  const root = record(value)

  const records = [root, record(root.data), record(unwrap(value))]

  for (const result of records) {
    for (const key of ["items", "attempts", "results"]) {
      const candidate = result[key]

      if (Array.isArray(candidate)) return candidate.map(record)
    }
  }

  if (Array.isArray(value)) return value.map(record)

  return list(value)
}

function attemptBelongsToStudent(
  attempt: RecordValue,

  profile: RecordValue,
): boolean {
  const student = record(
    attempt.student ?? attempt.studentProfile ?? attempt.user,
  )

  const profileUser = record(profile.user)

  const attemptIds = [
    attempt.studentId,

    attempt.userId,

    student.id,

    student.studentId,

    student.userId,
  ]

    .filter((id) => id !== undefined && id !== null)

    .map(String)

  const profileIds = [
    profile.studentId,

    profile.userId,

    profile.id,

    profileUser.studentId,

    profileUser.id,

    profileUser.userId,
  ]

    .filter((id) => id !== undefined && id !== null)

    .map(String)

  if (attemptIds.some((id) => profileIds.includes(id))) return true

  const attemptEmail = String(
    attempt.studentEmail ?? attempt.email ?? student.email ?? "",
  )

    .trim()

    .toLowerCase()

  const profileEmail = String(profile.email ?? profileUser.email ?? "")

    .trim()

    .toLowerCase()

  return Boolean(attemptEmail && profileEmail && attemptEmail === profileEmail)
}

function passedQuizFromDetails(quiz: RecordValue): boolean | null {
  for (const key of ["hasPassed", "isPassed"]) {
    const value = quiz[key]

    if (typeof value === "boolean") return value
  }

  for (const key of [
    "myAttempt",

    "currentUserAttempt",

    "currentAttempt",
  ]) {
    const attempt = record(quiz[key])

    if (Object.keys(attempt).length) return quizPassed(attempt)
  }

  for (const key of ["myAttempts", "currentUserAttempts"]) {
    const attempts = quiz[key]

    if (
      Array.isArray(attempts) &&
      attempts.some((attempt) => quizPassed(record(attempt)))
    )
      return true
  }

  return null
}

async function studentPassedLessonQuiz(
  lesson: RecordValue,

  profile: RecordValue,
): Promise<boolean> {
  const id = lessonId(lesson)

  if (!id) throw new Error("تعذر التعرف على الدرس المرتبط بالاختبار.")

  const response = record(unwrap(await quizzesApi.forLesson(id)))

  const quiz = record(response.quiz ?? response)

  const knownResult = passedQuizFromDetails(quiz)

  if (knownResult !== null) return knownResult

  const quizId = quiz.id ?? quiz.quizId

  if (quizId === undefined || quizId === null)
    throw new Error("لم يُعِد الخادم بيانات الاختبار المتوقعة.")

  const attemptResponse = await quizzesApi.attempts(String(quizId))

  const attempts = attemptRecords(attemptResponse)

  return attempts.some(
    (attempt) =>
      attemptBelongsToStudent(attempt, profile) && quizPassed(attempt),
  )
}

function courseRecord(value: unknown): RecordValue {
  const result = record(unwrap(value))

  for (const key of [
    "course",
    "courseDetails",
    "courseData",
    "courseContent",
    "details",
    "result",
  ]) {
    if (result[key] && typeof result[key] === "object")
      return courseRecord(result[key])
  }

  return result
}

function mergeCourseLessonResources(
  primaryValue: unknown,
  supplementalValue: unknown,
): RecordValue {
  const primary = courseRecord(primaryValue)
  const supplemental = courseRecord(supplementalValue)
  const supplementalModules = list(
    supplemental.modules ?? supplemental.courseModules,
  )
  const supplementalLessons = new Map<string, RecordValue>()
  const primaryLessonById = new Map<string, RecordValue>()

  for (const lesson of list(primary.lessons)) {
    const id = lessonId(lesson)
    if (id) primaryLessonById.set(id, lesson)
  }

  for (const module of supplementalModules) {
    for (const lesson of list(module.lessons ?? module.courseLessons)) {
      const id = lessonId(lesson)
      if (id) supplementalLessons.set(id, lesson)
    }
  }

  for (const lesson of list(supplemental.lessons)) {
    const id = lessonId(lesson)
    if (id) supplementalLessons.set(id, lesson)
  }

  const primaryModules = list(primary.modules ?? primary.courseModules)
  const modulesSource = primaryModules.length
    ? primaryModules
    : supplementalModules
  const modules = modulesSource.map((module, index) => {
    const moduleId = String(module.id ?? module.moduleId ?? "")
    const supplementalModule = supplementalModules.find(
      (item) => moduleId && String(item.id ?? item.moduleId ?? "") === moduleId,
    )
    const moduleLessons = list(module.lessons ?? module.courseLessons)
    const lessonsSource = moduleLessons.length
      ? moduleLessons
      : list(supplementalModule?.lessons ?? supplementalModule?.courseLessons)

    return {
      ...(supplementalModule ?? {}),
      ...module,
      lessons: lessonsSource.map((lesson) => {
        const id = lessonId(lesson)
        const alternateLesson = id ? supplementalLessons.get(id) : undefined
        const primaryLesson = id ? primaryLessonById.get(id) : undefined
        const resources =
          lessonResourcesFrom(primaryLesson ?? lesson).length > 0
            ? lessonResourcesFrom(primaryLesson ?? lesson)
            : lessonResourcesFrom(alternateLesson ?? {})

        return resources.length > 0
          ? {
              ...(alternateLesson ?? {}),
              ...lesson,
              ...(primaryLesson ?? {}),
              resources,
            }
          : { ...(alternateLesson ?? {}), ...lesson, ...(primaryLesson ?? {}) }
      }),
      order: module.order ?? index + 1,
    }
  })

  return { ...supplemental, ...primary, modules }
}

function approvedEnrollment(value: RecordValue): boolean {
  if (value.isApproved === false) return false

  if (value.isApproved === true) return true

  const status = String(value.status ?? value.enrollmentStatus ?? "")

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

function enrollmentState(value: RecordValue | undefined): AccessState {
  if (!value) return "not-enrolled"

  if (approvedEnrollment(value)) return "approved"

  const status = String(value.status ?? value.enrollmentStatus ?? "")

    .trim()

    .toLowerCase()

  if (["2", "rejected", "declined", "cancelled", "canceled"].includes(status))
    return "rejected"

  return "pending"
}

function videoFromLesson(lesson: RecordValue): RecordValue | null {
  const source =
    lesson.video ??
    lesson.videoInfo ??
    lesson.videoResponse ??
    lesson.lessonVideo

  if (typeof source === "string" && source.trim())
    return { videoUrl: source.trim() }

  const video = record(source)

  if (
    (typeof video.videoUrl === "string" && video.videoUrl.trim()) ||
    (typeof video.providerVideoId === "string" && video.providerVideoId.trim())
  )
    return video

  return null
}

function lessonResourceUrl(resource: RecordValue): string {
  const file = record(
    resource.file ?? resource.attachment ?? resource.resourceFile,
  )
  const candidates = [
    resource.externalUrl,
    resource.externalLink,
    resource.fileUrl,
    resource.resourceFileUrl,
    resource.resourceUrl,
    resource.downloadUrl,
    resource.mediaUrl,
    resource.publicUrl,
    resource.storageUrl,
    resource.href,
    resource.filePath,
    resource.path,
    resource.url,
    typeof resource.file === "string" ? resource.file : undefined,
    file.downloadUrl,
    file.fileUrl,
    file.url,
    file.path,
  ]
  const value = candidates.find(
    (candidate): candidate is string =>
      typeof candidate === "string" && candidate.trim().length > 0,
  )

  return value?.trim() ?? ""
}

function lessonResourcesFrom(lesson: RecordValue): RecordValue[] {
  const content = record(lesson.content)
  const candidates = [
    lesson.resources,
    lesson.lessonResources,
    lesson.attachments,
    lesson.materials,
    lesson.files,
    lesson.resourceList,
    content.resources,
    content.attachments,
    content.materials,
    content.files,
  ]

  for (const candidate of candidates) {
    const items = list(candidate)
    if (items.length) return items
  }

  return []
}

function scrollToLessonContent(targetId: string) {
  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(() => {
      document.getElementById(targetId)?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      })
    })
  })
}

function CourseDetailsSkeleton() {
  return (
    <div aria-busy="true" aria-label="جارٍ تحميل تفاصيل الدورة">
      <section className="relative isolate flex min-h-[300px] items-end overflow-hidden rounded-[2rem] bg-gradient-to-br from-emerald-950 via-emerald-800 to-teal-700 p-6 text-white shadow-xl shadow-emerald-950/10 sm:min-h-[370px] sm:p-10">
        <div className="max-w-3xl">
          <Skeleton className="h-7 w-36 rounded-full bg-white/20" />
          <Skeleton className="mt-5 h-10 w-3/4 bg-white/25 sm:h-12" />
          <SkeletonText className="mt-4 max-w-2xl" lines={2} />
          <div className="mt-6 flex gap-2">
            <Skeleton className="h-7 w-20 rounded-full bg-white/20" />
            <Skeleton className="h-7 w-24 rounded-full bg-white/20" />
          </div>
        </div>
        <Skeleton className="absolute left-5 top-5 h-10 w-24 rounded-full bg-white/20 sm:left-8 sm:top-8" />
      </section>

      <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <section className="min-w-0 rounded-[1.75rem] border border-stroke bg-white p-5 shadow-nuwa-md sm:p-7">
          <div className="flex items-end justify-between gap-4 border-b border-stroke pb-5">
            <div>
              <Skeleton className="h-4 w-24" />
              <Skeleton className="mt-2 h-8 w-44" />
            </div>
            <Skeleton className="h-7 w-32 rounded-full" />
          </div>
          <div className="mt-5 space-y-4">
            {[0, 1, 2].map((item) => (
              <div
                key={item}
                aria-hidden="true"
                className="flex items-center gap-3 rounded-2xl border border-stroke bg-[#fbfdfb] p-4 sm:p-5"
              >
                <SkeletonIcon />
                <div className="min-w-0 flex-1">
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="mt-2 h-5 w-2/3" />
                </div>
                <Skeleton className="h-4 w-16" />
              </div>
            ))}
          </div>
        </section>
        <aside className="rounded-[1.75rem] border border-stroke bg-white p-5 shadow-nuwa-md sm:p-7">
          <Skeleton className="h-6 w-40" />
          <SkeletonText className="mt-4" lines={4} />
          <SkeletonButton className="mt-6 w-full" />
        </aside>
      </div>
    </div>
  )
}

function statusMessage(access: AccessState): string {
  if (access === "verification-failed")
    return "تعذر التحقق من حالة الالتحاق. أعد المحاولة قبل مشاهدة الفيديو."

  if (access === "approved")
    return "تم قبولك في الدورة، يمكنك مشاهدة الدروس المتاحة."

  if (access === "pending")
    return "طلب التحاقك قيد المراجعة. ستظهر الفيديوهات بعد موافقة المدرّس."

  if (access === "rejected")
    return "طلب الالتحاق بهذه الدورة غير مقبول حاليًا. تواصل مع المدرّس للاستفسار."

  if (access === "not-student")
    return "محتوى الفيديو متاح للطلاب المقبولين في الدورة فقط."

  return "سجّل الدخول بحساب الطالب واطلب الالتحاق لمشاهدة محتوى الدورة بعد الموافقة."
}

export default function CourseDetailsPage({
  courseId,

  teacherId,

  navigate,

  onBack,
}: {
  courseId: string

  teacherId?: string | null

  navigate: NavigateFn

  onBack?: () => void
}) {
  const [course, setCourse] = useState<RecordValue | null>(null)

  const [access, setAccess] = useState<AccessState>("checking")

  const [loading, setLoading] = useState(true)

  const [error, setError] = useState("")

  const [requesting, setRequesting] = useState(false)

  const [enrollmentId, setEnrollmentId] = useState<string | null>(
    () => readPendingEnrollments().get(courseId) || null,
  )

  const [contactOpen, setContactOpen] = useState(false)

  const [teacherProfilePhone, setTeacherProfilePhone] = useState("")

  const [lessonProgress, setLessonProgress] = useState(
    () => new Map<string, RecordValue>(),
  )

  const [progressVerified, setProgressVerified] = useState(false)

  const [quizPassByLesson, setQuizPassByLesson] =
    useState<Record<string, boolean>>({})

  const [progressError, setProgressError] = useState("")

  const [savingLessonId, setSavingLessonId] = useState("")

  const [expandedLessonId, setExpandedLessonId] = useState<string | null>(null)

  const [openVideoLessonId, setOpenVideoLessonId] = useState<string | null>(
    null,
  )

  const [openResourcesLessonId, setOpenResourcesLessonId] =
    useState<string | null>(null)

  async function loadPage(active = () => true) {
    setLoading(true)

    setEnrollmentId(null)

    setError("")

    setProgressError("")

    setLessonProgress(new Map())

    setProgressVerified(false)

    setQuizPassByLesson({})

    setExpandedLessonId(null)

    setOpenVideoLessonId(null)

    setOpenResourcesLessonId(null)

    const token = getAuthToken()

    const role = (window.sessionStorage.getItem("eduhub.auth.role") ?? "")

      .toLowerCase()

    let nextAccess: AccessState = !token
      ? "guest"
      : role.includes("student")
        ? "checking"
        : "not-student"

    setAccess(nextAccess)

    if (token && role.includes("student")) {
      try {
        const enrollmentResponse = await studentsApi.enrollments({
          page: 1,

          pageSize: 100,
        })

        if (!active()) return

        const enrollment = list(enrollmentResponse).find((item) => {
          const nestedCourse = record(item.course)

          return (
            String(
              item.courseId ?? nestedCourse.id ?? nestedCourse.courseId ?? "",
            ) === String(courseId)
          )
        })

        const serverState = enrollmentState(enrollment)
        const serverId = enrollment?.id ?? enrollment?.enrollmentId
        const storedId = readPendingEnrollments().get(courseId)
        if (enrollment) {
          nextAccess = serverState
          if (serverState === "pending") {
            rememberPendingEnrollment(
              courseId,
              serverId == null ? storedId ?? "" : String(serverId),
            )
          } else {
            forgetPendingEnrollment(courseId)
          }
          setEnrollmentId(
            serverId == null
              ? serverState === "pending"
                ? storedId || null
                : null
              : String(serverId),
          )
        } else if (storedId !== undefined) {
          nextAccess = "pending"
          setEnrollmentId(storedId || null)
        } else {
          setEnrollmentId(null)
        }
      } catch {
        // Fail closed: do not request a video-bearing response when enrollment cannot be verified.
        const storedId = readPendingEnrollments().get(courseId)
        nextAccess = storedId === undefined ? "verification-failed" : "pending"
        setEnrollmentId(storedId || null)
      }
    }

    try {
      const response =
        nextAccess === "approved"
          ? await studentsApi.courseDetail(courseId)
          : await coursesApi.publicDetail(courseId)

      if (!active()) return

      let loadedCourse = courseRecord(response)

      if (nextAccess === "approved") {
        try {
          const supplementalCourse = await coursesApi.detail(courseId)
          if (!active()) return
          loadedCourse = mergeCourseLessonResources(
            response,
            supplementalCourse,
          )
        } catch {
          // Keep the enrolled-student course response if public details are unavailable.
        }
      }

      setCourse(loadedCourse)

      setAccess(nextAccess)

      if (nextAccess === "approved") {
        try {
          const progressResponse = await studentsApi.courseProgress(courseId)

          if (!active()) return

          const rows = progressRows(progressResponse)

          setProgressVerified(true)

          setLessonProgress(
            new Map(
              rows.flatMap((row) => {
                const nestedLesson = record(row.lesson ?? row.lessonInfo)

                const id = String(
                  row.lessonId ??
                    nestedLesson.id ??
                    nestedLesson.lessonId ??
                    row.id ??
                    "",
                )

                return id ? [[id, row] as const] : []
              }),
            ),
          )
        } catch {
          if (!active()) return

          setProgressError(
            "تعذر تحميل تقدم الدروس. ستظل الوحدات التالية مقفولة حتى نتمكن من التحقق.",
          )
        }

        const quizLessons = list(
          loadedCourse.modules ?? loadedCourse.courseModules,
        ).flatMap((module) =>
          list(module.lessons ?? module.courseLessons).filter((lesson) =>
            isTrue(lesson.hasQuiz),
          ),
        )

        if (quizLessons.length) {
          try {
            const profile = record(unwrap(await studentsApi.me()))

            if (!active()) return

            const results = await Promise.allSettled(
              quizLessons.map(async (lesson) => ({
                id: lessonId(lesson),

                passed: await studentPassedLessonQuiz(lesson, profile),
              })),
            )

            if (!active()) return

            const passes: Record<string, boolean> = {}

            let quizCheckFailed = false

            results.forEach((result, index) => {
              const fallbackId = lessonId(quizLessons[index])

              if (result.status === "fulfilled" && result.value.id) {
                passes[result.value.id] = result.value.passed
              } else {
                if (fallbackId) passes[fallbackId] = false

                quizCheckFailed = true
              }
            })

            setQuizPassByLesson(passes)

            if (quizCheckFailed) {
              setProgressError(
                "تعذر التحقق من اجتياز بعض الاختبارات. ستظل الوحدات التالية مقفولة حتى نتمكن من التحقق.",
              )
            }
          } catch {
            if (!active()) return

            setQuizPassByLesson(
              Object.fromEntries(
                quizLessons.flatMap((lesson) => {
                  const id = lessonId(lesson)

                  return id ? [[id, false]] : []
                }),
              ),
            )

            setProgressError(
              "تعذر التحقق من الاختبارات. ستظل الوحدات التالية مقفولة حتى نتمكن من التحقق.",
            )
          }
        }
      }
    } catch (cause) {
      if (!active()) return

      setError(
        cause instanceof Error ? cause.message : "تعذر تحميل تفاصيل الدورة.",
      )

      setAccess(nextAccess)
    } finally {
      if (active()) setLoading(false)
    }
  }

  useEffect(() => {
    let active = true

    void loadPage(() => active)

    return () => {
      active = false
    }
  }, [courseId])

  async function requestEnrollment() {
    if (!getAuthToken()) {
      navigate("login")

      return
    }

    const role = (window.sessionStorage.getItem("eduhub.auth.role") ?? "")

      .toLowerCase()

    if (!role.includes("student")) {
      notifyError(new Error("طلب الالتحاق متاح لحساب الطالب فقط."))

      return
    }

    setRequesting(true)

    try {
      const response = await coursesApi.enroll(courseId)
      const enrollment = record(unwrap(response))
      const id = enrollment.id ?? enrollment.enrollmentId
      setEnrollmentId(id == null ? null : String(id))
      rememberPendingEnrollment(courseId, id == null ? "" : String(id))

      setAccess("pending")

      if (id == null) await loadPage()

      notifySuccess("تم إرسال طلب الالتحاق، وسيظهر محتوى الفيديو بعد الموافقة.")
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 409) {
        await loadPage()
      } else {
        notifyError(cause, "تعذر إرسال طلب الالتحاق.")
      }
    } finally {
      setRequesting(false)
    }
  }

  async function cancelEnrollment() {
    if (requesting) return

    setRequesting(true)
    try {
      let targetId = enrollmentId
      if (!targetId) {
        const response = await studentsApi.enrollments({ page: 1, pageSize: 100 })
        const enrollment = list(response).find((item) => {
          const nestedCourse = record(item.course)
          return String(
            item.courseId ?? nestedCourse.id ?? nestedCourse.courseId ?? "",
          ) === String(courseId)
        })
        targetId = String(enrollment?.id ?? enrollment?.enrollmentId ?? "")
      }
      if (!targetId) throw new Error("تعذر العثور على طلب الالتحاق.")
      await studentsApi.cancelEnrollment(targetId)
      forgetPendingEnrollment(courseId)
      setAccess("not-enrolled")
      setEnrollmentId(null)
      setContactOpen(false)
      notifySuccess("تم إلغاء طلب الالتحاق بنجاح.")
    } catch (cause) {
      notifyError(cause, "تعذر إلغاء طلب الالتحاق.")
    } finally {
      setRequesting(false)
    }
  }

  async function completeLesson(id: string, lastPosition = 0) {
    if (!id || savingLessonId) return

    setSavingLessonId(id)

    try {
      await studentsApi.updateLessonProgress(id, {
        isCompleted: true,

        lastPosition: Math.max(0, Math.floor(lastPosition)),
      })

      setLessonProgress((current) => {
        const next = new Map(current)

        next.set(id, { ...next.get(id), lessonId: id, isCompleted: true })

        return next
      })

      setExpandedLessonId(null)

      notifySuccess("تم تسجيل إكمال الدرس.")
    } catch (cause) {
      notifyError(cause, "تعذر تسجيل إكمال الدرس.")
    } finally {
      setSavingLessonId("")
    }
  }

  const modules = list(course?.modules ?? course?.courseModules)

  const lessonCount = modules.reduce(
    (count, module) =>
      count + list(module.lessons ?? module.courseLessons).length,

    0,
  )

  const canWatch = access === "approved"

  const courseTeacher = record(course?.teacher ?? course?.instructor)
  const teacherPhone = String(
    course?.teacherPhoneNumber ??
      course?.teacherPhone ??
      course?.instructorPhoneNumber ??
      course?.whatsappPhoneNumber ??
      course?.whatsAppPhoneNumber ??
      course?.phoneNumber ??
      course?.phone ??
      courseTeacher.whatsappPhoneNumber ??
      courseTeacher.whatsAppPhoneNumber ??
      courseTeacher.whatsappNumber ??
      courseTeacher.whatsAppNumber ??
      courseTeacher.phoneNumber ??
      courseTeacher.phone ??
      courseTeacher.mobileNumber ??
      teacherProfilePhone ??
      "",
  ).trim()
  const whatsappNumber = teacherPhone.replace(/\D/g, "")
  const whatsappPhone = whatsappNumber.startsWith("00")
    ? whatsappNumber.slice(2)
    : whatsappNumber.startsWith("0")
      ? `20${whatsappNumber.slice(1)}`
      : whatsappNumber.startsWith("20")
        ? whatsappNumber
        : whatsappNumber
          ? `20${whatsappNumber}`
          : ""
  const courseTitle = String(course?.title ?? "الدورة")

  useEffect(() => {
    if (!contactOpen || teacherPhone || !teacherId) return

    let active = true
    teachersApi
      .byId(teacherId)
      .then((response) => {
        if (!active) return
        const profile = record(unwrap(response))
        const phone =
          profile.teacherPhoneNumber ??
          profile.teacherPhone ??
          profile.whatsappPhoneNumber ??
          profile.whatsAppPhoneNumber ??
          profile.whatsappNumber ??
          profile.whatsAppNumber ??
          profile.phoneNumber ??
          profile.phone ??
          profile.mobileNumber
        if (phone != null) setTeacherProfilePhone(String(phone).trim())
      })
      .catch(() => undefined)

    return () => {
      active = false
    }
  }, [contactOpen, teacherId, teacherPhone])

  function moduleIsComplete(module: RecordValue): boolean {
    if (!progressVerified) return false

    const lessons = list(module.lessons ?? module.courseLessons)

    return lessons.every((lesson) => {
      return lessonIsComplete(lesson)
    })
  }

  function lessonIsComplete(lesson: RecordValue): boolean {
    if (!progressVerified || !lessonCompleted(lesson, lessonProgress))
      return false

    const id = lessonId(lesson)

    return (
      !isTrue(lesson.hasQuiz) || (id !== "" && quizPassByLesson[id] === true)
    )
  }

  const coverSource = String(
    course?.coverImageUrl ?? course?.thumbnailUrl ?? course?.imageUrl ?? "",
  )

  const cover = coverSource ? resolveApiAssetUrl(coverSource) : ""

  const subject = String(course?.subjectName ?? course?.subject ?? "")

  const teacher = String(
    course?.teacherName ??
      record(course?.teacher).fullName ??
      record(course?.teacher).name ??
      "",
  )

  return (
    <main className="min-h-screen bg-canvas pb-16">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <button
          type="button"
          onClick={() => (onBack ? onBack() : navigate("public:courses"))}
          className="mb-5 inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-ink-muted transition hover:bg-white hover:text-nuwa-base"
        >
          <ArrowRight size={17} /> العودة إلى الدورات
        </button>

        {loading ? (
          <CourseDetailsSkeleton />
        ) : error ? (
          <section className="rounded-2xl border border-rose-200 bg-white p-7 text-center">
            <p role="alert" className="font-semibold text-rose-700">
              {error}
            </p>
            <button
              type="button"
              onClick={() => void loadPage()}
              className="mt-4 rounded-xl bg-nuwa-base px-5 py-2.5 text-sm font-bold text-white"
            >
              إعادة المحاولة
            </button>
          </section>
        ) : course ? (
          <>
            <section className="relative isolate flex min-h-[300px] items-end overflow-hidden rounded-[2rem] bg-gradient-to-br from-emerald-950 via-emerald-800 to-teal-700 p-6 text-white shadow-xl shadow-emerald-950/10 sm:min-h-[370px] sm:p-10">
              {cover && (
                <img
                  src={cover}
                  alt=""
                  className="absolute inset-0 -z-20 size-full object-cover opacity-70"
                />
              )}
              <div className="absolute inset-0 -z-10 bg-gradient-to-l from-emerald-950/55 via-emerald-950/25 to-emerald-950/5" />
              <div className="pointer-events-none absolute -left-16 -top-20 -z-10 size-80 rounded-full border border-white/15" />
              <div className="pointer-events-none absolute -left-2 -top-6 -z-10 size-52 rounded-full border border-white/15" />
              <div className="max-w-3xl">
                <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-semibold text-emerald-50 backdrop-blur">
                  <GraduationCap size={15} /> تفاصيل الدورة التعليمية
                </span>
                <h1 className="mt-5 text-3xl font-bold leading-tight sm:text-4xl">
                  {String(course.title ?? course.name ?? "دورة تعليمية")}
                </h1>
                {Boolean(course.description) && (
                  <p className="mt-4 max-w-2xl whitespace-pre-line text-sm leading-7 text-emerald-50/85 sm:text-base">
                    {String(course.description)}
                  </p>
                )}
                <div className="mt-6 flex flex-wrap gap-2 text-xs font-semibold">
                  {subject && (
                    <span className="rounded-full bg-white/10 px-3 py-1.5">
                      {subject}
                    </span>
                  )}
                  {course.academicYear != null && (
                    <span className="rounded-full bg-white/10 px-3 py-1.5">
                      {String(course.academicYear)}
                    </span>
                  )}
                  {teacher && (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5">
                      <UserRound size={13} />
                      {teacher}
                    </span>
                  )}
                </div>
              </div>
              <span className="absolute left-5 top-5 inline-flex items-center gap-2 rounded-full border border-white/15 bg-black/15 px-3 py-2 text-sm font-bold backdrop-blur sm:left-8 sm:top-8">
                <CircleDollarSign size={17} /> {formatEgp(course.price)}
              </span>
            </section>

            <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
              <section className="min-w-0 rounded-[1.75rem] border border-stroke bg-white p-5 shadow-nuwa-md sm:p-7">
                <div className="flex flex-wrap items-end justify-between gap-4 border-b border-stroke pb-5">
                  <div>
                    <p className="text-xs font-bold text-nuwa-base">
                      محتوى الدورة
                    </p>
                    <h2 className="mt-1 text-2xl font-bold text-ink">
                      الوحدات والدروس
                    </h2>
                  </div>
                  <span className="rounded-full bg-nuwa-soft px-3 py-1.5 text-xs font-semibold text-nuwa-deep">
                    {modules.length} وحدات · {lessonCount} دروس
                  </span>
                </div>

                {canWatch && progressError && (
                  <div
                    role="alert"
                    className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900"
                  >
                    <p>{progressError}</p>
                    <button
                      type="button"
                      onClick={() => void loadPage()}
                      className="mt-2 font-bold underline"
                    >
                      إعادة التحقق
                    </button>
                  </div>
                )}

                {modules.length ? (
                  <div className="mt-5 space-y-4">
                    {modules.map((module, moduleIndex) => {
                      const lessons = list(
                        module.lessons ?? module.courseLessons,
                      )

                      const locked =
                        canWatch &&
                        moduleIndex > 0 &&
                        !modules.slice(0, moduleIndex).every(moduleIsComplete)

                      const completed = canWatch && moduleIsComplete(module)

                      return (
                        <details
                          key={String(module.id ?? moduleIndex)}
                          open={!locked}
                          className="group overflow-hidden rounded-2xl border border-stroke bg-[#fbfdfb]"
                        >
                          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-4 sm:p-5">
                            <span className="flex min-w-0 items-center gap-3">
                              <span
                                className={`grid size-10 shrink-0 place-items-center rounded-xl ${
                                  locked
                                    ? "bg-neutral-100 text-neutral-500"
                                    : completed
                                      ? "bg-emerald-50 text-emerald-700"
                                      : "bg-nuwa-soft text-nuwa-base"
                                }`}
                              >
                                {locked ? (
                                  <LockKeyhole size={18} />
                                ) : completed ? (
                                  <CheckCircle2 size={19} />
                                ) : (
                                  <BookOpen size={19} />
                                )}
                              </span>
                              <span className="min-w-0">
                                <span className="block text-xs font-semibold text-ink-muted">
                                  الوحدة {moduleIndex + 1}
                                </span>
                                <span className="mt-0.5 block truncate font-bold text-ink">
                                  {String(
                                    module.title ??
                                      module.name ??
                                      `الوحدة ${moduleIndex + 1}`,
                                  )}
                                </span>
                              </span>
                            </span>
                            <span className="shrink-0 text-xs font-semibold text-ink-muted">
                              {locked
                                ? "مقفولة"
                                : completed
                                  ? "مكتملة"
                                  : `${lessons.length} دروس`}
                            </span>
                          </summary>
                          {locked ? (
                            <div className="border-t border-stroke bg-white px-4 py-5 text-sm leading-6 text-ink-muted sm:px-5">
                              <p>
                                أكمل دروس الوحدة السابقة واجتز اختبارات الدروس
                                الموجودة فيها لفتح هذه الوحدة.
                              </p>
                              <button
                                type="button"
                                onClick={() => navigate("dashboard")}
                                className="mt-3 rounded-lg bg-nuwa-soft px-3 py-2 text-xs font-bold text-nuwa-base"
                              >
                                الانتقال إلى لوحة التحكم
                              </button>
                            </div>
                          ) : (
                            <div className="divide-y divide-stroke border-t border-stroke bg-white px-4 sm:px-5">
                              {lessons.length ? (
                                lessons.map((lesson, lessonIndex) => {
                                  const video = videoFromLesson(lesson)

                                  const lessonResources =
                                    lessonResourcesFrom(lesson)

                                  const id = lessonId(lesson)

                                  const lessonLocked =
                                    canWatch &&
                                    (locked ||
                                      (lessonIndex > 0 &&
                                        !lessons

                                          .slice(0, lessonIndex)

                                          .every(lessonIsComplete)))

                                  const completedLesson = lessonCompleted(
                                    lesson,

                                    lessonProgress,
                                  )

                                  const completedIncludingQuiz =
                                    lessonIsComplete(lesson)

                                  const hasQuiz = isTrue(lesson.hasQuiz)

                                  const passedQuiz =
                                    !hasQuiz || quizPassByLesson[id] === true

                                  const isExpanded =
                                    expandedLessonId === id && !lessonLocked

                                  return (
                                    <article
                                      key={String(id || lessonIndex)}
                                      className="py-4"
                                    >
                                      <div className="flex items-start gap-3">
                                        <span
                                          className={`mt-0.5 grid size-9 shrink-0 place-items-center rounded-xl ${
                                            lessonLocked
                                              ? "bg-neutral-100 text-neutral-500"
                                              : completedIncludingQuiz
                                                ? "bg-emerald-50 text-emerald-700"
                                                : "bg-neutral-100 text-neutral-500"
                                          }`}
                                        >
                                          {lessonLocked ? (
                                            <LockKeyhole size={16} />
                                          ) : completedIncludingQuiz ? (
                                            <CheckCircle2 size={16} />
                                          ) : (
                                            <Play size={16} />
                                          )}
                                        </span>
                                        <div className="min-w-0 flex-1">
                                          <div className="flex flex-wrap items-center gap-2">
                                            {canWatch ? (
                                              <button
                                                type="button"
                                                disabled={lessonLocked || !id}
                                                aria-expanded={isExpanded}
                                                onClick={() => {
                                                  setExpandedLessonId(
                                                    isExpanded ? null : id,
                                                  )
                                                  setOpenVideoLessonId(null)
                                                  setOpenResourcesLessonId(null)
                                                }}
                                                className="inline-flex items-center gap-2 text-start font-bold text-ink disabled:cursor-not-allowed disabled:opacity-65"
                                              >
                                                <span>
                                                  {String(
                                                    lesson.title ??
                                                      lesson.name ??
                                                      `الدرس ${lessonIndex + 1}`,
                                                  )}
                                                </span>
                                                {lessonLocked ? (
                                                  <LockKeyhole
                                                    size={15}
                                                    aria-hidden="true"
                                                  />
                                                ) : (
                                                  <ChevronDown
                                                    size={16}
                                                    className={`transition-transform ${
                                                      isExpanded
                                                        ? "rotate-180"
                                                        : ""
                                                    }`}
                                                    aria-hidden="true"
                                                  />
                                                )}
                                              </button>
                                            ) : (
                                              <h3 className="font-bold text-ink">
                                                {String(
                                                  lesson.title ??
                                                    lesson.name ??
                                                    `الدرس ${lessonIndex + 1}`,
                                                )}
                                              </h3>
                                            )}
                                            {completedLesson && (
                                              <span className="rounded-full bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-700">
                                                مكتمل
                                              </span>
                                            )}
                                            {hasQuiz && passedQuiz && (
                                              <span className="rounded-full bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-700">
                                                تم اجتياز الاختبار
                                              </span>
                                            )}
                                          </div>
                                          {lessonLocked && (
                                            <p className="mt-2 text-xs leading-5 text-ink-muted">
                                              أكمل الدرس السابق واجتز اختباره إن
                                              وُجد لفتح هذا الدرس.
                                            </p>
                                          )}
                                          {isExpanded &&
                                            Boolean(lesson.description) && (
                                              <p className="mt-1 whitespace-pre-line text-sm leading-6 text-ink-muted">
                                                {String(lesson.description)}
                                              </p>
                                            )}
                                          {hasQuiz && !passedQuiz && (
                                            <div className="mt-3 flex flex-wrap items-center gap-2">
                                              <span className="text-xs text-amber-800">
                                                اجتز اختبار هذا الدرس من لوحة
                                                التحكم لفتح الوحدة التالية.
                                              </span>
                                              <button
                                                type="button"
                                                onClick={() =>
                                                  navigate("dashboard")
                                                }
                                                className="rounded-lg bg-nuwa-soft px-3 py-2 text-xs font-bold text-nuwa-base"
                                              >
                                                الذهاب للاختبار
                                              </button>
                                            </div>
                                          )}
                                          {!canWatch && (
                                            <p className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-ink-muted">
                                              <LockKeyhole size={13} /> الفيديو
                                              مقفل حتى قبول طلب الالتحاق
                                            </p>
                                          )}
                                        </div>
                                      </div>
                                      {isExpanded && (
                                        <div className="mt-3 border-t border-stroke pt-4">
                                          <div className="grid gap-2 sm:grid-cols-2">
                                            {video && (
                                              <button
                                                type="button"
                                                aria-expanded={
                                                  openVideoLessonId === id
                                                }
                                                onClick={() => {
                                                  const isOpening =
                                                    openVideoLessonId !== id
                                                  setOpenVideoLessonId(
                                                    openVideoLessonId === id
                                                      ? null
                                                      : id,
                                                  )
                                                  if (isOpening)
                                                    scrollToLessonContent(
                                                      `course-video-${id}`,
                                                    )
                                                }}
                                                className={`flex min-h-14 items-center justify-between gap-3 rounded-xl border px-4 py-3 text-start transition ${
                                                  openVideoLessonId === id
                                                    ? "border-nuwa-base bg-nuwa-soft/60 text-nuwa-deep"
                                                    : "border-stroke bg-white text-ink hover:border-nuwa-base/40 hover:bg-nuwa-ice"
                                                }`}
                                              >
                                                <span className="flex min-w-0 items-center gap-3">
                                                  <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-nuwa-soft text-nuwa-base">
                                                    <Play
                                                      size={16}
                                                      fill="currentColor"
                                                    />
                                                  </span>
                                                  <span className="truncate text-sm font-bold">
                                                    فيديو الدرس
                                                  </span>
                                                </span>
                                                <ChevronDown
                                                  size={17}
                                                  className={`shrink-0 transition-transform ${
                                                    openVideoLessonId === id
                                                      ? "rotate-180"
                                                      : ""
                                                  }`}
                                                />
                                              </button>
                                            )}
                                            {lessonResources.length > 0 && (
                                              <button
                                                type="button"
                                                aria-expanded={
                                                  openResourcesLessonId === id
                                                }
                                                onClick={() => {
                                                  const isOpening =
                                                    openResourcesLessonId !== id
                                                  setOpenResourcesLessonId(
                                                    openResourcesLessonId === id
                                                      ? null
                                                      : id,
                                                  )
                                                  if (isOpening)
                                                    scrollToLessonContent(
                                                      `course-resources-${id}`,
                                                    )
                                                }}
                                                className={`flex min-h-14 items-center justify-between gap-3 rounded-xl border px-4 py-3 text-start transition ${
                                                  openResourcesLessonId === id
                                                    ? "border-nuwa-base bg-nuwa-soft/60 text-nuwa-deep"
                                                    : "border-stroke bg-white text-ink hover:border-nuwa-base/40 hover:bg-nuwa-ice"
                                                }`}
                                              >
                                                <span className="flex min-w-0 items-center gap-3">
                                                  <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-nuwa-soft text-nuwa-base">
                                                    <FileText size={17} />
                                                  </span>
                                                  <span className="truncate text-sm font-bold">
                                                    ملفات ومواد الدرس
                                                  </span>
                                                </span>
                                                <span className="flex shrink-0 items-center gap-2">
                                                  <span className="rounded-full bg-white/80 px-2 py-0.5 text-[11px] font-bold">
                                                    {lessonResources.length}
                                                  </span>
                                                  <ChevronDown
                                                    size={17}
                                                    className={`transition-transform ${
                                                      openResourcesLessonId ===
                                                      id
                                                        ? "rotate-180"
                                                        : ""
                                                    }`}
                                                  />
                                                </span>
                                              </button>
                                            )}
                                          </div>
                                          {openVideoLessonId === id &&
                                            video && (
                                              <div
                                                id={`course-video-${id}`}
                                                className="scroll-mt-24"
                                              >
                                                <LessonVideoPlayer
                                                  video={video}
                                                  title={String(
                                                    lesson.title ??
                                                      "فيديو الدرس",
                                                  )}
                                                  onEnded={(seconds) =>
                                                    void completeLesson(
                                                      id,
                                                      seconds,
                                                    )
                                                  }
                                                />
                                              </div>
                                            )}
                                          {openResourcesLessonId === id &&
                                            lessonResources.length > 0 && (
                                              <section
                                                id={`course-resources-${id}`}
                                                className="mt-5 rounded-2xl border border-stroke bg-slate-50/80 p-4 sm:p-5"
                                                aria-label="ملفات ومواد الدرس"
                                              >
                                                <div className="flex items-center gap-2.5">
                                                  <span className="grid size-9 place-items-center rounded-xl bg-white text-nuwa-base shadow-sm">
                                                    <FileText size={18} />
                                                  </span>
                                                  <div>
                                                    <h4 className="text-sm font-bold text-ink">
                                                      ملفات ومواد الدرس
                                                    </h4>
                                                    <p className="text-xs text-ink-muted">
                                                      مرفقات تساعدك على متابعة
                                                      الشرح والمراجعة.
                                                    </p>
                                                  </div>
                                                </div>
                                                <div className="mt-3 grid gap-3">
                                                  {lessonResources.map(
                                                    (
                                                      resource,
                                                      resourceIndex,
                                                    ) => {
                                                      const url =
                                                        lessonResourceUrl(
                                                          resource,
                                                        )

                                                      const name = String(
                                                        resource.name ??
                                                          `مادة الدرس ${resourceIndex + 1}`,
                                                      )

                                                      const mime = String(
                                                        resource.contentType ??
                                                          resource.mimeType ??
                                                          resource.type ??
                                                          "",
                                                      ).toLowerCase()

                                                      if (!url) {
                                                        return (
                                                          <div
                                                            key={String(
                                                              resource.id ??
                                                                resourceIndex,
                                                            )}
                                                            className="flex min-h-14 items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm"
                                                          >
                                                            <FileText
                                                              size={18}
                                                              className="shrink-0 text-amber-700"
                                                            />
                                                            <span className="min-w-0 flex-1 truncate font-semibold text-ink">
                                                              {name}
                                                            </span>
                                                            <span className="shrink-0 text-xs font-medium text-amber-800">
                                                              رابط الملف غير
                                                              متاح
                                                            </span>
                                                          </div>
                                                        )
                                                      }

                                                      const isYoutube = Boolean(
                                                        youtubeVideoId(url),
                                                      )

                                                      const isVideo =
                                                        isYoutube ||
                                                        mime.startsWith(
                                                          "video/",
                                                        ) ||
                                                        /\.(mp4|webm|mov|m4v|ogv)(?:$|\?)/i.test(
                                                          url,
                                                        ) ||
                                                        name.startsWith(
                                                          "فيديو إضافي",
                                                        )

                                                      if (isVideo) {
                                                        return (
                                                          <div
                                                            key={String(
                                                              resource.id ??
                                                                resourceIndex,
                                                            )}
                                                            className="rounded-xl border border-stroke bg-white p-3"
                                                          >
                                                            <p className="mb-2 text-xs font-semibold text-ink-muted">
                                                              {name}
                                                            </p>
                                                            <LessonVideoPlayer
                                                              video={{
                                                                videoUrl: url,
                                                              }}
                                                              title={name}
                                                            />
                                                          </div>
                                                        )
                                                      }

                                                      const href =
                                                        resolveApiAssetUrl(url)

                                                      return (
                                                        <a
                                                          key={String(
                                                            resource.id ??
                                                              resourceIndex,
                                                          )}
                                                          href={href}
                                                          target="_blank"
                                                          rel="noreferrer"
                                                          className="flex min-h-14 items-center gap-3 rounded-xl border border-stroke bg-white px-3 py-2.5 text-sm font-semibold text-ink transition hover:border-nuwa-base/40 hover:bg-nuwa-ice focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nuwa-bright"
                                                        >
                                                          <FileText
                                                            size={18}
                                                            className="shrink-0 text-nuwa-base"
                                                          />
                                                          <span className="min-w-0 flex-1 truncate">
                                                            {name}
                                                          </span>
                                                          <span className="shrink-0 text-xs font-bold text-nuwa-base">
                                                            فتح المادة
                                                          </span>
                                                        </a>
                                                      )
                                                    },
                                                  )}
                                                </div>
                                              </section>
                                            )}
                                          {id && (
                                            <button
                                              type="button"
                                              disabled={
                                                completedLesson ||
                                                savingLessonId === id
                                              }
                                              onClick={() =>
                                                void completeLesson(
                                                  id,

                                                  Number(
                                                    lesson.lastPosition ?? 0,
                                                  ),
                                                )
                                              }
                                              className="mt-3 rounded-lg border border-stroke px-3 py-2 text-xs font-semibold text-ink disabled:cursor-default disabled:opacity-60"
                                            >
                                              {savingLessonId === id
                                                ? "جارٍ الحفظ..."
                                                : completedLesson
                                                  ? "تم إكمال الدرس"
                                                  : "تحديد الدرس كمكتمل"}
                                            </button>
                                          )}
                                        </div>
                                      )}
                                    </article>
                                  )
                                })
                              ) : (
                                <p className="py-5 text-sm text-ink-muted">
                                  لا توجد دروس مضافة لهذه الوحدة حتى الآن.
                                </p>
                              )}
                            </div>
                          )}
                        </details>
                      )
                    })}
                  </div>
                ) : (
                  <p className="mt-5 rounded-xl border border-dashed border-stroke-strong p-6 text-center text-sm text-ink-muted">
                    لم تتم إضافة وحدات للدورة بعد.
                  </p>
                )}
              </section>

              <aside className="h-fit rounded-[1.75rem] border border-stroke bg-white p-5 shadow-nuwa-md lg:sticky lg:top-24">
                <div className="flex items-center gap-3">
                  <span
                    className={`grid size-11 place-items-center rounded-2xl ${
                      canWatch
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-amber-50 text-amber-700"
                    }`}
                  >
                    {canWatch ? (
                      <CheckCircle2 size={22} />
                    ) : (
                      <ShieldCheck size={22} />
                    )}
                  </span>
                  <div>
                    <h2 className="font-bold text-ink">
                      {canWatch ? "وصولك للدورة مفعّل" : "محتوى الدورة محمي"}
                    </h2>
                    <p className="mt-0.5 text-xs text-ink-muted">
                      {canWatch
                        ? "حسابك مقبول في الدورة"
                        : "الفيديوهات للطلاب المقبولين فقط"}
                    </p>
                  </div>
                </div>
                <p className="mt-4 rounded-xl bg-canvas p-4 text-sm leading-7 text-ink-muted">
                  {statusMessage(access)}
                </p>
                {access === "not-enrolled" && (
                  <button
                    type="button"
                    disabled={requesting}
                    onClick={() => setContactOpen(true)}
                    className="mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-l from-[#176b43] to-[#0b3b25] px-4 py-3 text-sm font-bold text-white shadow-lg shadow-nuwa-base/15 transition hover:-translate-y-0.5 disabled:cursor-wait disabled:opacity-60"
                  >
                    <MessageCircle size={18} /> تواصل مع المدرس
                  </button>
                )}
                {access === "guest" && (
                  <button
                    type="button"
                    onClick={() => navigate("login")}
                    className="mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-l from-[#176b43] to-[#0b3b25] px-4 py-3 text-sm font-bold text-white"
                  >
                    تسجيل الدخول للمتابعة
                  </button>
                )}
                {access === "pending" && (
                  <div className="mt-4 space-y-2">
                    <span className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-amber-50 px-4 py-2 text-sm font-bold text-amber-800">
                      <LockKeyhole size={16} /> الطلب قيد المراجعة
                    </span>
                    <button
                      type="button"
                      onClick={() => setContactOpen(true)}
                      className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-l from-[#176b43] to-[#0b3b25] px-4 py-2 text-sm font-bold text-white"
                    >
                      <MessageCircle size={17} /> تواصل مع المدرس
                    </button>
                  </div>
                )}
                {access === "checking" && (
                  <span className="mt-4 block rounded-xl bg-canvas px-4 py-3 text-center text-sm text-ink-muted">
                    جارٍ التحقق من صلاحية الحساب...
                  </span>
                )}
              </aside>
            </div>
          </>
        ) : null}
      </div>
      {contactOpen && (
        <div
          className="fixed inset-0 z-[200] grid place-items-center overflow-y-auto bg-emerald-950/55 p-3 backdrop-blur-sm sm:p-5"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setContactOpen(false)
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="course-contact-title"
            className="my-auto flex max-h-[calc(100dvh-1.5rem)] w-full max-w-4xl flex-col overflow-hidden rounded-3xl border border-white/60 bg-white shadow-2xl md:flex-row"
          >
            <div className="relative flex shrink-0 flex-col justify-center overflow-hidden bg-gradient-to-l from-nuwa-deep via-nuwa-base to-[#24865b] p-6 text-white sm:p-8 md:w-[40%]">
              <button
                type="button"
                onClick={() => setContactOpen(false)}
                aria-label="إغلاق نافذة التواصل"
                className="absolute left-4 top-4 grid size-9 place-items-center rounded-xl border border-white/20 bg-white/10 text-white hover:bg-white/20"
              >
                <X size={18} />
              </button>
              <span className="grid size-12 place-items-center rounded-2xl bg-white/15 text-emerald-100">
                <MessageCircle size={24} />
              </span>
              <p className="mt-5 text-xs font-semibold text-white/75">
                طلب الالتحاق بالدورة
              </p>
              <h2 id="course-contact-title" className="mt-1 text-xl font-bold leading-8 sm:text-2xl">
                {courseTitle}
              </h2>
              <p className="mt-3 text-sm leading-7 text-white/75">
                تواصل مع المدرس عبر واتساب لإتمام خطوات الالتحاق والدفع.
              </p>
            </div>
            <div className="min-h-0 space-y-4 overflow-y-auto p-5 sm:p-7 md:flex-1 md:p-8">
              <div className="rounded-2xl border border-stroke bg-canvas/60 p-4">
                <p className="text-xs font-semibold text-ink-muted">
                  رقم التواصل عبر واتساب
                </p>
                {teacherPhone ? (
                  <a
                    href={`tel:${teacherPhone.replace(/[^\d+]/g, "")}`}
                    dir="ltr"
                    className="mt-2 inline-flex items-center gap-2 text-lg font-bold text-ink hover:text-nuwa-base"
                  >
                    <MessageCircle size={18} className="text-nuwa-base" />
                    {teacherPhone}
                  </a>
                ) : (
                  <p className="mt-2 text-sm leading-6 text-ink-muted">
                    رقم التواصل غير متاح حاليًا. يمكنك إرسال طلب الالتحاق وسيتواصل معك المدرس.
                  </p>
                )}
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  disabled={requesting}
                  onClick={() =>
                    access === "pending"
                      ? void cancelEnrollment()
                      : void requestEnrollment()
                  }
                  className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold text-white disabled:cursor-wait disabled:opacity-60 ${
                    access === "pending"
                      ? "bg-danger hover:bg-danger/90"
                      : "bg-nuwa-base hover:bg-nuwa-deep"
                  }`}
                >
                  {requesting ? (
                    "جارٍ المعالجة..."
                  ) : access === "pending" ? (
                    "إلغاء الطلب"
                  ) : (
                    "طلب الالتحاق بالدورة"
                  )}
                </button>
                {whatsappPhone ? (
                  <a
                    href={`https://wa.me/${whatsappPhone}?text=${encodeURIComponent(
                      `السلام عليكم، أرغب في الالتحاق بدورة ${courseTitle} وإتمام الدفع.`,
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#16855b] px-4 py-3 text-sm font-bold text-white hover:bg-[#116b49]"
                  >
                    <MessageCircle size={18} /> تواصل مع المدرس واتساب
                  </a>
                ) : (
                  <span className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-ink-muted px-4 py-3 text-sm font-bold text-white opacity-60">
                    <MessageCircle size={18} /> واتساب غير متاح
                  </span>
                )}
              </div>
              {access === "pending" && (
                <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900">
                  تم إرسال طلبك بالفعل. يمكنك إلغاؤه من هنا.
                </p>
              )}
            </div>
          </section>
        </div>
      )}
    </main>
  )
}
