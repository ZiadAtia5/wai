import { useCallback, useEffect, useState, type FormEvent } from "react"

import { getAcademicYears, type AcademicYearResponse } from "../../api/catalog"
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

const fieldClass =
  "h-10 w-full rounded-lg border border-stroke bg-white px-3 text-sm text-ink"
const labelClass = "grid gap-1 text-xs font-semibold text-ink-muted"

export default function RoleForms({
  role,
  section,
  data,
  onSaved,
  onFeedback,
}: RoleFormsProps) {
  const [years, setYears] = useState<AcademicYearResponse[]>([])
  const [subjects, setSubjects] = useState<RecordValue[]>([])
  const [busy, setBusy] = useState(false)
  const [editingCourse, setEditingCourse] = useState<RecordValue | null>(null)
  const [editingTeacher, setEditingTeacher] = useState<RecordValue | null>(null)
  const [contentCourseId, setContentCourseId] = useState<string | null>(null)
  const [progressCourse, setProgressCourse] = useState<string | null>(null)
  const [progress, setProgress] = useState<RecordValue | null>(null)
  const [activeQuizLesson, setActiveQuizLesson] = useState<string | null>(null)
  const [quiz, setQuiz] = useState<RecordValue | null>(null)
  const wrapper = asRecord(data)
  const record = asRecord(wrapper.profile ?? listFrom(data)[0] ?? data)
  const isAdmin = role.includes("admin")
  const isTeacher = role.includes("teacher")

  useEffect(() => {
    if (!isAdmin && !isTeacher) return
    let active = true
    getAcademicYears()
      .then((result) => {
        if (active) setYears(result)
      })
      .catch(() => undefined)
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
  }, [isAdmin, isTeacher, section])

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
    await mutate(() => teachersApi.createCourse(body), "تم إنشاء الدورة.")
    formElement.reset()
  }

  async function updateCourse(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (editingCourse?.id === undefined) return
    const form = new FormData(event.currentTarget)
    const body = {
      title: String(form.get("title") ?? "").trim(),
      description: String(form.get("description") ?? "").trim(),
      price: Number(form.get("price")),
      subjectId: Number(form.get("subjectId")),
    }
    await mutate(
      () => teachersApi.updateCourse(String(editingCourse.id), body),
      "تم تحديث الدورة.",
    )
    setEditingCourse(null)
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

  async function openProgress(courseId: string) {
    setProgressCourse(courseId)
    setProgress(null)
    setActiveQuizLesson(null)
    setQuiz(null)
    try {
      setProgress(asRecord(await studentsApi.courseProgress(courseId)))
    } catch (cause) {
      onFeedback(
        cause instanceof Error ? cause.message : "تعذر تحميل تقدم الدورة.",
      )
    }
  }

  async function toggleLesson(lesson: RecordValue) {
    const lessonId = lesson.lessonId ?? lesson.id
    if (lessonId === undefined) return
    const nextCompleted = !Boolean(lesson.isCompleted)
    await mutate(
      () =>
        studentsApi.updateLessonProgress(String(lessonId), {
          isCompleted: nextCompleted,
          lastPosition: Number(lesson.lastPosition ?? 0),
        }),
      nextCompleted ? "تم تسجيل إكمال الدرس." : "تم تحديث تقدم الدرس.",
    )
    if (progressCourse) {
      try {
        setProgress(asRecord(await studentsApi.courseProgress(progressCourse)))
      } catch {
        /* The mutation response already reports failures. */
      }
    }
  }

  async function openQuiz(lessonId: string) {
    setActiveQuizLesson(lessonId)
    setQuiz(null)
    try {
      setQuiz(asRecord(await quizzesApi.forLesson(lessonId)))
    } catch (cause) {
      onFeedback(
        cause instanceof Error ? cause.message : "لا يتوفر اختبار لهذا الدرس.",
      )
    }
  }

  async function submitQuiz(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!quiz || quiz.id === undefined) return
    const form = new FormData(event.currentTarget)
    const answers = listFrom(quiz.questions).map((question) => ({
      questionId: Number(question.id),
      selectedOptionIds: form.getAll(`question-${question.id}`).map(Number),
    }))
    await mutate(
      () => quizzesApi.submitAttempt(String(quiz.id), { answers }),
      "تم تسليم إجابات الاختبار.",
    )
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

  if (isTeacher && section === "courses")
    return (
      <div className="mb-5 space-y-4">
        <form
          onSubmit={(event) => void createCourse(event)}
          className="grid gap-3 rounded-xl border border-stroke bg-surface p-4 sm:grid-cols-2 lg:grid-cols-4"
        >
          <label className={labelClass}>
            عنوان الدورة
            <input name="title" required className={fieldClass} />
          </label>
          <label className={labelClass}>
            الوصف
            <input name="description" required className={fieldClass} />
          </label>
          <label className={labelClass}>
            السعر
            <input
              name="price"
              type="number"
              min="0"
              step="0.01"
              required
              className={fieldClass}
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
          <button
            disabled={busy || !subjects.length}
            className="rounded-lg bg-nuwa-base px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            إنشاء دورة
          </button>
        </form>
        {editingCourse && (
          <form
            onSubmit={(event) => void updateCourse(event)}
            className="grid gap-3 rounded-xl border border-nuwa-base/30 bg-nuwa-soft p-4 sm:grid-cols-2 lg:grid-cols-4"
          >
            <label className={labelClass}>
              العنوان
              <input
                name="title"
                required
                defaultValue={String(editingCourse.title ?? "")}
                className={fieldClass}
              />
            </label>
            <label className={labelClass}>
              الوصف
              <input
                name="description"
                required
                defaultValue={String(editingCourse.description ?? "")}
                className={fieldClass}
              />
            </label>
            <label className={labelClass}>
              السعر
              <input
                name="price"
                type="number"
                min="0"
                step="0.01"
                required
                defaultValue={String(editingCourse.price ?? 0)}
                className={fieldClass}
              />
            </label>
            <label className={labelClass}>
              المادة
              <select
                name="subjectId"
                required
                defaultValue={String(editingCourse.subjectId ?? "")}
                className={fieldClass}
              >
                {subjects.map((subject) => (
                  <option key={String(subject.id)} value={String(subject.id)}>
                    {String(subject.name ?? subject.title ?? subject.id)}
                  </option>
                ))}
              </select>
            </label>
            <button
              disabled={busy}
              className="rounded-lg bg-nuwa-base px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
            >
              حفظ الدورة
            </button>
            <button
              type="button"
              onClick={() => setEditingCourse(null)}
              className="rounded-lg border border-stroke px-4 py-2.5 text-sm"
            >
              إلغاء
            </button>
          </form>
        )}
        <div className="flex flex-wrap gap-2">
          {listFrom(data).map((course) => {
            const id = String(course.id)
            return (
              <article
                key={id}
                className="flex min-w-0 flex-col items-stretch gap-3 rounded-2xl border border-stroke bg-white p-4 shadow-sm transition hover:shadow-nuwa"
              >
                <span className="px-2 text-xs font-semibold text-ink">
                  {String(course.title ?? id)}
                </span>
                <button
                  type="button"
                  onClick={() => setEditingCourse(course)}
                  className="rounded-lg border border-stroke px-3 py-2 text-xs font-semibold text-ink"
                >
                  تعديل
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setContentCourseId(contentCourseId === id ? null : id)
                  }
                  className="rounded-lg bg-nuwa-soft px-3 py-2 text-xs font-semibold text-nuwa-base"
                >
                  {contentCourseId === id ? "إغلاق المحتوى" : "الوحدات والدروس"}
                </button>
                <details className="rounded-xl border border-slate-200">
                  <summary className="cursor-pointer px-3 py-2.5 text-xs font-semibold text-ink-muted">
                    خيارات إضافية
                  </summary>
                  <div className="grid gap-2 border-t border-slate-100 p-3">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        void mutate(
                          () => teachersApi.publishCourse(id),
                          "تم نشر الدورة.",
                        )
                      }
                      className="rounded-lg bg-nuwa-base px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
                    >
                      نشر
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        void mutate(
                          () => teachersApi.unpublishCourse(id),
                          "تم إلغاء نشر الدورة.",
                        )
                      }
                      className="rounded-lg border border-stroke px-3 py-2 text-xs font-semibold text-ink disabled:opacity-50"
                    >
                      إلغاء النشر
                    </button>
                    <form
                      onSubmit={(event) => void uploadCover(id, event)}
                      className="flex items-center gap-2"
                    >
                      <input
                        name="file"
                        type="file"
                        accept="image/*"
                        required
                        aria-label="غلاف الدورة"
                        className="max-w-44 text-xs"
                      />
                      <button
                        disabled={busy}
                        className="rounded-lg border border-stroke px-3 py-2 text-xs font-semibold text-ink disabled:opacity-50"
                      >
                        رفع غلاف
                      </button>
                    </form>
                    {Boolean(course.coverImageUrl) && (
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
                        className="rounded-lg px-3 py-2 text-xs font-semibold text-danger disabled:opacity-50"
                      >
                        حذف الغلاف
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        if (
                          window.confirm(
                            "حذف الدورة لا يمكن التراجع عنه. هل تريد المتابعة؟",
                          )
                        )
                          void mutate(
                            () => teachersApi.deleteCourse(id),
                            "تم حذف الدورة.",
                          )
                      }}
                      className="rounded-lg px-3 py-2 text-xs font-semibold text-danger disabled:opacity-50"
                    >
                      حذف الدورة
                    </button>
                  </div>
                </details>
              </article>
            )
          })}
        </div>
        {contentCourseId && (
          <TeacherCourseContent
            courseId={contentCourseId}
            onChanged={onSaved}
            onFeedback={onFeedback}
          />
        )}
      </div>
    )

  if (!isAdmin && !isTeacher && section === "courses") {
    const lessons = listFrom(progress?.lessons)
    return (
      <div className="mb-5 space-y-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {listFrom(data).map((enrollment) => (
            <article
              key={String(enrollment.id)}
              className="rounded-xl border border-stroke bg-surface p-4"
            >
              <h3 className="font-semibold text-ink">
                {String(
                  enrollment.courseTitle ??
                    enrollment.courseName ??
                    `دورة ${enrollment.courseId ?? ""}`,
                )}
              </h3>
              <p className="mt-1 text-xs text-ink-muted">
                الحالة: {String(enrollment.status ?? "—")} · الإنجاز:{" "}
                {String(enrollment.progressPercentage ?? 0)}%
              </p>
              <button
                type="button"
                disabled={enrollment.courseId === undefined}
                onClick={() => void openProgress(String(enrollment.courseId))}
                className="mt-3 rounded-lg border border-stroke px-3 py-2 text-xs font-semibold text-nuwa-base disabled:opacity-50"
              >
                عرض التقدم
              </button>
            </article>
          ))}
        </div>
        {progressCourse && (
          <section className="rounded-xl border border-stroke bg-surface p-4">
            <h3 className="text-lg font-bold text-ink">تقدم الدورة</h3>
            {!progress && (
              <p className="mt-3 text-sm text-ink-muted">جارٍ تحميل الدروس...</p>
            )}
            {progress && (
              <>
                <p className="mt-1 text-sm text-ink-muted">
                  {String(progress.completedLessons ?? 0)} من{" "}
                  {String(progress.totalLessons ?? lessons.length)} درس ·{" "}
                  {String(progress.progressPercentage ?? 0)}%
                </p>
                <ul className="mt-4 divide-y divide-stroke">
                  {lessons.map((lesson) => {
                    const lessonId = String(lesson.lessonId ?? lesson.id ?? "")
                    return (
                      <li
                        key={lessonId}
                        className="flex flex-wrap items-center justify-between gap-3 py-3"
                      >
                        <span className="text-sm text-ink">
                          درس {lessonId} {lesson.isCompleted ? "· مكتمل" : ""}
                        </span>
                        <div className="flex gap-2">
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
                            className="rounded-lg bg-nuwa-soft px-3 py-2 text-xs font-semibold text-nuwa-base"
                          >
                            فتح الاختبار
                          </button>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              </>
            )}
          </section>
        )}
        {activeQuizLesson && (
          <section className="rounded-xl border border-stroke bg-surface p-4">
            <h3 className="font-bold text-ink">
              اختبار الدرس {activeQuizLesson}
            </h3>
            {!quiz && (
              <p className="mt-3 text-sm text-ink-muted">
                جارٍ تحميل الاختبار...
              </p>
            )}
            {quiz && (
              <form
                onSubmit={(event) => void submitQuiz(event)}
                className="mt-3 space-y-4"
              >
                <p className="text-sm text-ink-muted">
                  {String(quiz.title ?? "اختبار")}
                </p>
                {listFrom(quiz.questions).map((question) => (
                  <fieldset
                    key={String(question.id)}
                    className="rounded-lg border border-stroke p-3"
                  >
                    <legend className="px-1 text-sm font-semibold text-ink">
                      {String(question.text ?? "")}
                    </legend>
                    <div className="mt-2 grid gap-2">
                      {listFrom(question.options).map((option) => (
                        <label
                          key={String(option.id)}
                          className="flex items-start gap-2 text-sm text-ink"
                        >
                          <input
                            type="checkbox"
                            name={`question-${question.id}`}
                            value={String(option.id)}
                            className="mt-1"
                          />
                          <span>{String(option.text ?? "")}</span>
                        </label>
                      ))}
                    </div>
                  </fieldset>
                ))}
                <button
                  disabled={busy}
                  className="rounded-lg bg-nuwa-base px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
                >
                  تسليم الاختبار
                </button>
              </form>
            )}
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
                defaultValue={String(record.academicYear ?? "")}
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
