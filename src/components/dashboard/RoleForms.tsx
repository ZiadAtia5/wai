import { useCallback, useEffect, useRef, useState, type FormEvent } from "react"

import { getAcademicYears, type AcademicYearResponse } from "../../api/catalog"

import {
  BookOpen,
  ClipboardCheck,
  Eye,
  EyeOff,
  ImagePlus,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react"

import { ApiError } from "../../api/client"

import TeacherStudentProgress from "./TeacherStudentProgress"

import {
  adminApi,
  quizzesApi,
  studentsApi,
  subjectsApi,
  teachersApi,
  coursesApi,
  type ApiObject,
} from "../../api/endpoints"

import TeacherCourseContent from "./TeacherCourseContent"
import LessonVideoPlayer from "./LessonVideoPlayer"

import { useConfirmation } from "../ConfirmationProvider"

import ProfileImageEditor from "./ProfileImageEditor"

import PersonAvatar from "../PersonAvatar"

type RecordValue = Record<string, unknown>

function isRecordValue(value: unknown): value is RecordValue {
  return typeof value === "object" && value !== null
}

function courseIsPublished(course: RecordValue): boolean {
  const nestedCourse = asRecord(course.course)
  if (Object.keys(nestedCourse).length) return courseIsPublished(nestedCourse)

  for (const key of ["isPublished", "is_published", "published"]) {
    const value = course[key]
    if (value === true || value === 1 || value === "1" || value === "true")
      return true
    if (value === false || value === 0 || value === "0" || value === "false")
      return false
  }

  const status = String(
    course.publicationStatus ??
      course.publishStatus ??
      course.publication_status ??
      course.publish_status ??
      course.status ??
      course.state ??
      "",
  )
    .trim()
    .toLowerCase()

  // CourseStatus is an integer enum in the API: Draft=0, Published=1,
  // and other states are not public.
  if (status === "1") return true
  if (status === "0" || status === "2") return false
  if (/draft|unpublish|not.?publish/.test(status)) return false
  if (/publish|public|live/.test(status)) return true
  if (course.publishedAt != null && String(course.publishedAt).trim()) return true
  return false
}

interface RoleFormsProps {
  role: string

  section: string

  data: unknown

  onSaved: () => void

  onFeedback: (message: string) => void

  focusCourseId?: string | null

  onFocusCourseHandled?: () => void
}

function asRecord(value: unknown): RecordValue {
  return typeof value === "object" && value !== null ? value as RecordValue : {}
}

function unwrapApiResponse(value: unknown): unknown {
  let current = value

  for (let depth = 0; depth < 5; depth += 1) {
    const response = asRecord(current)

    const keys = Object.keys(response)

    const isEnvelope =
      "data" in response &&
      (keys.length <= 3 ||
        ["success", "message", "status", "errors", "meta"].some(
          (key) => key in response,
        ))

    if (!isEnvelope) break

    current = response.data
  }

  return current
}

function profileRecord(value: unknown): RecordValue {
  let current = unwrapApiResponse(value)

  for (let depth = 0; depth < 5; depth += 1) {
    const profile = asRecord(current)

    const nested = profile.profile ?? profile.student ?? profile.user

    if (nested === undefined || nested === current) break

    current = unwrapApiResponse(nested)
  }

  return asRecord(current)
}

function profileImageSource(record: RecordValue): string {
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
    avatarRecord.url ??
    avatarRecord.src
  return typeof candidate === "string" ? candidate : ""
}

function listFrom(value: unknown): RecordValue[] {
  value = unwrapApiResponse(value)

  if (Array.isArray(value))
    return value.filter(
      (item): item is RecordValue => typeof item === "object" && item !== null,
    )

  const record = asRecord(value)

  for (const key of [
    "items",

    "enrollments",

    "courses",

    "lessons",

    "requests",

    "notifications",

    "records",

    "questions",

    "resources",

    "attempts",

    "submissions",
  ]) {
    if (Array.isArray(record[key]))
      return (record[key] as unknown[]).filter(
        (item): item is RecordValue =>
          typeof item === "object" && item !== null,
      )
  }

  return []
}

function progressLessons(progress: RecordValue | null): RecordValue[] {
  if (!progress) return []

  const nestedProgress = asRecord(
    progress.courseProgress ?? progress.progress ?? progress.course,
  )

  const directLessons = listFrom(
    progress.lessons ??
      progress.lessonProgress ??
      nestedProgress.lessons ??
      nestedProgress.lessonProgress,
  )

  const moduleRecords = listFrom(progress.modules ?? nestedProgress.modules)

  const rows: RecordValue[] = directLessons.length
    ? directLessons
    : moduleRecords.flatMap((module) =>
        listFrom(module.lessons).map(
          (lesson): RecordValue => ({
            ...lesson,

            moduleTitle: module.title ?? module.name,
          }),
        ),
      )

  return rows.map((row) => {
    const lesson = asRecord(row.lesson ?? row.lessonInfo)

    const lessonProgress = asRecord(row.progress ?? row.lessonProgress)

    const completed =
      row.isCompleted ??
      row.completed ??
      lessonProgress.isCompleted ??
      lessonProgress.completed

    return {
      ...lesson,

      ...row,

      id: row.lessonId ?? lesson.id ?? row.id,

      title:
        row.title ?? row.lessonTitle ?? lesson.title ?? lesson.name ?? row.name,

      isCompleted:
        completed === true ||
        completed === 1 ||
        (typeof completed === "string" &&
          /^(true|1|yes|completed|done)$/i.test(completed.trim())),

      lastPosition:
        row.lastPosition ??
        lessonProgress.lastPosition ??
        lessonProgress.position ??
        0,
    }
  })
}

function findCourseContent(value: unknown, depth = 0): RecordValue {
  const unwrapped = unwrapApiResponse(value)
  if (depth > 5) return {}

  if (Array.isArray(unwrapped)) {
    for (const item of unwrapped) {
      const nested = findCourseContent(item, depth + 1)
      if (Object.keys(nested).length) return nested
    }
    return {}
  }

  const candidate = asRecord(unwrapped)

  if (
    listFrom(candidate.modules).length > 0 ||
    listFrom(candidate.courseModules).length > 0
  )
    return candidate

  for (const key of [
    "course",
    "courseDetails",
    "courseData",
    "courseContent",
    "details",
    "content",
    "result",
    "data",
  ]) {
    const nested = findCourseContent(candidate[key], depth + 1)
    if (Object.keys(nested).length) return nested
  }

  return {}
}

function getLessonVideo(lesson: RecordValue): RecordValue | undefined {
  const content = asRecord(lesson.content)
  const candidates = [
    lesson.video,
    lesson.videoInfo,
    lesson.videoResponse,
    lesson.videoData,
    lesson.lessonVideo,
    content.video,
    lesson,
  ]

  for (const candidate of candidates) {
    const unwrapped = unwrapApiResponse(candidate)
    if (typeof unwrapped === "string" && unwrapped.trim())
      return { videoUrl: unwrapped.trim() }

    const video = asRecord(unwrapped)
    const videoUrl = video.videoUrl ?? video.url ?? video.streamUrl
    const providerVideoId =
      video.providerVideoId ?? video.youTubeVideoId ?? video.youtubeId
    if (
      (typeof videoUrl === "string" && videoUrl.trim()) ||
      (typeof providerVideoId === "string" && providerVideoId.trim())
    ) {
      return {
        ...video,
        videoUrl,
        providerVideoId,
      }
    }
  }

  return undefined
}

function mergeCourseContentWithProgress(
  progressValue: unknown,
  courseValue: unknown,
  fallbackCourseValue?: unknown,
): RecordValue {
  const progress = asRecord(unwrapApiResponse(progressValue))
  const courseCandidates = [
    findCourseContent(courseValue),
    findCourseContent(fallbackCourseValue),
    findCourseContent(progress),
    findCourseContent(progress.course),
  ].filter((candidate) => Object.keys(candidate).length > 0)
  const course = courseCandidates[0] ?? asRecord(unwrapApiResponse(courseValue))
  const alternateLessons = new Map<string, RecordValue>()
  for (const alternate of courseCandidates.slice(1)) {
    for (const module of listFrom(alternate.modules ?? alternate.courseModules)) {
      for (const lesson of listFrom(module.lessons ?? module.courseLessons)) {
        const id = String(lesson.id ?? lesson.lessonId ?? "")
        if (id) alternateLessons.set(id, lesson)
      }
    }
  }
  const progressRows = progressLessons(progress)
  const progressById = new Map(
    progressRows.map((lesson) => [String(lesson.lessonId ?? lesson.id ?? ""), lesson]),
  )
  const modules = listFrom(course.modules ?? course.courseModules).map((module) => ({
    ...module,
    lessons: listFrom(module.lessons ?? module.courseLessons).map((lesson) => {
      const id = String(lesson.id ?? lesson.lessonId ?? "")
      const supplementalLesson = alternateLessons.get(id) ?? {}
      const combinedLesson = { ...supplementalLesson, ...lesson }
      const savedProgress = progressById.get(id) ?? {}
      const lessonVideo =
        getLessonVideo(lesson) ?? getLessonVideo(supplementalLesson)
      return {
        ...combinedLesson,
        ...savedProgress,
        id: combinedLesson.id ?? combinedLesson.lessonId,
        lessonId: combinedLesson.id ?? combinedLesson.lessonId,
        title: combinedLesson.title ?? combinedLesson.name ?? savedProgress.title,
        video: lessonVideo,
        moduleTitle: module.title ?? module.name,
        isCompleted: Boolean(savedProgress.isCompleted),
        lastPosition: Number(savedProgress.lastPosition ?? 0),
      }
    }),
  }))
  const lessons = modules.flatMap((module) => listFrom(module.lessons))
  const availableLessons = lessons.length
    ? lessons
    : progressRows.map((lesson) => ({
        ...lesson,
        video: getLessonVideo(lesson),
      }))
  return { ...course, ...progress, modules, lessons: availableLessons }
}

async function loadStudentCourseProgress(
  courseId: string,
  enrollmentCourse?: unknown,
): Promise<RecordValue> {
  const [progressResult, courseResult] = await Promise.allSettled([
    studentsApi.courseProgress(courseId),
    coursesApi.detail(courseId),
  ])

  if (progressResult.status === "rejected") throw progressResult.reason

  const detailSource =
    courseResult.status === "fulfilled" &&
    Object.keys(findCourseContent(courseResult.value)).length > 0
      ? courseResult.value
      : enrollmentCourse ??
        (courseResult.status === "fulfilled" ? courseResult.value : null)
  const merged = mergeCourseContentWithProgress(
    progressResult.value,
    detailSource,
    enrollmentCourse,
  )

  if (
    progressLessons(merged).length > 0 &&
    !listFrom(merged.modules).some((module) => listFrom(module.lessons).length > 0)
  ) {
    return {
      ...merged,
      contentLoadError:
        courseResult.status === "rejected" && courseResult.reason instanceof Error
          ? courseResult.reason.message
          : "الخادم أعاد تقدم الطالب دون تفاصيل وحدات الدورة ودروسها.",
    }
  }

  return merged
}

function progressPercentage(progress: RecordValue | null): number {
  if (!progress) return 0

  const nested = asRecord(progress.courseProgress ?? progress.progress)

  const value = Number(
    progress.progressPercentage ??
      progress.progressPercent ??
      progress.completionPercentage ??
      nested.progressPercentage ??
      nested.progressPercent ??
      0,
  )

  return Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : 0
}

function enrollmentStatus(status: unknown, isApproved?: unknown) {
  const value = String(status ?? "").toLowerCase()

  if (value === "2" || /reject|declin|cancel/.test(value)) {
    return {
      label: "الطلب غير نشط",

      tone: "bg-danger-light text-danger",

      canLearn: false,
    }
  }

  if (value === "0" || isApproved === false || /pending|await|review/.test(value)) {
    return {
      label: "بانتظار موافقة المعلم",

      tone: "bg-amber-100 text-amber-800",

      canLearn: false,
    }
  }

  if (value === "3" || /complete|finish/.test(value)) {
    return {
      label: "مكتملة",

      tone: "bg-success-light text-success",

      canLearn: true,
    }
  }

  if (value === "1" || isApproved === true || /approv|active|accept|enroll/.test(value)) {
    return {
      label: "مشترك",

      tone: "bg-success-light text-success",

      canLearn: true,
    }
  }

  return {
    label: status ? String(status) : "الحالة غير محددة",

    tone: "bg-nuwa-soft text-nuwa-base",

    canLearn: true,
  }
}

function isRejectedEnrollment(enrollment: RecordValue): boolean {
  return (
    enrollment.isRejected === true ||
    String(enrollment.status ?? enrollment.enrollmentStatus ?? "").trim() ===
      "2" ||
    /reject|declin|cancel/i.test(
      String(enrollment.status ?? enrollment.enrollmentStatus ?? ""),
    )
  )
}

function apiIdentifier(value: unknown): number | string | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null

  if (typeof value !== "string" || !value.trim()) return null

  const numericValue = Number(value)

  return Number.isFinite(numericValue) ? numericValue : value
}

function allowsMultipleAnswers(question: RecordValue): boolean {
  if (
    question.allowMultipleAnswers === true ||
    question.isMultiple === true ||
    question.multipleAnswers === true ||
    question.isMultiSelect === true
  )
    return true

  return /multiple[\s_-]*(answers?|choice)|multi[\s_-]*select|checkbox/i.test(
    String(question.type ?? ""),
  )
}

function hasSubmittedAttempt(quiz: RecordValue): boolean {
  if (
    quiz.hasAttempted === true ||
    quiz.hasSubmittedAttempt === true ||
    Number(quiz.attemptsRemaining) === 0
  )
    return true

  for (const key of ["myAttempts", "currentUserAttempts"]) {
    if (Array.isArray(quiz[key]) && quiz[key].some(isSubmittedAttempt))
      return true
  }

  const attempt = asRecord(
    quiz.myAttempt ??
      quiz.currentUserAttempt ??
      quiz.currentAttempt,
  )

  return isSubmittedAttempt(attempt)
}

function isSubmittedAttempt(attempt: RecordValue): boolean {
  if (!Object.keys(attempt).length || attempt.isSubmitted === false) return false
  if (
    attempt.isSubmitted === true ||
    attempt.submittedAt != null ||
    attempt.completedAt != null ||
    attempt.gradedAt != null
  )
    return true

  const status = String(attempt.status ?? attempt.state ?? "").toLowerCase()
  if (/draft|in.?progress|pending/.test(status)) return false
  if (/submit|complete|finish|graded/.test(status)) return true
  return attempt.id !== undefined || attempt.attemptId !== undefined
}

function attemptBelongsToStudent(
  attempt: RecordValue,
  profile: RecordValue,
): boolean {
  const student = asRecord(
    attempt.student ?? attempt.studentProfile ?? attempt.user,
  )
  const profileUser = asRecord(profile.user)
  const attemptIds = [
    attempt.studentId,
    attempt.userId,
    student.id,
    student.studentId,
    student.userId,
  ]
    .filter((id) => id != null)
    .map(String)
  const profileIds = [
    profile.studentId,
    profile.userId,
    profile.id,
    profileUser.studentId,
    profileUser.id,
    profileUser.userId,
  ]
    .filter((id) => id != null)
    .map(String)

  if (attemptIds.some((id) => profileIds.includes(id))) return true

  const attemptEmail = String(
    attempt.studentEmail ?? attempt.email ?? student.email ?? "",
  ).trim().toLowerCase()
  const profileEmail = String(
    profile.email ?? profileUser.email ?? "",
  ).trim().toLowerCase()

  return Boolean(attemptEmail && profileEmail && attemptEmail === profileEmail)
}

function attemptRecords(value: unknown): RecordValue[] {
  const unwrapped = unwrapApiResponse(value)
  if (Array.isArray(unwrapped)) return unwrapped.filter(isRecordValue)
  const response = asRecord(unwrapped)
  for (const key of ["attempts", "items", "records", "submissions"]) {
    if (Array.isArray(response[key]))
      return (response[key] as unknown[]).filter(isRecordValue)
  }
  const nestedAttempt = asRecord(response.attempt)
  if (Object.keys(nestedAttempt).length) return [nestedAttempt]
  return isSubmittedAttempt(response) ? [response] : []
}

const fieldClass =
  "h-10 w-full rounded-lg border border-stroke bg-white px-3 text-sm text-ink"

const labelClass = "grid gap-1 text-xs font-semibold text-ink-muted"

export default function RoleForms({
  role,

  section,

  data,

  onSaved,

  onFeedback,

  focusCourseId,

  onFocusCourseHandled,
}: RoleFormsProps) {
  const confirm = useConfirmation()
  const [years, setYears] = useState<AcademicYearResponse[]>([])

  const profileFormRef = useRef<HTMLFormElement>(null)

  const [editingProfile, setEditingProfile] = useState(false)

  const [editingAdminName, setEditingAdminName] = useState(false)

  const [adminNameOverride, setAdminNameOverride] = useState<string | null>(null)

  const [profileImageOverride, setProfileImageOverride] =
    useState<string | null>(null)

  const [subjects, setSubjects] = useState<RecordValue[]>([])

  const [selectedSubjectId, setSelectedSubjectId] = useState("")

  const [addingSubject, setAddingSubject] = useState(false)

  const [newSubjectName, setNewSubjectName] = useState("")

  const [newSubjectYear, setNewSubjectYear] = useState("")

  const [isCourseFree, setIsCourseFree] = useState(false)

  const [busy, setBusy] = useState(false)

  const [deletedCourseIds, setDeletedCourseIds] = useState<Set<string>>(
    () => new Set(),
  )

  const [publishedOverrides, setPublishedOverrides] =
    useState<Record<string, boolean>>({})

  const [teacherCourseFilter, setTeacherCourseFilter] = useState<
    "all" | "published" | "draft"
  >( "all")

  const [editingCourse, setEditingCourse] = useState<RecordValue | null>(null)

  const [isCreatingCourse, setIsCreatingCourse] = useState(false)

  const [editingTeacher, setEditingTeacher] = useState<RecordValue | null>(null)

  const [contentCourseId, setContentCourseId] = useState<string | null>(null)

  const [progressCourse, setProgressCourse] = useState<string | null>(null)

  const [progress, setProgress] = useState<RecordValue | null>(null)

  const [progressLoading, setProgressLoading] = useState(false)

  const [progressError, setProgressError] = useState<string | null>(null)

  const [activeQuizLesson, setActiveQuizLesson] = useState<string | null>(null)

  const [quiz, setQuiz] = useState<RecordValue | null>(null)

  const [quizLoading, setQuizLoading] = useState(false)

  const [quizError, setQuizError] = useState<string | null>(null)

  const [quizValidationError, setQuizValidationError] = useState<string | null>(
    null,
  )

  const [quizSubmitted, setQuizSubmitted] = useState(false)

  const [attemptedQuizIds, setAttemptedQuizIds] = useState<Set<string>>(
    () => new Set(),
  )

  const [quizAnswers, setQuizAnswers] = useState<Record<string, string[]>>({})

  const quizSubmitLock = useRef(false)

  const normalizedData = unwrapApiResponse(data)

  const wrapper = asRecord(normalizedData)

  const record = profileRecord(
    wrapper.profile ??
      wrapper.student ??
      wrapper.user ??
      listFrom(normalizedData)[0] ??
      normalizedData,
  )

  const isAdmin = role.includes("admin")

  const isTeacher = role.includes("teacher")

  useEffect(() => {
    if (section !== "profile") setEditingProfile(false)
  }, [section])

  const teacherCourses = listFrom(data).filter((course) => {
    const id = String(course.id ?? course.courseId ?? "")

    return id && !deletedCourseIds.has(id)
  })

  const getTeacherCoursePublished = (course: RecordValue) => {
    const id = String(course.id ?? course.courseId ?? "")
    return publishedOverrides[id] ?? courseIsPublished(course)
  }

  const visibleTeacherCourses = teacherCourses.filter((course) =>
    teacherCourseFilter === "all" ||
    (getTeacherCoursePublished(course)
      ? "published"
      : "draft") === teacherCourseFilter,
  )

  useEffect(() => {
    if (isAdmin && section === "profile") return
    if (!isAdmin && !isTeacher && section !== "profile") return

    let active = true

    getAcademicYears()

      .then((result) => {
        if (active) setYears(result)
      })

      .catch((cause: unknown) => {
        if (active) {
          onFeedback(
            cause instanceof Error
              ? cause.message
              : "تعذر تحميل الصفوف الدراسية.",
          )
        }
      })

    if (isTeacher && section === "courses") {
      subjectsApi

        .list()

        .then((result) => {
          if (active) setSubjects(listFrom(result))
        })

        .catch(() => undefined)
    }

    return () => {
      active = false
    }
  }, [isAdmin, isTeacher, onFeedback, section])

  const mutate = useCallback(
    async (
      request: () => Promise<unknown>,

      success: string,
    ): Promise<boolean> => {
      if (busy) return false

      setBusy(true)

      onFeedback("")

      try {
        await request()

        onFeedback(success)

        onSaved()

        return true
      } catch (cause) {
        onFeedback(
          cause instanceof Error ? cause.message : "تعذر حفظ التغييرات.",
        )

        return false
      } finally {
        setBusy(false)
      }
    },

    [busy, onFeedback, onSaved],
  )

  async function createTeacher(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const formElement = event.currentTarget

    const form = new FormData(formElement)

    const academicYears = form.getAll("academicYears").map(Number)

    const body: ApiObject = {
      firstName: String(form.get("firstName") ?? "").trim(),

      lastName: String(form.get("lastName") ?? "").trim(),

      email: String(form.get("email") ?? "").trim(),

      phoneNumber: String(form.get("phoneNumber") ?? "").trim(),

      password: String(form.get("password") ?? ""),

      bio: String(form.get("bio") ?? "").trim(),

      academicYears,
    }

    await mutate(() => adminApi.createTeacher(body), "تم إنشاء حساب المعلم.")

    formElement.reset()
  }

  async function updateTeacher(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (editingTeacher?.id === undefined) return

    const form = new FormData(event.currentTarget)

    const body = {
      firstName: String(form.get("firstName") ?? "").trim(),

      lastName: String(form.get("lastName") ?? "").trim(),

      phoneNumber: String(form.get("phoneNumber") ?? "").trim(),

      bio: String(form.get("bio") ?? "").trim(),

      academicYears: form.getAll("academicYears").map(Number),
    }

    if (
      await mutate(
        () => adminApi.updateTeacher(String(editingTeacher.id), body),

        "تم تحديث بيانات المعلم.",
      )
    ) {
      setEditingTeacher(null)
    }
  }

  async function createCourse(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!selectedSubjectId || selectedSubjectId === "__add_new__") {
      onFeedback("Ø§Ø®ØªØ± Ø§Ù„Ù…Ø§Ø¯Ø© Ø£Ùˆ Ø£Ø¶ÙÙ‡Ø§ Ù‚Ø¨Ù„ Ø¥Ù†Ø´Ø§Ø¡ Ø§Ù„Ø¯ÙˆØ±Ø©.")
      return
    }

    const formElement = event.currentTarget

    const form = new FormData(formElement)

    const body = {
      title: String(form.get("title") ?? "").trim(),

      description: String(form.get("description") ?? "").trim(),

      price: isCourseFree ? 0 : Number(form.get("price")),

      subjectId: Number(selectedSubjectId),
    }

    const saved = await mutate(
      () => teachersApi.createCourse(body),

      "تم إنشاء الدورة.",
    )

    if (saved) {
      formElement.reset()
      setSelectedSubjectId("")
      setIsCourseFree(false)
      setIsCreatingCourse(false)
    }
  }

  async function createSubjectFromCourseForm() {
    const name = newSubjectName.trim()
    const academicYear = Number(newSubjectYear)
    if (!name || !Number.isFinite(academicYear)) return

    const existing = subjects.find(
      (subject) =>
        String(subject.name ?? subject.title ?? "").trim().toLocaleLowerCase() ===
        name.toLocaleLowerCase() &&
        Number(subject.academicYear ?? subject.academicYearId) === academicYear,
    )
    if (existing?.id !== undefined) {
      setSelectedSubjectId(String(existing.id))
      setAddingSubject(false)
      onFeedback("Ø§Ù„Ù…Ø§Ø¯Ø© Ù…ÙˆØ¬ÙˆØ¯Ø© Ø¨Ø§Ù„ÙØ¹Ù„ØŒ ØªÙ… Ø§Ø®ØªÙŠØ§Ø±Ù‡Ø§.")
      return
    }

    let createResponse: unknown
    const created = await mutate(
      async () => {
        createResponse = await adminApi.createSubject({
          name,
          academicYear,
          isActive: true,
        })
        return createResponse
      },
      "ØªÙ…Øª Ø¥Ø¶Ø§ÙØ© Ø§Ù„Ù…Ø§Ø¯Ø©.",
    )
    if (!created) return

    setNewSubjectName("")
    setAddingSubject(false)
    try {
      const refreshed = listFrom(await subjectsApi.list())
      setSubjects(refreshed)
      const createdSubject = refreshed.find(
        (subject) =>
          String(subject.name ?? subject.title ?? "").trim().toLocaleLowerCase() ===
            name.toLocaleLowerCase() &&
          Number(subject.academicYear ?? subject.academicYearId) === academicYear,
      )
      const response = asRecord(unwrapApiResponse(createResponse))
      const id = createdSubject?.id ?? response.id ?? asRecord(response.subject).id
      if (id !== undefined) setSelectedSubjectId(String(id))
      else onFeedback("ØªÙ…Øª Ø¥Ø¶Ø§ÙØ© Ø§Ù„Ù…Ø§Ø¯Ø©ØŒ Ù„ÙƒÙ† Ø£Ø¹Ø¯ Ø§Ø®ØªÙŠØ§Ø±Ù‡Ø§ Ù…Ù† Ø§Ù„Ù‚Ø§Ø¦Ù…Ø©.")
    } catch (cause) {
      onFeedback(
        cause instanceof Error
          ? cause.message
          : "ØªÙ…Øª Ø¥Ø¶Ø§ÙØ© Ø§Ù„Ù…Ø§Ø¯Ø© ÙˆØªØ¹Ø°Ø± ØªØ­Ø¯ÙŠØ« Ø§Ù„Ù‚Ø§Ø¦Ù…Ø©.",
      )
    }
  }

  async function updateCourse(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const courseId = editingCourse?.id ?? editingCourse?.courseId

    if (courseId === undefined) return

    const form = new FormData(event.currentTarget)

    const body = {
      title: String(form.get("title") ?? "").trim(),

      description: String(form.get("description") ?? "").trim(),

      price: Number(form.get("price")),

      subjectId: Number(form.get("subjectId")),
    }

    const saved = await mutate(
      () => teachersApi.updateCourse(String(courseId), body),

      "تم تحديث الدورة.",
    )

    if (saved) setEditingCourse(null)
  }

  async function uploadCover(
    courseId: string,

    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault()

    const file = new FormData(event.currentTarget).get("file")

    if (!(file instanceof File) || !file.size) return

    await mutate(
      () => teachersApi.uploadCourseCover(courseId, file),

      "تم تحديث غلاف الدورة.",
    )
  }

  async function updateProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const form = new FormData(event.currentTarget)

    const academicYear = Number(form.get("academicYear"))

    if (isAdmin) return

    if (isTeacher) {
      const body = {
        firstName: String(form.get("firstName") ?? "").trim(),

        lastName: String(form.get("lastName") ?? "").trim(),

        phoneNumber: String(form.get("phoneNumber") ?? "").trim(),

        bio: String(form.get("bio") ?? "").trim(),

        academicYears: form.getAll("academicYears").map(Number),
      }

      const saved = await mutate(
        () => teachersApi.updateMe(body),
        "تم تحديث الملف الشخصي.",
      )
      if (saved) setEditingProfile(false)
    } else {
      const body = {
        firstName: String(form.get("firstName") ?? "").trim(),

        secondName: String(form.get("secondName") ?? "").trim(),

        thirdName: String(form.get("thirdName") ?? "").trim(),

        phoneNumber: String(form.get("phoneNumber") ?? "").trim(),

        parentPhoneNumber: String(form.get("parentPhoneNumber") ?? "").trim(),

        academicYear,
      }

      const saved = await mutate(
        () => studentsApi.updateMe(body),
        "تم تحديث الملف الشخصي.",
      )
      if (saved) setEditingProfile(false)
    }
  }

  async function updateAdminName(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const form = new FormData(event.currentTarget)
    const name = String(form.get("name") ?? "").trim()
    if (!name) {
      onFeedback("اكتب الاسم قبل الحفظ.")
      return
    }

    const saved = await mutate(
      () => adminApi.updateMe({ name }),
      "تم تحديث اسم الحساب.",
    )

    if (saved) {
      setAdminNameOverride(name)
      window.sessionStorage.setItem("eduhub.auth.name", name)
      setEditingAdminName(false)
    }
  }

  const openProgress = useCallback(async (courseId: string, enrollmentCourse?: unknown) => {
    setProgressCourse(courseId)

    setProgress(null)

    setProgressError(null)

    setProgressLoading(true)

    setActiveQuizLesson(null)

    setQuiz(null)

    setQuizError(null)

    setQuizValidationError(null)

    setQuizSubmitted(false)

    setQuizAnswers({})

    try {
      setProgress(await loadStudentCourseProgress(courseId, enrollmentCourse))
    } catch (cause) {
      setProgressError(
        cause instanceof Error ? cause.message : "تعذر تحميل تقدم الدورة.",
      )
    } finally {
      setProgressLoading(false)
    }
  }, [])

  async function toggleLesson(lesson: RecordValue) {
    const lessonId = lesson.lessonId ?? asRecord(lesson.lesson).id ?? lesson.id

    if (lessonId === undefined) return

    const lessonProgress = asRecord(lesson.progress ?? lesson.lessonProgress)

    const nextCompleted = !Boolean(
      lesson.isCompleted ?? lesson.completed ?? lessonProgress.isCompleted,
    )

    const updated = await mutate(
      () =>
        studentsApi.updateLessonProgress(String(lessonId), {
          isCompleted: nextCompleted,

          lastPosition: Number(
            lesson.lastPosition ?? lessonProgress.lastPosition ?? 0,
          ),
        }),

      nextCompleted ? "تم تسجيل إكمال الدرس." : "تم تحديث تقدم الدرس.",
    )

    if (updated && progressCourse) {
      try {
        setProgress(await loadStudentCourseProgress(progressCourse))
      } catch (cause) {
        onFeedback(
          cause instanceof Error
            ? cause.message
            : "تم تحديث الدرس لكن تعذر تحديث ملخص التقدم.",
        )
      }
    }
  }

  async function saveVideoPosition(lessonId: string, seconds: number, completed = false) {
    try {
      const lastPosition = Math.max(0, Math.floor(seconds))
      await studentsApi.updateLessonProgress(lessonId, {
        isCompleted: completed,
        lastPosition,
      })
      setProgress((current) => {
        if (!current) return current
        const lessons = progressLessons(current).map((lesson) =>
          String(lesson.lessonId ?? lesson.id ?? "") === lessonId
            ? { ...lesson, lessonId, id: lessonId, isCompleted: completed || lesson.isCompleted, lastPosition }
            : lesson,
        )
        return { ...current, lessons }
      })
    } catch (cause) {
      onFeedback(cause instanceof Error ? cause.message : "تعذر حفظ تقدم مشاهدة الدرس.")
    }
  }

  async function openQuiz(lessonId: string) {
    setActiveQuizLesson(lessonId)

    setQuiz(null)

    setQuizError(null)

    setQuizLoading(true)

    setQuizValidationError(null)

    setQuizSubmitted(false)

    setQuizAnswers({})

    try {
      const response = asRecord(
        unwrapApiResponse(await quizzesApi.forLesson(lessonId)),
      )

      const loadedQuiz = asRecord(
        response.quiz ??
          asRecord(response.data).quiz ??
          response.data ??
          response,
      )

      setQuiz(loadedQuiz)

      const quizId = loadedQuiz.id ?? loadedQuiz.quizId
      let hasPersistedStudentAttempt = false
      if (quizId !== undefined && quizId !== null) {
        const [attemptsResult, profileResult] = await Promise.allSettled([
          quizzesApi.attempts(String(quizId)),
          studentsApi.me(),
        ])

        const studentProfile =
          profileResult.status === "fulfilled"
            ? profileRecord(profileResult.value)
            : {}
        hasPersistedStudentAttempt =
          attemptsResult.status === "fulfilled" &&
          Object.keys(studentProfile).length > 0 &&
          attemptRecords(attemptsResult.value).some(
            (attempt) =>
              isSubmittedAttempt(attempt) &&
              attemptBelongsToStudent(attempt, studentProfile),
          )
      }

      setQuizSubmitted(
        (loadedQuiz.id !== undefined &&
          attemptedQuizIds.has(String(loadedQuiz.id))) ||
          hasSubmittedAttempt(loadedQuiz) ||
          hasPersistedStudentAttempt,
      )
    } catch (cause) {
      setQuizError(
        cause instanceof Error ? cause.message : "لا يتوفر اختبار لهذا الدرس.",
      )
    } finally {
      setQuizLoading(false)
    }
  }

  useEffect(() => {
    if (isAdmin || isTeacher || section !== "courses" || !focusCourseId) return

    const selectedEnrollment = listFrom(data).find((enrollment) => {
      const course = asRecord(enrollment.course)

      const courseId = enrollment.courseId ?? course.id ?? course.courseId

      return courseId !== undefined && String(courseId) === focusCourseId
    })

    if (!selectedEnrollment) return

    onFocusCourseHandled?.()

    const status = enrollmentStatus(
      selectedEnrollment.status,

      selectedEnrollment.isApproved,
    )

    if (status.canLearn) void openProgress(focusCourseId)
  }, [
    data,

    focusCourseId,

    isAdmin,

    isTeacher,

    openProgress,

    onFocusCourseHandled,

    section,
  ])

  function updateQuizAnswer(
    question: RecordValue,

    optionId: unknown,

    multipleAnswers: boolean,
  ) {
    const questionId = String(question.id)

    const selectedOptionId = String(optionId ?? "")

    setQuizAnswers((current) => {
      const selected = current[questionId] ?? []

      const next = multipleAnswers
        ? selected.includes(selectedOptionId)
          ? selected.filter((value) => value !== selectedOptionId)
          : [...selected, selectedOptionId]
        : [selectedOptionId]

      return { ...current, [questionId]: next }
    })

    setQuizValidationError(null)
  }

  async function submitQuiz(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (
      !quiz ||
      quiz.id === undefined ||
      quizSubmitted ||
      busy ||
      quizSubmitLock.current
    )
      return

    const questions = listFrom(quiz.questions)

    if (!questions.length) {
      setQuizValidationError("لا توجد أسئلة متاحة في هذا الاختبار.")

      return
    }

    const answers = questions.map((question) => {
      const questionId = apiIdentifier(question.id)

      const selectedOptionIds = (quizAnswers[String(question.id)] ?? [])

        .map((value) => apiIdentifier(value))

        .filter(
          (value): value is number | string => value !== null && value !== "",
        )

      return { questionId, selectedOptionIds }
    })

    if (answers.some((answer) => answer.questionId === null)) {
      setQuizValidationError(
        "تعذر التعرف على أحد أسئلة الاختبار. حدّث الصفحة وحاول مرة أخرى.",
      )

      return
    }

    if (answers.some((answer) => answer.selectedOptionIds.length === 0)) {
      setQuizValidationError("أجب عن كل الأسئلة قبل تسليم الاختبار.")

      return
    }

    setQuizValidationError(null)

    quizSubmitLock.current = true

    setBusy(true)

    onFeedback("")

    try {
      await quizzesApi.submitAttempt(String(quiz.id), { answers })

      setQuizSubmitted(true)

      setAttemptedQuizIds((current) => new Set(current).add(String(quiz.id)))

      onFeedback("تم تسليم إجابات الاختبار بنجاح.")
    } catch (cause) {
      if (
        cause instanceof ApiError &&
        (cause.status === 409 ||
          /already|attempt|محاول|سبق|مستخدم/i.test(cause.message))
      ) {
        setQuizSubmitted(true)

        setAttemptedQuizIds((current) => new Set(current).add(String(quiz.id)))

        onFeedback("سبق تسليم هذا الاختبار، ولا يمكن إعادة المحاولة.")

        return
      }

      onFeedback(
        cause instanceof Error ? cause.message : "تعذر تسليم الاختبار.",
      )
    } finally {
      quizSubmitLock.current = false

      setBusy(false)
    }
  }

  if (isAdmin && section === "teachers")
    return (
      <div className="mb-5 space-y-4">
        <form
          onSubmit={(event) => void createTeacher(event)}
          className="grid gap-3 rounded-xl border border-stroke bg-surface p-4 sm:grid-cols-2 lg:grid-cols-3"
        >
          <label className={labelClass}>
            الاسم الأول
            <input name="firstName" required className={fieldClass} />
          </label>
          <label className={labelClass}>
            اسم العائلة
            <input name="lastName" required className={fieldClass} />
          </label>
          <label className={labelClass}>
            البريد الإلكتروني
            <input name="email" type="email" required className={fieldClass} />
          </label>
          <label className={labelClass}>
            رقم الهاتف
            <input
              name="phoneNumber"
              type="tel"
              required
              className={fieldClass}
            />
          </label>
          <label className={labelClass}>
            كلمة المرور
            <input
              name="password"
              type="password"
              required
              minLength={8}
              className={fieldClass}
            />
          </label>
          <label className={labelClass}>
            نبذة
            <input name="bio" className={fieldClass} />
          </label>
          <label className={labelClass}>
            الصفوف التي يدرّسها
            <select
              name="academicYears"
              multiple
              required
              className="min-h-20 rounded-lg border border-stroke bg-white px-3 py-2 text-sm text-ink"
            >
              {years.map((year) => (
                <option key={year.id} value={year.value}>
                  {year.arabicName}
                </option>
              ))}
            </select>
          </label>
          <button
            disabled={busy || !years.length}
            className="self-end rounded-lg bg-nuwa-base px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            إنشاء حساب معلم
          </button>
        </form>
        <div className="grid items-start gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {listFrom(data).map((teacher) => {
            const isEditingTeacher =
              editingTeacher &&
              String(editingTeacher.id) === String(teacher.id)
            const teacherDetails = isEditingTeacher ? editingTeacher : teacher

            return (
            <article
              key={String(teacher.id)}
              className="rounded-[24px] border border-stroke bg-white p-5 text-sm shadow-nuwa transition hover:-translate-y-0.5 hover:shadow-nuwa-md"
            >
              {isEditingTeacher && editingTeacher && (
                  <form
                    onSubmit={(event) => void updateTeacher(event)}
                    className="mb-5 grid min-w-0 gap-3 rounded-2xl border border-nuwa-base/20 bg-nuwa-ice/70 p-4 sm:grid-cols-2"
                  >
                    <h3 className="sm:col-span-2 font-bold text-ink">
                      تعديل بيانات المعلم
                    </h3>
                    <label className={labelClass}>
                      الاسم الأول
                      <input
                        name="firstName"
                        required
                        defaultValue={String(editingTeacher.firstName ?? "")}
                        className={fieldClass}
                      />
                    </label>
                    <label className={labelClass}>
                      اسم العائلة
                      <input
                        name="lastName"
                        required
                        defaultValue={String(editingTeacher.lastName ?? "")}
                        className={fieldClass}
                      />
                    </label>
                    <label className={labelClass}>
                      رقم الهاتف
                      <input
                        name="phoneNumber"
                        type="tel"
                        required
                        defaultValue={String(editingTeacher.phoneNumber ?? "")}
                        className={fieldClass}
                      />
                    </label>
                    <label className={labelClass}>
                      نبذة
                      <input
                        name="bio"
                        defaultValue={String(editingTeacher.bio ?? "")}
                        className={fieldClass}
                      />
                    </label>
                    <label className={`${labelClass} sm:col-span-2`}>
                      الصفوف التي يدرّسها
                      <select
                        name="academicYears"
                        multiple
                        required
                        defaultValue={
                          Array.isArray(editingTeacher.academicYears)
                            ? editingTeacher.academicYears.map(String)
                            : []
                        }
                        className="min-h-20 w-full rounded-lg border border-stroke bg-white px-3 py-2 text-sm text-ink"
                      >
                        {years.map((year) => (
                          <option key={year.id} value={year.value}>
                            {year.arabicName}
                          </option>
                        ))}
                      </select>
                    </label>
                    <div className="flex flex-wrap items-center gap-2 sm:col-span-2">
                      <button
                        disabled={busy}
                        className="rounded-lg bg-nuwa-base px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
                      >
                        حفظ بيانات المعلم
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingTeacher(null)}
                        className="rounded-lg border border-stroke px-4 py-2.5 text-sm"
                      >
                        إلغاء
                      </button>
                    </div>
                  </form>
                )}
              <div className="mb-4 flex items-start justify-between gap-3">
                <PersonAvatar
                  name={String(
                    teacher.fullName ?? teacher.name ?? teacher.email ?? "مدرس",
                  )}
                  imageUrl={String(
                    teacher.avatarUrl ??
                      teacher.profileImageUrl ??
                      teacher.imageUrl ??
                      "",
                  )}
                  size="lg"
                  status={teacher.isActive === true ? "active" : undefined}
                />
                <button
                  type="button"
                  onClick={async () => {
                    if (
                      editingTeacher &&
                      String(editingTeacher.id) === String(teacher.id)
                    ) {
                      setEditingTeacher(null)
                      return
                    }
                    try {
                      setEditingTeacher(
                        asRecord(await adminApi.teacher(String(teacher.id))),
                      )
                    } catch (cause) {
                      onFeedback(
                        cause instanceof Error
                          ? cause.message
                          : "تعذر تحميل بيانات المعلم.",
                      )
                    }
                  }}
                  className="inline-flex max-w-[60%] shrink-0 items-center gap-2 rounded-xl border border-nuwa-base/20 bg-nuwa-ice px-3 py-2 text-xs font-semibold text-nuwa-deep transition hover:bg-nuwa-soft sm:max-w-none"
                >
                  <Pencil size={14} />
                  {isEditingTeacher
                    ? "إغلاق التعديل"
                    : "تعديل المعلم"}
                </button>
              </div>
              <h3 className="font-bold text-ink">
                {String(
                  teacher.fullName ??
                    teacher.name ??
                    teacher.email ??
                    teacher.id,
                )}
              </h3>
              {teacherDetails.email && (
                <p className="mt-1 break-all text-xs text-ink-muted">
                  {String(teacherDetails.email)}
                </p>
              )}
              {teacherDetails.phoneNumber && (
                <p className="mt-1 text-xs text-ink-muted">
                  {String(teacherDetails.phoneNumber)}
                </p>
              )}
              {teacherDetails.bio && (
                <p className="mt-3 line-clamp-3 text-xs leading-6 text-ink-muted">
                  {String(teacherDetails.bio)}
                </p>
              )}
              {Array.isArray(teacherDetails.academicYears) &&
                teacherDetails.academicYears.length > 0 && (
                  <p className="mt-2 text-xs text-ink-muted">
                    الصفوف: {teacherDetails.academicYears
                      .map((year) =>
                        typeof year === "object" && year !== null
                          ? String(
                              (year as RecordValue).arabicName ??
                                (year as RecordValue).name ??
                                (year as RecordValue).value ??
                                "",
                            )
                          : String(year),
                      )
                      .filter(Boolean)
                      .join("، ")}
                  </p>
                )}
              <span className="mt-3 inline-flex rounded-full bg-nuwa-soft px-3 py-1 text-xs font-semibold text-nuwa-deep">
                {String(
                  teacher.subjectName ?? teacher.specialization ?? "حساب مدرس",
                )}
              </span>
            </article>
            )
          })}
        </div>
      </div>
    )

  if (isTeacher && section === "student-progress")
    return <TeacherStudentProgress />

  if (isTeacher && section === "courses")
    return (
      <div className="mb-6 space-y-6">
        <section className="overflow-hidden rounded-2xl border border-stroke bg-white shadow-nuwa">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-stroke bg-gradient-to-l from-nuwa-ice to-white px-5 py-4">
            <div>
              <h3 className="text-base font-bold text-ink">إنشاء دورة جديدة</h3>
              <p className="mt-1 text-xs leading-5 text-ink-muted">
                احفظها كمسودة أولاً، ثم انشرها عندما تصبح جاهزة للطلاب.
              </p>
            </div>
            <span className="inline-flex items-center gap-2 rounded-full bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-800">
              <span className="size-2 rounded-full bg-amber-500" />
              تُنشأ كمسودة
            </span>
            <button
              type="button"
              aria-expanded={isCreatingCourse}
              onClick={() => setIsCreatingCourse((open) => !open)}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-nuwa-base px-5 text-sm font-bold text-white shadow-sm transition hover:bg-nuwa-deep focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nuwa-base focus-visible:ring-offset-2"
            >
              <Plus size={17} className={isCreatingCourse ? "rotate-45 transition-transform" : "transition-transform"} />
              {isCreatingCourse ? "إخفاء النموذج" : "إضافة دورة"}
            </button>
          </div>
          {isCreatingCourse && (
          <form
            onSubmit={(event) => void createCourse(event)}
            className="grid gap-4 p-5 sm:grid-cols-2 xl:grid-cols-4"
          >
            <label className={labelClass}>
              عنوان الدورة
              <input
                name="title"
                required
                maxLength={160}
                aria-label="عنوان الدورة كما سيظهر للطلاب"
                placeholder="مثال: أساسيات الرياضيات"
                className={fieldClass}
              />
            </label>
            <label className={`${labelClass} sm:col-span-2`}>
              وصف الدورة
              <textarea
                name="description"
                required
                maxLength={2000}
                rows={2}
                aria-label="نبذة عن محتوى الدورة وما سيتعلمه الطالب"
                placeholder="اكتب نبذة تساعد الطالب على معرفة محتوى الدورة"
                className="w-full resize-y rounded-lg border border-stroke bg-white px-3 py-2 text-sm text-ink"
              />
            </label>
            <label className={labelClass}>
              المادة
              <select
                name="subjectId"
                required
                aria-label="المادة الدراسية للدورة"
                className={fieldClass}
                value={addingSubject ? "__add_new__" : selectedSubjectId}
                onChange={(event) => {
                  const value = event.currentTarget.value
                  if (value === "__add_new__") {
                    setAddingSubject(true)
                    setSelectedSubjectId("")
                    setNewSubjectYear((current) => current || String(years[0]?.value ?? ""))
                    return
                  }
                  setAddingSubject(false)
                  setSelectedSubjectId(value)
                }}
              >
                <option value="" disabled>
                  {subjects.length ? "اختر المادة" : "لا توجد مواد متاحة"}
                </option>
                {subjects.map((subject) => (
                  <option key={String(subject.id)} value={String(subject.id)}>
                    {String(subject.name ?? subject.title ?? subject.id)}
                  </option>
                ))}
                <option value="__add_new__">＋ إضافة مادة جديدة</option>
              </select>
            </label>
            {addingSubject && (
              <div className="rounded-2xl border border-nuwa-base/20 bg-nuwa-soft/40 p-4 sm:col-span-2 xl:col-span-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className={labelClass}>
                    اسم المادة الجديدة
                    <input
                      autoFocus
                      value={newSubjectName}
                      onChange={(event) => setNewSubjectName(event.currentTarget.value)}
                      maxLength={100}
                      placeholder="مثال: اللغة العربية"
                      className={fieldClass}
                    />
                  </label>
                  <label className={labelClass}>
                    الصف الدراسي
                    <select
                      value={newSubjectYear || String(years[0]?.value ?? "")}
                      onChange={(event) => setNewSubjectYear(event.currentTarget.value)}
                      className={fieldClass}
                      required
                    >
                      {years.map((year) => (
                        <option key={year.id} value={String(year.value)}>
                          {year.arabicName || year.name}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => void createSubjectFromCourseForm()}
                    disabled={busy || !newSubjectName.trim() || !years.length}
                    className="rounded-lg bg-nuwa-base px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    إضافة المادة واختيارها
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAddingSubject(false)
                      setNewSubjectName("")
                    }}
                    className="rounded-lg border border-stroke bg-white px-4 py-2 text-sm font-semibold text-ink-muted"
                  >
                    إلغاء
                  </button>
                </div>
              </div>
            )}
            <div className="space-y-3">
              <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border border-stroke bg-white px-3 py-2.5 text-sm font-semibold text-ink">
                <input
                  type="checkbox"
                  checked={isCourseFree}
                  onChange={(event) => setIsCourseFree(event.currentTarget.checked)}
                  className="size-4 accent-emerald-700"
                />
                الدورة مجانية
              </label>
              {!isCourseFree && <label className={labelClass}>
              السعر
              <input
                name="price"
                type="number"
                min="0"
                step="0.01"
                required
                defaultValue="0"
                aria-label="سعر الدورة"
                className={fieldClass}
              />
            </label>}
              {isCourseFree && (
                <p className="rounded-lg bg-nuwa-soft px-3 py-2 text-xs font-medium text-nuwa-deep">
                  سيتم إنشاء الدورة بسعر صفر.
                </p>
              )}
            </div>
            <div className="flex items-end">
              <button
                disabled={busy || !subjects.length}
                className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-nuwa-base px-4 text-sm font-semibold text-white transition hover:bg-nuwa-deep disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Plus size={17} />
                إنشاء كمسودة
              </button>
            </div>
          </form>
          )}
        </section>

        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h3 className="text-lg font-bold text-ink">دوراتي</h3>
            <p className="mt-1 text-sm text-ink-muted">
              تحكم في النشر، وعدّل تفاصيل الدورة ومحتواها، أو احذفها نهائياً.
            </p>
          </div>
          <span className="rounded-full border border-stroke bg-white px-3 py-1.5 text-xs font-semibold text-ink-muted">
            {teacherCourses.length} دورة
          </span>
        </div>

        <div className="flex flex-wrap gap-2 rounded-2xl border border-stroke bg-white p-3">
          {([
            ["all", "كل الدورات", teacherCourses.length],
            [
              "published",
              "منشورة",
              teacherCourses.filter(getTeacherCoursePublished).length,
            ],
            [
              "draft",
              "مسودات",
              teacherCourses.filter((course) => !getTeacherCoursePublished(course)).length,
            ],
          ] as const).map(([filter, label, count]) => (
            <button
              key={filter}
              type="button"
              aria-pressed={teacherCourseFilter === filter}
              onClick={() => setTeacherCourseFilter(filter)}
              className={`inline-flex min-h-10 items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition ${teacherCourseFilter === filter ? "bg-nuwa-base text-white" : "bg-canvas text-ink-muted hover:bg-nuwa-ice hover:text-nuwa-deep"}`}
            >
              {label}
              <span className={`rounded-full px-2 py-0.5 text-xs ${teacherCourseFilter === filter ? "bg-white/15 text-white" : "bg-white text-ink-muted"}`}>
                {count}
              </span>
            </button>
          ))}
        </div>

        {teacherCourses.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-stroke-strong bg-white px-5 py-10 text-center">
            <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-nuwa-soft text-nuwa-base">
              <BookOpen size={23} />
            </span>
            <p className="mt-3 font-bold text-ink">لسه مفيش دورات هنا</p>
            <p className="mt-1 text-sm text-ink-muted">
              أنشئ دورة جديدة؛ هتظهر كمسودة وتقدر تنشرها وقت ما تكون جاهزة.
            </p>
          </div>
        ) : (
          visibleTeacherCourses.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-stroke-strong bg-white px-5 py-10 text-center text-sm text-ink-muted">
              لا توجد دورات في هذا القسم حاليًا.
            </div>
          ) : (
          <div className="grid items-start gap-4 md:grid-cols-2 2xl:grid-cols-3">
            {visibleTeacherCourses.map((course) => {
              const id = String(course.id ?? course.courseId ?? "")

              const isPublished = getTeacherCoursePublished(course)

              const isEditing =
                String(editingCourse?.id ?? editingCourse?.courseId ?? "") ===
                id

              const isShowingContent = contentCourseId === id

              const coverUrl =
                typeof course.coverImageUrl === "string"
                  ? course.coverImageUrl
                  : ""

              return (
                <article
                  key={id}
                  className={`min-w-0 overflow-hidden rounded-2xl border border-stroke bg-white shadow-sm transition duration-200 hover:border-nuwa-base/30 hover:shadow-nuwa-md ${isShowingContent ? "md:col-span-2 2xl:col-span-3" : ""}`}
                >
                  <div className="relative flex h-36 items-end overflow-hidden bg-gradient-to-br from-nuwa-deep via-nuwa-base to-emerald-400 p-4">
                    {coverUrl ? (
                      <img
                        src={coverUrl}
                        alt=""
                        loading="lazy"
                        onError={(event) => {
                          event.currentTarget.style.display = "none"
                        }}
                        className="absolute inset-0 size-full object-cover"
                      />
                    ) : (
                      <>
                        <div className="absolute -left-6 -top-14 size-40 rounded-full border border-white/20" />
                        <div className="absolute -left-2 -top-8 size-28 rounded-full border border-white/20" />
                        <BookOpen
                          size={32}
                          className="absolute left-4 top-4 text-white/70"
                        />
                      </>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-neutral-950/65 via-transparent to-transparent" />
                    <span
                      className={`relative inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold ${
                        isPublished
                          ? "bg-emerald-100 text-emerald-800"
                          : "bg-amber-100 text-amber-900"
                      }`}
                    >
                      {isPublished ? <Eye size={14} /> : <EyeOff size={14} />}
                      {isPublished ? "منشورة للعامة" : "مسودة"}
                    </span>
                  </div>

                  <div className="min-w-0 space-y-4 p-2.5 sm:p-4">
                    <div className="min-w-0">
                      <h4 className="truncate text-base font-bold text-ink">
                        {String(course.title ?? `دورة ${id}`)}
                      </h4>
                      <p className="mt-1 line-clamp-2 min-h-10 text-sm leading-5 text-ink-muted">
                        {String(
                          course.description ?? "لا يوجد وصف مضاف للدورة.",
                        )}
                      </p>
                      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-muted">
                        <span>
                          {String(
                            course.subjectName ??
                              asRecord(course.subject).name ??
                              "بدون مادة",
                          )}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>
                          {typeof course.price === "number" &&
                          course.price === 0
                            ? "مجانية"
                            : `${String(course.price ?? 0)} ر.س`}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        disabled={busy || !id}
                        onClick={() =>
                          void mutate(
                            () =>
                              isPublished
                                ? teachersApi.unpublishCourse(id)
                                : teachersApi.publishCourse(id),

                            isPublished
                              ? "تم حفظ الدورة كمسودة وإخفاؤها عن العامة."
                              : "تم نشر الدورة وأصبحت متاحة للعامة.",
                          ).then((saved) => {
                            if (!saved) return

                            setPublishedOverrides((current) => ({
                              ...current,

                              [id]: !isPublished,
                            }))
                          })
                        }
                        className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-bold transition disabled:cursor-not-allowed disabled:opacity-50 ${
                          isPublished
                            ? "border border-amber-200 bg-amber-50 text-amber-900 hover:bg-amber-100"
                            : "bg-emerald-600 text-white hover:bg-emerald-700"
                        }`}
                      >
                        {isPublished ? <EyeOff size={15} /> : <Eye size={15} />}
                        {isPublished ? "حفظ كمسودة" : "نشر للعامة"}
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setEditingCourse(isEditing ? null : course)
                        }
                        className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border px-3 py-2 text-xs font-bold transition ${
                          isEditing
                            ? "border-nuwa-base bg-nuwa-soft text-nuwa-deep"
                            : "border-stroke bg-white text-ink hover:bg-canvas"
                        }`}
                        aria-expanded={isEditing}
                      >
                        <Pencil size={15} />
                        {isEditing ? "إغلاق التعديل" : "تعديل"}
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setContentCourseId(isShowingContent ? null : id)
                        }
                        className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-stroke bg-white px-3 py-2 text-xs font-bold text-ink transition hover:bg-canvas"
                        aria-expanded={isShowingContent}
                      >
                        <ClipboardCheck size={15} />
                        {isShowingContent ? "إغلاق المحتوى" : "الوحدات والدروس"}
                      </button>
                      <button
                        type="button"
                        disabled={busy || !id}
                        onClick={() => {
                          void (async () => {
                            const confirmed = await confirm({
                              title: "حذف الدورة نهائيًا؟",
                              message:
                                "سيتم حذف الدورة ومحتواها نهائيًا، ولن يمكن استعادتها.",
                              variant: "danger",
                              confirmText: "حذف نهائي",
                              onConfirm: async () => {
                                const saved = await mutate(async () => {
                                  if (isPublished) {
                                    await teachersApi.unpublishCourse(id)
                                    setPublishedOverrides((current) => ({
                                      ...current,
                                      [id]: false,
                                    }))
                                  }

                                  await teachersApi.deleteCourse(id)
                                }, "تم حذف الدورة نهائياً.")
                                if (!saved) throw new Error("تعذر حذف الدورة.")
                              },
                            })
                            if (!confirmed) return

                            setDeletedCourseIds((current) => {
                              const next = new Set(current)
                              next.add(id)
                              return next
                            })

                            if (isEditing) setEditingCourse(null)
                            if (isShowingContent) setContentCourseId(null)
                          })()
                        }}
                        className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-danger transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <Trash2 size={15} />
                        حذف نهائي
                      </button>
                    </div>

                    <details className="group rounded-xl border border-stroke bg-canvas/60">
                      <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2.5 text-xs font-semibold text-ink-muted [&::-webkit-details-marker]:hidden">
                        <ImagePlus size={15} />
                        إدارة غلاف الدورة
                        <span className="me-auto text-[11px] text-nuwa-base group-open:hidden">
                          فتح
                        </span>
                        <span className="me-auto hidden text-[11px] text-nuwa-base group-open:inline">
                          إغلاق
                        </span>
                      </summary>
                      <div className="border-t border-stroke p-3">
                        <form
                          onSubmit={(event) => void uploadCover(id, event)}
                          className="flex flex-wrap items-center gap-2"
                        >
                          <input
                            name="file"
                            type="file"
                            accept="image/*"
                            required
                            aria-label="اختر صورة غلاف الدورة"
                            className="min-w-0 flex-1 text-xs file:me-2 file:rounded-md file:border-0 file:bg-white file:px-2 file:py-1.5 file:text-xs file:font-semibold file:text-ink"
                          />
                          <button
                            disabled={busy}
                            className="rounded-lg border border-stroke bg-white px-3 py-2 text-xs font-semibold text-ink hover:bg-canvas disabled:opacity-50"
                          >
                            رفع الغلاف
                          </button>
                        </form>
                        {coverUrl && (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => {
                              void confirm({
                                title: "حذف غلاف الدورة؟",
                                message:
                                  "سيتم إزالة صورة الغلاف الحالية من الدورة.",
                                variant: "danger",
                                confirmText: "حذف الغلاف",
                                onConfirm: async () => {
                                  const saved = await mutate(
                                    () => teachersApi.deleteCourseCover(id),
                                    "تم حذف غلاف الدورة.",
                                  )
                                  if (!saved)
                                    throw new Error("تعذر حذف غلاف الدورة.")
                                },
                              })
                            }}
                            className="mt-2 text-xs font-semibold text-danger hover:underline disabled:opacity-50"
                          >
                            حذف الغلاف الحالي
                          </button>
                        )}
                      </div>
                    </details>

                    {isEditing && (
                      <form
                        key={`edit-${id}`}
                        onSubmit={(event) => void updateCourse(event)}
                        className="min-w-0 space-y-3 rounded-xl border border-nuwa-base/25 bg-nuwa-ice p-3 sm:p-4"
                      >
                        <div>
                          <h5 className="text-sm font-bold text-nuwa-deep">
                            تعديل تفاصيل الدورة
                          </h5>
                          <p className="mt-1 text-xs text-ink-muted">
                            التعديلات تظهر هنا أسفل الدورة التي اخترتها.
                          </p>
                        </div>
                        <label className={labelClass}>
                          عنوان الدورة
                          <input
                            name="title"
                            required
                            maxLength={160}
                            defaultValue={String(course.title ?? "")}
                            className={fieldClass}
                          />
                        </label>
                        <label className={labelClass}>
                          الوصف
                          <textarea
                            name="description"
                            required
                            maxLength={2000}
                            rows={3}
                            defaultValue={String(course.description ?? "")}
                            className="w-full resize-y rounded-lg border border-stroke bg-white px-3 py-2 text-sm text-ink"
                          />
                        </label>
                        <div className="grid min-w-0 gap-3 sm:grid-cols-2">
                          <label className={labelClass}>
                            السعر
                            <input
                              name="price"
                              type="number"
                              min="0"
                              step="0.01"
                              required
                              defaultValue={String(course.price ?? 0)}
                              className={fieldClass}
                            />
                          </label>
                          <label className={labelClass}>
                            المادة
                            <select
                              name="subjectId"
                              required
                              defaultValue={String(course.subjectId ?? "")}
                              className={fieldClass}
                            >
                              {subjects.map((subject) => (
                                <option
                                  key={String(subject.id)}
                                  value={String(subject.id)}
                                >
                                  {String(
                                    subject.name ?? subject.title ?? subject.id,
                                  )}
                                </option>
                              ))}
                            </select>
                          </label>
                        </div>
                        <div className="flex gap-2">
                          <button
                            disabled={busy}
                            className="min-h-10 flex-1 rounded-lg bg-nuwa-base px-4 py-2 text-sm font-semibold text-white hover:bg-nuwa-deep disabled:opacity-50"
                          >
                            حفظ التعديلات
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingCourse(null)}
                            className="min-h-10 rounded-lg border border-stroke bg-white px-4 py-2 text-sm font-semibold text-ink"
                          >
                            إلغاء
                          </button>
                        </div>
                      </form>
                    )}

                    {isShowingContent && (
                      <TeacherCourseContent
                        courseId={id}
                        onChanged={onSaved}
                        onFeedback={onFeedback}
                      />
                    )}
                  </div>
                </article>
              )
            })}
          </div>
          )
        )}
      </div>
    )

  if (!isAdmin && !isTeacher && section === "courses") {
    const studentEnrollments = listFrom(data).filter(
      (enrollment) => !isRejectedEnrollment(enrollment),
    )

    const lessons = progressLessons(progress)

    const safeProgressPercent = progressPercentage(progress)

    const completedLessonCount = Number(
      progress?.completedLessons ??
        progress?.completedLessonCount ??
        lessons.filter((lesson) => lesson.isCompleted).length,
    )

    const totalLessonCount = Number(
      progress?.totalLessons ?? progress?.totalLessonCount ?? lessons.length,
    )

    return (
      <div className="mb-5 space-y-4">
        {studentEnrollments.length > 0 && (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {studentEnrollments.map((enrollment, index) => {
              const course = asRecord(enrollment.course)

              const teacher = asRecord(enrollment.teacher ?? course.teacher)

              const courseId =
                enrollment.courseId ?? course.id ?? course.courseId

              const title =
                enrollment.courseTitle ??
                enrollment.courseName ??
                course.title ??
                course.name ??
                `دورة ${index + 1}`

              const teacherName =
                enrollment.teacherName ??
                course.teacherName ??
                teacher.fullName ??
                teacher.name

              const subject =
                enrollment.subjectName ??
                course.subjectName ??
                asRecord(course.subject).name

              const status = enrollmentStatus(
                enrollment.status ?? enrollment.enrollmentStatus,

                enrollment.isApproved,
              )

              const enrollmentProgress = asRecord(enrollment.progress)

              const rawProgress = Number(
                enrollment.progressPercentage ??
                  enrollment.progressPercent ??
                  enrollmentProgress.progressPercentage ??
                  enrollmentProgress.percentage ??
                  0,
              )

              const percent = Number.isFinite(rawProgress)
                ? Math.max(0, Math.min(100, rawProgress))
                : 0

              const canLearn = courseId !== undefined && status.canLearn

              return (
                <article
                  key={String(enrollment.id ?? courseId ?? index)}
                  className={`flex flex-col rounded-2xl border border-stroke bg-white p-5 shadow-nuwa transition hover:-translate-y-0.5 hover:border-nuwa-base/40 hover:shadow-nuwa-md ${
                    String(progressCourse) === String(courseId)
                      ? "ring-2 ring-nuwa-base/25"
                      : ""
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="text-base font-bold leading-6 text-ink">
                        {String(title)}
                      </h3>
                      {subject !== undefined &&
                        subject !== null &&
                        String(subject).trim() && (
                          <p className="mt-1 text-xs font-medium text-ink-muted">
                            {String(subject)}
                          </p>
                        )}
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${status.tone}`}
                    >
                      {status.label}
                    </span>
                  </div>
                  {teacherName !== undefined &&
                    teacherName !== null &&
                    String(teacherName).trim() && (
                      <p className="mt-3 rounded-lg bg-canvas px-3 py-2 text-sm text-ink-muted">
                        المعلم:{" "}
                        <span className="font-semibold text-ink">
                          {String(teacherName)}
                        </span>
                      </p>
                    )}
                  <div className="mt-4">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-ink-muted">
                        تقدمك في الدورة
                      </span>
                      <span className="font-bold tabular-nums text-ink">
                        {Math.round(percent)}%
                      </span>
                    </div>
                    <div
                      className="mt-2 h-2 overflow-hidden rounded-full bg-nuwa-soft"
                      role="progressbar"
                      aria-label={`التقدم في دورة ${String(title)}`}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={Math.round(percent)}
                    >
                      <div
                        className="h-full rounded-full bg-nuwa-base transition-[width]"
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </div>
                  <div className="mt-auto pt-5">
                    {canLearn ? (
                      <button
                        type="button"
                        disabled={progressLoading}
                        onClick={() => void openProgress(String(courseId), course)}
                        className="w-full rounded-lg bg-nuwa-base px-3 py-2.5 text-sm font-bold text-white transition hover:bg-nuwa-deep disabled:cursor-wait disabled:opacity-60"
                      >
                        {progressLoading &&
                        String(progressCourse) === String(courseId)
                          ? "جارٍ فتح الدورة..."
                          : "متابعة التعلم"}
                      </button>
                    ) : (
                      <p className="rounded-lg bg-amber-50 px-3 py-2.5 text-center text-xs leading-5 text-amber-900">
                        {status.canLearn
                          ? "لا يتوفر معرّف الدورة لفتح محتواها."
                          : "ستتمكن من متابعة المحتوى بعد اعتماد طلبك من المعلم."}
                      </p>
                    )}
                  </div>
                </article>
              )
            })}
          </div>
        )}
        {studentEnrollments.length === 0 && (
          <div className="rounded-2xl border border-dashed border-stroke-strong bg-white px-5 py-8 text-center text-sm text-ink-muted">
            لا توجد دورات أو طلبات التحاق نشطة حالياً.
          </div>
        )}
        {progressCourse && (
          <section className="rounded-2xl border border-stroke bg-white p-4 shadow-nuwa-md sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <span className="text-xs font-semibold text-nuwa-base">
                  مساحة التعلم
                </span>
                <h3 className="mt-1 text-lg font-bold text-ink">تقدم الدورة</h3>
                <p className="mt-1 text-sm text-ink-muted">
                  {String(completedLessonCount)} من {String(totalLessonCount)}{" "}
                  درس · {Math.round(safeProgressPercent)}% مكتمل
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setProgressCourse(null)

                  setProgress(null)

                  setProgressError(null)

                  setActiveQuizLesson(null)

                  setQuiz(null)

                  setQuizError(null)

                  setQuizValidationError(null)

                  setQuizSubmitted(false)
                }}
                className="rounded-lg border border-stroke px-3 py-2 text-xs font-semibold text-ink-muted transition hover:bg-canvas hover:text-ink"
              >
                إغلاق
              </button>
            </div>
            <div
              className="mt-4 h-2 overflow-hidden rounded-full bg-nuwa-soft"
              role="progressbar"
              aria-label="نسبة إنجاز الدورة"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(safeProgressPercent)}
            >
              <div
                className="h-full rounded-full bg-nuwa-base transition-[width]"
                style={{ width: `${safeProgressPercent}%` }}
              />
            </div>
            {progressLoading && (
              <p className="mt-3 text-sm text-ink-muted">جارٍ تحميل الدروس...</p>
            )}
            {progressError && (
              <div className="mt-4 rounded-xl border border-danger/20 bg-danger-light p-4">
                <p role="alert" className="text-sm text-danger">
                  {progressError}
                </p>
                <button
                  type="button"
                  onClick={() => void openProgress(progressCourse)}
                  className="mt-3 rounded-lg border border-danger/30 px-3 py-2 text-xs font-bold text-danger"
                >
                  إعادة المحاولة
                </button>
              </div>
            )}
            {progress && (
              <>
                {typeof progress.contentLoadError === "string" && (
                  <p
                    role="alert"
                    className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-900"
                  >
                    تعذر تحميل تفاصيل الدروس والفيديوهات: {progress.contentLoadError}
                  </p>
                )}
                {lessons.length ? (
                  <ul className="mt-4 divide-y divide-stroke overflow-hidden rounded-xl border border-stroke px-4">
                    {lessons.map((lesson) => {
                      const lessonId = String(
                        lesson.lessonId ?? lesson.id ?? "",
                      )

                      return (
                        <li
                          key={lessonId}
                          className="py-4"
                        >
                          <div className="min-w-0">
                            <p className="font-semibold text-ink">
                              {String(
                                lesson.title ??
                                  lesson.lessonTitle ??
                                  lesson.name ??
                                  `الدرس ${lessonId}`,
                              )}
                            </p>
                            <p className="mt-1 text-xs text-ink-muted">
                              {lesson.isCompleted
                                ? "تم إكمال هذا الدرس"
                                : "لم يكتمل بعد"}
                            </p>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => void toggleLesson(lesson)}
                              disabled={busy}
                              className="rounded-lg border border-stroke px-3 py-2 text-xs font-semibold text-ink disabled:opacity-50"
                            >
                              {lesson.isCompleted
                                ? "إلغاء الإكمال"
                                : "تحديد كمكتمل"}
                            </button>
                            <button
                              type="button"
                              onClick={() => void openQuiz(lessonId)}
                              disabled={quizLoading}
                              className="rounded-lg bg-nuwa-soft px-3 py-2 text-xs font-semibold text-nuwa-base disabled:opacity-50"
                            >
                              {quizLoading && activeQuizLesson === lessonId
                                ? "جارٍ التحميل..."
                                : "اختبار الدرس"}
                            </button>
                          </div>
                          {lesson.video ? (
                            <LessonVideoPlayer
                              video={lesson.video}
                              title={String(lesson.title ?? lesson.name ?? "فيديو الدرس")}
                              lastPosition={Number(lesson.lastPosition ?? 0)}
                              onPause={(seconds) => void saveVideoPosition(lessonId, seconds, Boolean(lesson.isCompleted))}
                              onEnded={(seconds) => void saveVideoPosition(lessonId, seconds, true)}
                            />
                          ) : (
                            <p className="mt-3 rounded-xl border border-dashed border-stroke bg-canvas px-4 py-3 text-sm text-ink-muted">
                              لا تتوفر بيانات فيديو لهذا الدرس حاليًا.
                            </p>
                          )}
                        </li>
                      )
                    })}
                  </ul>
                ) : (
                  <p className="mt-4 rounded-xl border border-dashed border-stroke-strong p-5 text-center text-sm text-ink-muted">
                    لا توجد دروس متاحة في هذه الدورة حتى الآن.
                  </p>
                )}
              </>
            )}
          </section>
        )}
        {activeQuizLesson && (
          <section className="rounded-xl border border-stroke bg-surface p-4">
            <h3 className="font-bold text-ink">
              اختبار الدرس {activeQuizLesson}
            </h3>
            <button
              type="button"
              onClick={() => {
                setActiveQuizLesson(null)

                setQuiz(null)

                setQuizError(null)
              }}
              className="mt-2 text-xs font-semibold text-nuwa-base hover:underline"
            >
              إغلاق الاختبار
            </button>
            {quizLoading && (
              <p className="mt-3 text-sm text-ink-muted">
                جارٍ تحميل الاختبار...
              </p>
            )}
            {quizError && (
              <div className="mt-3 rounded-lg border border-danger/20 bg-danger-light p-3">
                <p role="alert" className="text-sm text-danger">
                  {quizError}
                </p>
                <button
                  type="button"
                  onClick={() => void openQuiz(activeQuizLesson)}
                  className="mt-2 text-xs font-bold text-danger hover:underline"
                >
                  إعادة المحاولة
                </button>
              </div>
            )}
            {quiz &&
              (quizSubmitted ? (
                <div
                  role="status"
                  className="mt-3 rounded-xl border border-success/20 bg-success-light p-5"
                >
                  <p className="font-bold text-success">
                    تم تسجيل أنك أتممت هذا الاختبار.
                  </p>
                  <p className="mt-1 text-sm leading-6 text-ink">
                    المحاولة الواحدة المسموحة استُخدمت. لن تظهر الإجابات الصحيحة
                    أو الخاطئة أو الدرجة في حساب الطالب.
                  </p>
                </div>
              ) : (
                <form
                  onSubmit={(event) => void submitQuiz(event)}
                  className="mt-3 space-y-4"
                  noValidate
                >
                  <div className="rounded-xl bg-nuwa-ice p-4">
                    <p className="font-bold text-ink">
                      {String(quiz.title ?? "اختبار")}
                    </p>
                    {quiz.description !== undefined &&
                      quiz.description !== null &&
                      String(quiz.description).trim() && (
                        <p className="mt-1 text-sm leading-6 text-ink-muted">
                          {String(quiz.description)}
                        </p>
                      )}
                    <p className="mt-2 text-xs text-ink-muted">
                      {listFrom(quiz.questions).length} أسئلة · أجب عن كل سؤال
                      قبل التسليم
                    </p>
                    <p className="mt-1 text-xs text-ink-muted">
                      {quiz.passingScore !== undefined &&
                        `درجة النجاح: ${String(quiz.passingScore)} · `}
                      محاولة واحدة فقط
                    </p>
                  </div>
                  {listFrom(quiz.questions).length > 0 && (
                    <div className="rounded-xl border border-stroke bg-white p-4">
                      <div className="flex items-center justify-between gap-3 text-sm">
                        <span className="font-semibold text-ink">
                          تقدّم الإجابة
                        </span>
                        <span className="text-ink-muted">
                          {
                            listFrom(quiz.questions).filter(
                              (question) =>
                                (quizAnswers[String(question.id)] ?? [])
                                  .length > 0,
                            ).length
                          }{" "}
                          من {listFrom(quiz.questions).length}
                        </span>
                      </div>
                      <div
                        className="mt-2 h-2 overflow-hidden rounded-full bg-nuwa-soft"
                        role="progressbar"
                        aria-label="الأسئلة التي تمت الإجابة عنها"
                        aria-valuemin={0}
                        aria-valuemax={listFrom(quiz.questions).length}
                        aria-valuenow={
                          listFrom(quiz.questions).filter(
                            (question) =>
                              (quizAnswers[String(question.id)] ?? []).length >
                              0,
                          ).length
                        }
                      >
                        <div
                          className="h-full rounded-full bg-nuwa-base transition-[width]"
                          style={{
                            width: `${
                              (listFrom(quiz.questions).filter(
                                (question) =>
                                  (quizAnswers[String(question.id)] ?? [])
                                    .length > 0,
                              ).length /
                                listFrom(quiz.questions).length) *
                              100
                            }%`,
                          }}
                        />
                      </div>
                    </div>
                  )}
                  {listFrom(quiz.questions).map((question, index) => {
                    const multipleAnswers = allowsMultipleAnswers(question)

                    const options = listFrom(question.options)

                    const questionAnswers =
                      quizAnswers[String(question.id)] ?? []

                    return (
                      <fieldset
                        key={String(question.id ?? index)}
                        className="rounded-xl border border-stroke bg-white p-4 shadow-nuwa sm:p-5"
                      >
                        <legend className="max-w-full px-1 text-sm font-bold leading-6 text-ink sm:text-base">
                          <span className="me-1 text-nuwa-base">
                            {index + 1}.
                          </span>
                          {String(question.text ?? "سؤال")}
                        </legend>
                        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                          <p className="text-xs text-ink-muted">
                            {multipleAnswers
                              ? "يمكنك اختيار أكثر من إجابة."
                              : "اختر إجابة واحدة."}
                          </p>
                          <span
                            className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                              questionAnswers.length
                                ? "bg-success-light text-success"
                                : "bg-canvas text-ink-muted"
                            }`}
                          >
                            {questionAnswers.length
                              ? "تمت الإجابة"
                              : "لم تتم الإجابة"}
                          </span>
                        </div>
                        <div className="grid gap-2 sm:grid-cols-2">
                          {options.map((option, optionIndex) => (
                            <label
                              key={String(option.id ?? optionIndex)}
                              className={`flex min-h-12 cursor-pointer items-start gap-3 rounded-lg border border-stroke px-3 py-3 text-sm leading-6 text-ink transition hover:border-nuwa-base/50 hover:bg-nuwa-ice has-[:checked]:border-nuwa-base has-[:checked]:bg-nuwa-soft ${
                                quizSubmitted
                                  ? "cursor-not-allowed opacity-70"
                                  : ""
                              }`}
                            >
                              <input
                                type={multipleAnswers ? "checkbox" : "radio"}
                                name={`question-${String(question.id)}`}
                                value={String(option.id ?? "")}
                                checked={questionAnswers.includes(
                                  String(option.id ?? ""),
                                )}
                                onChange={() =>
                                  updateQuizAnswer(
                                    question,

                                    option.id,

                                    multipleAnswers,
                                  )
                                }
                                disabled={quizSubmitted}
                                className="mt-1 size-4 shrink-0 accent-nuwa-base"
                              />
                              <span>{String(option.text ?? "")}</span>
                            </label>
                          ))}
                        </div>
                        {!options.length && (
                          <p className="mt-2 text-sm text-danger">
                            لا توجد اختيارات متاحة لهذا السؤال.
                          </p>
                        )}
                      </fieldset>
                    )
                  })}
                  {quizValidationError && (
                    <p
                      role="alert"
                      className="rounded-lg border border-danger/20 bg-danger-light p-3 text-sm text-danger"
                    >
                      {quizValidationError}
                    </p>
                  )}
                  <button
                    disabled={
                      busy ||
                      quizSubmitted ||
                      listFrom(quiz.questions).length === 0 ||
                      listFrom(quiz.questions).some(
                        (question) => listFrom(question.options).length === 0,
                      )
                    }
                    className="min-h-11 w-full rounded-lg bg-nuwa-base px-4 py-2.5 text-sm font-bold text-white transition hover:bg-nuwa-deep disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
                  >
                    {busy
                      ? "جارٍ تسليم الاختبار..."
                      : quizSubmitted
                        ? "تم تسليم الاختبار"
                        : "تسليم الاختبار"}
                  </button>
                </form>
              ))}
          </section>
        )}
      </div>
    )
  }

  if (isAdmin && section === "profile") {
    const adminName =
      adminNameOverride ??
      String(
        record.name ??
          record.fullName ??
          window.sessionStorage.getItem("eduhub.auth.name") ??
          "مدير النظام",
      )
    const adminImage =
      profileImageOverride ??
      (profileImageSource(record) ||
        window.sessionStorage.getItem("eduhub.auth.image") ||
        "")
    return (
      <section className="mb-5 overflow-hidden rounded-3xl border border-emerald-900/10 bg-white shadow-[0_18px_55px_-35px_rgba(12,68,43,0.35)]">
        <div className="relative isolate overflow-hidden bg-gradient-to-l from-[#0b3b25] via-[#176b43] to-[#25845a] px-4 py-6 text-white sm:px-9 sm:py-8">
          <div
            aria-hidden="true"
            className="absolute -left-12 -top-24 -z-10 size-64 rounded-full border-[32px] border-white/10"
          />
          <div
            aria-hidden="true"
            className="absolute -bottom-28 right-1/3 -z-10 size-64 rounded-full border-[24px] border-white/10"
          />
          <div className="flex flex-wrap items-center gap-3 sm:gap-5">
            <PersonAvatar name={adminName} imageUrl={adminImage} size="lg" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-emerald-50/80">
                مساحة الإدارة
              </p>
              <h2 className="mt-1 truncate text-2xl font-bold sm:text-3xl">
                {adminName}
              </h2>
              <span className="mt-3 inline-flex rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold">
                مدير النظام
              </span>
            </div>
            <div className="w-full rounded-2xl border border-white/15 bg-white/10 p-4 text-sm text-emerald-50 backdrop-blur-sm sm:w-auto">
              بيانات حسابك الإدارية
            </div>
            <button
              type="button"
              onClick={() => setEditingAdminName((current) => !current)}
              className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full border border-white/60 bg-white/10 px-5 text-sm font-semibold text-white transition hover:bg-white/20 sm:w-auto"
            >
              <Pencil size={15} /> تعديل الاسم
            </button>
            <button
              type="button"
              onClick={() => setEditingProfile(true)}
              className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-white px-5 text-sm font-semibold text-emerald-900 shadow-sm transition hover:bg-emerald-50 sm:w-auto"
            >
              <Pencil size={15} /> تعديل الصورة الشخصية
            </button>
          </div>
        </div>
        <div className="grid min-w-0 gap-3 p-4 sm:grid-cols-2 sm:p-7">
          <div className="rounded-2xl bg-[#f3f8f5] p-4">
            <p className="text-xs font-medium text-ink-muted">الاسم الظاهر</p>
            <p className="mt-1 font-semibold text-ink">{adminName}</p>
          </div>
          <div className="rounded-2xl bg-[#f3f8f5] p-4">
            <p className="text-xs font-medium text-ink-muted">نوع الحساب</p>
            <p className="mt-1 font-semibold text-ink">مدير النظام</p>
          </div>
        </div>
        {editingAdminName && (
          <form
            onSubmit={(event) => void updateAdminName(event)}
            className="grid gap-3 border-t border-stroke p-4 sm:grid-cols-[1fr_auto_auto] sm:items-end sm:p-7"
          >
            <label className={labelClass}>
              الاسم الظاهر
              <input
                name="name"
                required
                defaultValue={adminName}
                className={fieldClass}
                autoComplete="name"
              />
            </label>
            <button
              type="button"
              onClick={() => setEditingAdminName(false)}
              disabled={busy}
              className="min-h-11 rounded-full border border-stroke px-5 text-sm font-semibold text-ink disabled:opacity-50"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={busy}
              className="min-h-11 rounded-full bg-gradient-to-l from-[#0b3b25] to-[#176b43] px-6 text-sm font-semibold text-white shadow-sm transition hover:brightness-110 disabled:opacity-50"
            >
              {busy ? "جارٍ الحفظ…" : "حفظ الاسم"}
            </button>
          </form>
        )}
        {editingProfile && (
          <div className="min-w-0 p-4 pt-0 sm:px-7 sm:pb-7">
            <ProfileImageEditor
              role="admin"
              name={adminName}
              imageUrl={adminImage}
              onFeedback={onFeedback}
              onImageChange={setProfileImageOverride}
              onSaved={onSaved}
            />
            <button
              type="button"
              onClick={() => setEditingProfile(false)}
              className="mt-3 min-h-10 rounded-full border border-emerald-900 px-4 text-sm font-semibold text-ink"
            >
              إغلاق
            </button>
          </div>
        )}
      </section>
    )
  }

  if (
    (isTeacher && section === "profile") ||
    (!isAdmin && !isTeacher && section === "profile")
  ) {
    const teacherYears = Array.isArray(record.academicYears)
      ? record.academicYears.map(String)
      : []

    const academicYearRecord = asRecord(record.academicYear)

    const studentAcademicYear =
      typeof record.academicYear === "object" && record.academicYear !== null
        ? (academicYearRecord.value ?? academicYearRecord.id ?? "")
        : (record.academicYear ?? "")

    const profileName = String(
      record.fullName ??
        [
          record.firstName,
          isTeacher ? record.lastName : record.secondName,
          ...(!isTeacher ? [record.thirdName] : []),
        ]
          .filter((part) => typeof part === "string" && part.trim())
          .join(" ") ??
        "حسابي",
    )
    const profileImage = profileImageOverride ?? profileImageSource(record)

    return (
      <div className="mb-5 grid gap-4">
        <section className="min-w-0 overflow-hidden rounded-3xl border border-stroke bg-white shadow-sm">
          <div className="relative isolate overflow-hidden px-4 py-6 text-ink sm:px-9 sm:py-7">
            <div
              aria-hidden="true"
              className="absolute -left-12 -top-24 -z-10 size-64 rounded-full border-[32px] border-emerald-900/5"
            />
            <div
              aria-hidden="true"
              className="absolute -bottom-28 right-1/3 -z-10 size-64 rounded-full border-[24px] border-emerald-900/5"
            />
            <div className="flex flex-wrap items-center gap-3 sm:gap-5">
              <PersonAvatar
                name={profileName}
                imageUrl={profileImage}
                size="lg"
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-ink-muted">
                  ملفي الشخصي
                </p>
                <h2 className="mt-1 truncate text-2xl font-bold sm:text-3xl">
                  {profileName}
                </h2>
                <p className="mt-1 truncate text-sm text-ink-muted">
                  {String(record.email ?? "بيانات الحساب التعليمية")}
                </p>
                <span className="mt-3 inline-flex rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-900">
                  {isTeacher ? "حساب معلم" : "حساب طالب"}
                </span>
              </div>
              <div className="w-full rounded-2xl bg-[#f3f8f5] px-4 py-3 text-sm font-medium text-ink-muted sm:w-auto">
                {String(
                  record.academicYearName ??
                    (isTeacher ? "ملف المعلم" : "الملف الدراسي"),
                )}
              </div>
              <button
                type="button"
                onClick={() => setEditingProfile(true)}
                className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-gradient-to-l from-[#0b3b25] to-[#176b43] px-5 text-sm font-semibold text-white shadow-sm transition hover:brightness-110 sm:w-auto"
              >
                <Pencil size={15} /> تعديل الملف الشخصي
              </button>
            </div>
          </div>
          <div className="grid min-w-0 gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4 sm:p-7">
            {[
              ["البريد الإلكتروني", record.email ?? "غير مضاف"],
              ["رقم الهاتف", record.phoneNumber ?? "غير مضاف"],
              [
                isTeacher ? "التخصص" : "الصف الدراسي",
                isTeacher
                  ? (record.specialization ?? record.subject ?? "غير محدد")
                  : (record.academicYearName ??
                    academicYearRecord.arabicName ??
                    studentAcademicYear ??
                    "غير محدد"),
              ],
              [
                "حالة الحساب",
                record.isApproved === false ? "بانتظار الاعتماد" : "نشط",
              ],
            ].map(([label, value]) => (
              <div key={String(label)} className="rounded-2xl bg-[#f3f8f5] p-4">
                <p className="text-xs font-medium text-ink-muted">
                  {String(label)}
                </p>
                <p className="mt-1 break-words font-semibold text-ink">
                  {String(value || "غير مضاف")}
                </p>
              </div>
            ))}
          </div>
        </section>
        {editingProfile && (
          <section className="min-w-0 rounded-3xl border border-stroke bg-white p-4 shadow-sm sm:p-7">
            <div className="mb-5">
              <h3 className="text-xl font-bold text-ink">الملف الشخصي</h3>
              <p className="mt-1 text-sm text-ink-muted">
                هذه هي البيانات التي تظهر في حسابك على المنصة.
              </p>
            </div>
            {isTeacher && (
              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {Object.entries(asRecord(wrapper.stats))

                  .filter(([, value]) =>
                    ["string", "number"].includes(typeof value),
                  )

                  .map(([key, value]) => (
                    <div key={key} className="rounded-lg bg-canvas p-3">
                      <p className="text-xs text-ink-muted">{key}</p>
                      <p className="mt-1 text-lg font-bold text-ink">
                        {String(value)}
                      </p>
                    </div>
                  ))}
              </div>
            )}
            <form
              ref={profileFormRef}
              onSubmit={(event) => void updateProfile(event)}
              className="mt-4 grid min-w-0 gap-3 sm:grid-cols-2 lg:grid-cols-3 [&>*]:min-w-0"
            >
              <label className={labelClass}>
                الاسم الأول
                <input
                  name="firstName"
                  required
                  defaultValue={String(record.firstName ?? "")}
                  className={fieldClass}
                />
              </label>
              <label className={labelClass}>
                البريد الإلكتروني
                <input
                  value={String(record.email ?? "")}
                  readOnly
                  className={`${fieldClass} bg-neutral-100 text-ink-muted`}
                />
              </label>
              <label className={labelClass}>
                نوع الحساب
                <input
                  value={isTeacher ? "معلم" : "طالب"}
                  readOnly
                  className={`${fieldClass} bg-neutral-100 text-ink-muted`}
                />
              </label>
              {isTeacher ? (
                <label className={labelClass}>
                  اسم العائلة
                  <input
                    name="lastName"
                    required
                    defaultValue={String(record.lastName ?? "")}
                    className={fieldClass}
                  />
                </label>
              ) : (
                <label className={labelClass}>
                  الاسم الثاني
                  <input
                    name="secondName"
                    required
                    defaultValue={String(record.secondName ?? "")}
                    className={fieldClass}
                  />
                </label>
              )}
              {isTeacher ? (
                <label className={labelClass}>
                  رقم الهاتف
                  <input
                    name="phoneNumber"
                    type="tel"
                    required
                    defaultValue={String(record.phoneNumber ?? "")}
                    className={fieldClass}
                  />
                </label>
              ) : (
                <label className={labelClass}>
                  الاسم الثالث
                  <input
                    name="thirdName"
                    required
                    defaultValue={String(record.thirdName ?? "")}
                    className={fieldClass}
                  />
                </label>
              )}
              {!isTeacher && (
                <label className={labelClass}>
                  رقم الهاتف
                  <input
                    name="phoneNumber"
                    type="tel"
                    required
                    defaultValue={String(record.phoneNumber ?? "")}
                    className={fieldClass}
                  />
                </label>
              )}
              {!isTeacher && (
                <label className={labelClass}>
                  هاتف ولي الأمر
                  <input
                    name="parentPhoneNumber"
                    type="tel"
                    required
                    defaultValue={String(record.parentPhoneNumber ?? "")}
                    className={fieldClass}
                  />
                </label>
              )}
              {isTeacher ? (
                <label className={labelClass}>
                  نبذة
                  <textarea
                    name="bio"
                    defaultValue={String(record.bio ?? "")}
                    rows={4}
                    className="w-full resize-y rounded-xl border border-stroke bg-[#f4f6f5] px-4 py-3 text-sm text-ink outline-none transition focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/10"
                  />
                </label>
              ) : (
                <label className={labelClass}>
                  الصف الدراسي
                  <select
                    name="academicYear"
                    required
                    defaultValue={String(studentAcademicYear)}
                    className={fieldClass}
                  >
                    {years.map((year) => (
                      <option key={year.id} value={year.value}>
                        {year.arabicName}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              {isTeacher && (
                <label className={labelClass}>
                  الصفوف التي تدرّسها
                  <select
                    name="academicYears"
                    multiple
                    required
                    defaultValue={teacherYears}
                    className="min-h-20 rounded-lg border border-stroke bg-white px-3 py-2 text-sm text-ink"
                  >
                    {years.map((year) => (
                      <option key={year.id} value={year.value}>
                        {year.arabicName}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <div className="flex flex-col-reverse items-stretch justify-end gap-2 border-t border-stroke pt-4 sm:col-span-2 sm:flex-row sm:items-center lg:col-span-3">
                <button
                  type="button"
                  onClick={() => {
                    profileFormRef.current?.reset()
                    setEditingProfile(false)
                  }}
                  disabled={busy}
                  className="min-h-11 rounded-full border border-emerald-900 px-5 text-sm font-semibold text-ink transition hover:bg-neutral-50 disabled:opacity-50"
                >
                  تراجع
                </button>
                <button
                  disabled={busy || !years.length}
                  className="min-h-11 rounded-full bg-gradient-to-l from-[#0b3b25] to-[#176b43] px-6 text-sm font-semibold text-white shadow-sm transition hover:brightness-110 disabled:opacity-50"
                >
                  {busy ? "جارٍ الحفظ…" : "حفظ التغييرات"}
                </button>
              </div>
            </form>
            <ProfileImageEditor
              role={isTeacher ? "teacher" : "student"}
              name={profileName}
              imageUrl={profileImage}
              busy={busy}
              onFeedback={onFeedback}
              onImageChange={setProfileImageOverride}
              onSaved={onSaved}
            />
          </section>
        )}
      </div>
    )
  }

  return null
}
