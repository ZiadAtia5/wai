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
  type ApiObject,
} from "../../api/endpoints"

import TeacherCourseContent from "./TeacherCourseContent"

type RecordValue = Record<string, unknown>

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

function listFrom(value: unknown): RecordValue[] {
  if (Array.isArray(value))
    return value.filter(
      (item): item is RecordValue => typeof item === "object" && item !== null,
    )

  const record = asRecord(value)

  return Array.isArray(record.items)
    ? record.items.filter(
        (item): item is RecordValue =>
          typeof item === "object" && item !== null,
      )
    : []
}

function enrollmentStatus(status: unknown, isApproved?: unknown) {
  const value = String(status ?? "").toLowerCase()

  if (/reject|declin|cancel/.test(value)) {
    return {
      label: "الطلب غير نشط",
      tone: "bg-danger-light text-danger",
      canLearn: false,
    }
  }
  if (isApproved === false || /pending|await|review/.test(value)) {
    return {
      label: "بانتظار موافقة المعلم",
      tone: "bg-amber-100 text-amber-800",
      canLearn: false,
    }
  }
  if (/complete|finish/.test(value)) {
    return {
      label: "مكتملة",
      tone: "bg-success-light text-success",
      canLearn: true,
    }
  }
  if (/approv|active|accept|enroll/.test(value)) {
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

  const attemptCount = Number(
    quiz.attemptCount ??
      quiz.submissionCount ??
      quiz.attemptsUsed ??
      quiz.myAttemptCount,
  )
  if (Number.isFinite(attemptCount) && attemptCount > 0) return true

  for (const key of ["myAttempts", "studentAttempts", "currentUserAttempts"]) {
    if (Array.isArray(quiz[key]) && quiz[key].length > 0) return true
  }

  const attempt = asRecord(
    quiz.myAttempt ??
      quiz.studentAttempt ??
      quiz.currentAttempt ??
      quiz.attempt,
  )
  return attempt.id !== undefined || attempt.attemptId !== undefined
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
  const [years, setYears] = useState<AcademicYearResponse[]>([])

  const [subjects, setSubjects] = useState<RecordValue[]>([])

  const [busy, setBusy] = useState(false)

  const [deletedCourseIds, setDeletedCourseIds] = useState<Set<string>>(
    () => new Set(),
  )

  const [publishedOverrides, setPublishedOverrides] =
    useState<Record<string, boolean>>({})

  const [editingCourse, setEditingCourse] = useState<RecordValue | null>(null)

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

  const wrapper = asRecord(data)

  const record = asRecord(wrapper.profile ?? listFrom(data)[0] ?? data)

  const isAdmin = role.includes("admin")

  const isTeacher = role.includes("teacher")

  const teacherCourses = listFrom(data).filter((course) => {
    const id = String(course.id ?? course.courseId ?? "")
    return id && !deletedCourseIds.has(id)
  })

  useEffect(() => {
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

    const formElement = event.currentTarget

    const form = new FormData(formElement)

    const body = {
      title: String(form.get("title") ?? "").trim(),

      description: String(form.get("description") ?? "").trim(),

      price: Number(form.get("price")),

      subjectId: Number(form.get("subjectId")),
    }

    const saved = await mutate(
      () => teachersApi.createCourse(body),
      "تم إنشاء الدورة.",
    )

    if (saved) formElement.reset()
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

      await mutate(() => teachersApi.updateMe(body), "تم تحديث الملف الشخصي.")
    } else {
      const body = {
        firstName: String(form.get("firstName") ?? "").trim(),

        secondName: String(form.get("secondName") ?? "").trim(),

        thirdName: String(form.get("thirdName") ?? "").trim(),

        phoneNumber: String(form.get("phoneNumber") ?? "").trim(),

        parentPhoneNumber: String(form.get("parentPhoneNumber") ?? "").trim(),

        academicYear,
      }

      await mutate(() => studentsApi.updateMe(body), "تم تحديث الملف الشخصي.")
    }
  }

  const openProgress = useCallback(async (courseId: string) => {
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
      setProgress(asRecord(await studentsApi.courseProgress(courseId)))
    } catch (cause) {
      setProgressError(
        cause instanceof Error ? cause.message : "تعذر تحميل تقدم الدورة.",
      )
    } finally {
      setProgressLoading(false)
    }
  }, [])

  async function toggleLesson(lesson: RecordValue) {
    const lessonId = lesson.lessonId ?? lesson.id

    if (lessonId === undefined) return

    const nextCompleted = !Boolean(lesson.isCompleted)

    const updated = await mutate(
      () =>
        studentsApi.updateLessonProgress(String(lessonId), {
          isCompleted: nextCompleted,

          lastPosition: Number(lesson.lastPosition ?? 0),
        }),

      nextCompleted ? "تم تسجيل إكمال الدرس." : "تم تحديث تقدم الدرس.",
    )

    if (updated && progressCourse) {
      try {
        setProgress(asRecord(await studentsApi.courseProgress(progressCourse)))
      } catch (cause) {
        onFeedback(
          cause instanceof Error
            ? cause.message
            : "تم تحديث الدرس لكن تعذر تحديث ملخص التقدم.",
        )
      }
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
      const response = asRecord(await quizzesApi.forLesson(lessonId))
      const loadedQuiz = asRecord(
        response.quiz ??
          asRecord(response.data).quiz ??
          response.data ??
          response,
      )
      setQuiz(loadedQuiz)
      setQuizSubmitted(
        (loadedQuiz.id !== undefined &&
          attemptedQuizIds.has(String(loadedQuiz.id))) ||
          hasSubmittedAttempt(loadedQuiz),
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
        {editingTeacher && (
          <form
            onSubmit={(event) => void updateTeacher(event)}
            className="grid gap-3 rounded-xl border border-nuwa-base/30 bg-nuwa-soft p-4 sm:grid-cols-2 lg:grid-cols-3"
          >
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
            <label className={labelClass}>
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
                className="min-h-20 rounded-lg border border-stroke bg-white px-3 py-2 text-sm text-ink"
              >
                {years.map((year) => (
                  <option key={year.id} value={year.value}>
                    {year.arabicName}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex items-end gap-2">
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
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {listFrom(data).map((teacher) => (
            <button
              type="button"
              key={String(teacher.id)}
              onClick={async () => {
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
              className="rounded-lg border border-stroke bg-white px-3 py-2 text-xs font-semibold text-ink"
            >
              تعديل: {String(teacher.fullName ?? teacher.email ?? teacher.id)}
            </button>
          ))}
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
          </div>
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
                placeholder="اكتب نبذة تساعد الطالب على معرفة محتوى الدورة"
                className="w-full resize-y rounded-lg border border-stroke bg-white px-3 py-2 text-sm text-ink"
              />
            </label>
            <label className={labelClass}>
              المادة
              <select
                name="subjectId"
                required
                className={fieldClass}
                defaultValue=""
              >
                <option value="" disabled>
                  {subjects.length ? "اختر المادة" : "لا توجد مواد متاحة"}
                </option>
                {subjects.map((subject) => (
                  <option key={String(subject.id)} value={String(subject.id)}>
                    {String(subject.name ?? subject.title ?? subject.id)}
                  </option>
                ))}
              </select>
            </label>
            <label className={labelClass}>
              السعر
              <input
                name="price"
                type="number"
                min="0"
                step="0.01"
                required
                defaultValue="0"
                className={fieldClass}
              />
            </label>
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
          <div className="grid items-start gap-4 md:grid-cols-2 2xl:grid-cols-3">
            {teacherCourses.map((course) => {
              const id = String(course.id ?? course.courseId ?? "")
              const isPublished =
                publishedOverrides[id] ?? course.isPublished === true
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
                  className="min-w-0 overflow-hidden rounded-2xl border border-stroke bg-white shadow-sm transition duration-200 hover:-translate-y-0.5 hover:border-nuwa-base/30 hover:shadow-nuwa-md"
                >
                  <div className="relative flex h-36 items-end overflow-hidden bg-gradient-to-br from-nuwa-deep via-nuwa-base to-sky-400 p-4">
                    {coverUrl ? (
                      <img
                        src={coverUrl}
                        alt=""
                        loading="lazy"
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
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-950/65 via-transparent to-transparent" />
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

                  <div className="space-y-4 p-4">
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
                          if (
                            !window.confirm(
                              "حذف الدورة نهائي ولا يمكن التراجع عنه. هل تريد المتابعة؟",
                            )
                          )
                            return

                          void mutate(async () => {
                            if (isPublished) {
                              await teachersApi.unpublishCourse(id)
                              setPublishedOverrides((current) => ({
                                ...current,
                                [id]: false,
                              }))
                            }
                            await teachersApi.deleteCourse(id)
                          }, "تم حذف الدورة نهائياً.").then((saved) => {
                            if (!saved) return
                            setDeletedCourseIds((current) => {
                              const next = new Set(current)
                              next.add(id)
                              return next
                            })
                            if (isEditing) setEditingCourse(null)
                            if (isShowingContent) setContentCourseId(null)
                          })
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
                              if (window.confirm("هل تريد حذف غلاف الدورة؟"))
                                void mutate(
                                  () => teachersApi.deleteCourseCover(id),
                                  "تم حذف غلاف الدورة.",
                                )
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
                        className="space-y-3 rounded-xl border border-nuwa-base/25 bg-nuwa-ice p-4"
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
                        <div className="grid grid-cols-2 gap-3">
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
        )}
      </div>
    )

  if (!isAdmin && !isTeacher && section === "courses") {
    const studentEnrollments = listFrom(data).filter(
      (enrollment) => !isRejectedEnrollment(enrollment),
    )
    const lessons = listFrom(progress?.lessons)
    const progressPercent = Number(progress?.progressPercentage ?? 0)
    const safeProgressPercent = Number.isFinite(progressPercent)
      ? Math.max(0, Math.min(100, progressPercent))
      : 0

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
                enrollment.status,
                enrollment.isApproved,
              )
              const rawProgress = Number(enrollment.progressPercentage ?? 0)
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
                        onClick={() => void openProgress(String(courseId))}
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
                  {String(progress?.completedLessons ?? 0)} من{" "}
                  {String(progress?.totalLessons ?? lessons.length)} درس ·{" "}
                  {Math.round(safeProgressPercent)}% مكتمل
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
                {lessons.length ? (
                  <ul className="mt-4 divide-y divide-stroke overflow-hidden rounded-xl border border-stroke px-4">
                    {lessons.map((lesson) => {
                      const lessonId = String(
                        lesson.lessonId ?? lesson.id ?? "",
                      )

                      return (
                        <li
                          key={lessonId}
                          className="flex flex-wrap items-center justify-between gap-3 py-3"
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

  if (
    (isTeacher && section === "overview") ||
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

    return (
      <details className="mb-5 rounded-xl border border-stroke bg-surface p-4">
        <summary className="cursor-pointer text-sm font-semibold text-nuwa-base">
          تعديل بيانات الملف الشخصي
        </summary>
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
          onSubmit={(event) => void updateProfile(event)}
          className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
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
              <input
                name="bio"
                defaultValue={String(record.bio ?? "")}
                className={fieldClass}
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
          <button
            disabled={busy || !years.length}
            className="rounded-lg bg-nuwa-base px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            حفظ الملف الشخصي
          </button>
        </form>
        {isTeacher && (
          <TeacherAvatarForm
            busy={busy}
            onFeedback={onFeedback}
            onSaved={onSaved}
          />
        )}
      </details>
    )
  }

  return null
}

function TeacherAvatarForm({
  busy,

  onFeedback,

  onSaved,
}: {
  busy: boolean

  onFeedback: (message: string) => void

  onSaved: () => void
}) {
  const [deleting, setDeleting] = useState(false)

  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const file = new FormData(event.currentTarget).get("file")

    if (!(file instanceof File) || !file.size) return

    onFeedback("")

    try {
      await teachersApi.uploadProfileImage(file)

      onFeedback("تم تحديث الصورة الشخصية.")

      onSaved()
    } catch (cause) {
      onFeedback(cause instanceof Error ? cause.message : "تعذر رفع الصورة.")
    }
  }

  async function remove() {
    if (!window.confirm("هل تريد حذف الصورة الشخصية؟")) return

    setDeleting(true)

    onFeedback("")

    try {
      await teachersApi.deleteProfileImage()

      onFeedback("تم حذف الصورة الشخصية.")

      onSaved()
    } catch (cause) {
      onFeedback(cause instanceof Error ? cause.message : "تعذر حذف الصورة.")
    } finally {
      setDeleting(false)
    }
  }

  return (
    <form
      onSubmit={(event) => void upload(event)}
      className="mt-4 flex flex-wrap items-end gap-3 border-t border-stroke pt-4"
    >
      <label className={labelClass}>
        الصورة الشخصية
        <input
          name="file"
          type="file"
          accept="image/*"
          required
          className="max-w-full text-sm"
        />
      </label>
      <button
        disabled={busy || deleting}
        className="rounded-lg border border-stroke px-4 py-2 text-sm font-semibold text-ink disabled:opacity-50"
      >
        رفع الصورة
      </button>
      <button
        type="button"
        disabled={busy || deleting}
        onClick={() => void remove()}
        className="rounded-lg px-4 py-2 text-sm font-semibold text-danger disabled:opacity-50"
      >
        حذف الصورة
      </button>
    </form>
  )
}
