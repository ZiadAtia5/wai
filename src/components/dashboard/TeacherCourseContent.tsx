import { useEffect, useState, type FormEvent } from "react"

import { ApiError } from "../../api/client"
import { quizzesApi, teachersApi } from "../../api/endpoints"

type DataRecord = Record<string, unknown>

function record(value: unknown): DataRecord {
  return typeof value === "object" && value !== null ? value as DataRecord : {}
}

function records(value: unknown): DataRecord[] {
  if (!Array.isArray(value)) return []
  return value.filter(
    (item): item is DataRecord => typeof item === "object" && item !== null,
  )
}

const control =
  "h-10 w-full rounded-lg border border-stroke bg-white px-3 text-sm text-ink"
const field = "grid gap-1 text-xs font-semibold text-ink-muted"

export default function TeacherCourseContent({
  courseId,
  onChanged,
  onFeedback,
}: {
  courseId: string
  onChanged: () => void
  onFeedback: (message: string) => void
}) {
  const [reload, setReload] = useState(0)
  const [course, setCourse] = useState<DataRecord | null>(null)
  const [busy, setBusy] = useState(false)
  const [quizLessonId, setQuizLessonId] = useState<string | null>(null)
  const [quiz, setQuiz] = useState<DataRecord | null>(null)
  const [quizMissing, setQuizMissing] = useState(false)
  const [addingQuestion, setAddingQuestion] = useState(false)
  const [attempts, setAttempts] = useState<DataRecord[] | null>(null)

  useEffect(() => {
    let active = true
    setCourse(null)
    teachersApi
      .course(courseId)
      .then((result) => {
        if (active) setCourse(record(result))
      })
      .catch((cause: unknown) => {
        if (active)
          onFeedback(
            cause instanceof Error ? cause.message : "تعذر تحميل محتوى الدورة.",
          )
      })
    return () => {
      active = false
    }
  }, [courseId, reload, onFeedback])

  async function mutate(
    request: () => Promise<unknown>,
    message: string,
  ): Promise<boolean> {
    if (busy) return false
    setBusy(true)
    onFeedback("")
    try {
      await request()
      onFeedback(message)
      setReload((value) => value + 1)
      onChanged()
      return true
    } catch (cause) {
      onFeedback(cause instanceof Error ? cause.message : "تعذر حفظ التغييرات.")
      return false
    } finally {
      setBusy(false)
    }
  }

  async function createModule(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const formElement = event.currentTarget
    const form = new FormData(formElement)
    const body = {
      title: String(form.get("title") ?? "").trim(),
      order: Number(form.get("order")),
    }
    await mutate(
      () => teachersApi.createModule(courseId, body),
      "تمت إضافة الوحدة.",
    )
    formElement.reset()
  }

  async function createLesson(
    moduleId: string,
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault()
    const formElement = event.currentTarget
    const form = new FormData(formElement)
    const body = {
      title: String(form.get("title") ?? "").trim(),
      description: String(form.get("description") ?? "").trim(),
      order: Number(form.get("order")),
    }
    await mutate(
      () => teachersApi.createLesson(moduleId, body),
      "تمت إضافة الدرس.",
    )
    formElement.reset()
  }

  async function updateModule(
    moduleId: string,
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault()
    const title = String(
      new FormData(event.currentTarget).get("title") ?? "",
    ).trim()
    await mutate(
      () => teachersApi.updateModule(moduleId, { title }),
      "تم تحديث الوحدة.",
    )
  }

  async function updateLesson(
    lessonId: string,
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const body = {
      title: String(form.get("title") ?? "").trim(),
      description: String(form.get("description") ?? "").trim(),
    }
    await mutate(
      () => teachersApi.updateLesson(lessonId, body),
      "تم تحديث الدرس.",
    )
  }

  async function openQuiz(lessonId: string) {
    setQuizLessonId(lessonId)
    setQuiz(null)
    setQuizMissing(false)
    try {
      setQuiz(record(await quizzesApi.forLesson(lessonId)))
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 404)
        setQuizMissing(true)
      else
        onFeedback(
          cause instanceof Error ? cause.message : "تعذر تحميل الاختبار.",
        )
    }
  }

  async function createQuiz(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!quizLessonId) return
    const form = new FormData(event.currentTarget)
    const body = {
      title: String(form.get("title") ?? "").trim(),
      description: String(form.get("description") ?? "").trim(),
      passingScore: Number(form.get("passingScore")),
      maxAttempts: Number(form.get("maxAttempts")),
    }
    if (
      await mutate(
        () => quizzesApi.createForLesson(quizLessonId, body),
        "تم إنشاء الاختبار.",
      )
    ) {
      await openQuiz(quizLessonId)
    }
  }

  async function updateQuiz(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!quiz || quiz.id === undefined) return
    const form = new FormData(event.currentTarget)
    const body = {
      title: String(form.get("title") ?? "").trim(),
      description: String(form.get("description") ?? "").trim(),
      passingScore: Number(form.get("passingScore")),
      maxAttempts: Number(form.get("maxAttempts")),
    }
    if (
      await mutate(
        () => quizzesApi.update(String(quiz.id), body),
        "تم تحديث الاختبار.",
      )
    ) {
      await openQuiz(String(quizLessonId))
    }
  }

  async function addQuestion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!quiz || quiz.id === undefined) return
    const form = new FormData(event.currentTarget)
    const body = {
      text: String(form.get("text") ?? "").trim(),
      type: Number(form.get("type")),
      points: Number(form.get("points")),
      order: Number(form.get("order")),
    }
    if (
      await mutate(
        () => quizzesApi.addQuestion(String(quiz.id), body),
        "تمت إضافة السؤال.",
      )
    ) {
      setAddingQuestion(false)
      await openQuiz(String(quizLessonId))
    }
  }

  async function addOption(
    questionId: string,
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const body = {
      text: String(form.get("text") ?? "").trim(),
      isCorrect: form.get("isCorrect") === "on",
      order: Number(form.get("order")),
    }
    if (
      await mutate(
        () => quizzesApi.addOption(questionId, body),
        "تمت إضافة الاختيار.",
      )
    ) {
      await openQuiz(String(quizLessonId))
    }
  }

  async function moveModule(
    modules: DataRecord[],
    index: number,
    offset: number,
  ) {
    const target = index + offset
    if (target < 0 || target >= modules.length) return
    const reordered = [...modules]
    ;[reordered[index], reordered[target]] = [
      reordered[target],
      reordered[index],
    ]
    await mutate(
      () =>
        teachersApi.reorderModules(courseId, {
          orderedIds: reordered.map((item) => Number(item.id)),
        }),
      "تم تحديث ترتيب الوحدات.",
    )
  }

  async function moveLesson(
    moduleId: string,
    lessons: DataRecord[],
    index: number,
    offset: number,
  ) {
    const target = index + offset
    if (target < 0 || target >= lessons.length) return
    const reordered = [...lessons]
    ;[reordered[index], reordered[target]] = [
      reordered[target],
      reordered[index],
    ]
    await mutate(
      () =>
        teachersApi.reorderLessons(moduleId, {
          orderedIds: reordered.map((item) => Number(item.id)),
        }),
      "تم تحديث ترتيب الدروس.",
    )
  }

  async function moveQuestion(
    questions: DataRecord[],
    quizId: string,
    index: number,
    offset: number,
  ) {
    const target = index + offset
    if (target < 0 || target >= questions.length) return
    const reordered = [...questions]
    ;[reordered[index], reordered[target]] = [
      reordered[target],
      reordered[index],
    ]
    if (
      await mutate(
        () =>
          quizzesApi.reorderQuestions(quizId, {
            orderedIds: reordered.map((item) => Number(item.id)),
          }),
        "تم تحديث ترتيب الأسئلة.",
      )
    ) {
      await openQuiz(String(quizLessonId))
    }
  }

  async function updateQuestion(questionId: string, body: DataRecord) {
    if (
      await mutate(
        () => quizzesApi.updateQuestion(questionId, body),
        "تم تحديث السؤال.",
      )
    )
      await openQuiz(String(quizLessonId))
  }

  async function updateOption(optionId: string, body: DataRecord) {
    if (
      await mutate(
        () => quizzesApi.updateOption(optionId, body),
        "تم تحديث الاختيار.",
      )
    )
      await openQuiz(String(quizLessonId))
  }

  async function removeQuestion(questionId: string) {
    if (
      await mutate(
        () => quizzesApi.deleteQuestion(questionId),
        "تم حذف السؤال.",
      )
    )
      await openQuiz(String(quizLessonId))
  }

  async function removeOption(optionId: string) {
    if (
      await mutate(() => quizzesApi.deleteOption(optionId), "تم حذف الاختيار.")
    )
      await openQuiz(String(quizLessonId))
  }

  async function loadAttempts() {
    if (!quiz || quiz.id === undefined) return
    try {
      const result = await quizzesApi.attempts(String(quiz.id))
      setAttempts(
        Array.isArray(result) ? records(result) : records(record(result).items),
      )
    } catch (cause) {
      onFeedback(
        cause instanceof Error ? cause.message : "تعذر تحميل المحاولات.",
      )
    }
  }

  async function toggleQuizPublish() {
    if (!quiz || quiz.id === undefined) return
    const publish = !Boolean(quiz.isPublished)
    if (
      await mutate(
        () =>
          publish
            ? quizzesApi.publish(String(quiz.id))
            : quizzesApi.unpublish(String(quiz.id)),
        publish ? "تم نشر الاختبار." : "تم إلغاء نشر الاختبار.",
      )
    ) {
      await openQuiz(String(quizLessonId))
    }
  }

  if (!course)
    return (
      <p className="rounded-xl border border-stroke bg-white p-4 text-sm text-ink-muted">
        جارٍ تحميل محتوى الدورة...
      </p>
    )

  const modules = records(course.modules)
  return (
    <section className="mt-4 rounded-xl border border-nuwa-base/25 bg-nuwa-ice p-4">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-base font-bold text-ink">
          محتوى: {String(course.title ?? `الدورة ${courseId}`)}
        </h3>
        <span className="text-xs text-ink-muted">{modules.length} وحدة</span>
      </div>
      <form
        onSubmit={(event) => void createModule(event)}
        className="mb-4 grid gap-3 rounded-lg border border-stroke bg-white p-3 sm:grid-cols-[1fr_140px_auto] sm:items-end"
      >
        <label className={field}>
          عنوان الوحدة
          <input name="title" required className={control} />
        </label>
        <label className={field}>
          الترتيب
          <input
            name="order"
            type="number"
            min="1"
            required
            className={control}
          />
        </label>
        <button
          disabled={busy}
          className="h-10 rounded-lg bg-nuwa-base px-4 text-sm font-semibold text-white disabled:opacity-50"
        >
          إضافة وحدة
        </button>
      </form>
      {modules.length === 0 ? (
        <p className="rounded-lg bg-white p-4 text-sm text-ink-muted">
          لا توجد وحدات بعد. أضف أول وحدة للبدء.
        </p>
      ) : (
        <div className="space-y-3">
          {modules.map((module, moduleIndex) => {
            const moduleId = String(module.id)
            const lessons = records(module.lessons)
            return (
              <article
                key={moduleId}
                className="rounded-lg border border-stroke bg-white p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex gap-1">
                    <button
                      type="button"
                      disabled={busy || moduleIndex === 0}
                      aria-label="رفع ترتيب الوحدة"
                      onClick={() => void moveModule(modules, moduleIndex, -1)}
                      className="rounded border border-stroke px-2 py-1 text-xs disabled:opacity-40"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      disabled={busy || moduleIndex === modules.length - 1}
                      aria-label="خفض ترتيب الوحدة"
                      onClick={() => void moveModule(modules, moduleIndex, 1)}
                      className="rounded border border-stroke px-2 py-1 text-xs disabled:opacity-40"
                    >
                      ↓
                    </button>
                  </div>
                  <form
                    onSubmit={(event) => void updateModule(moduleId, event)}
                    className="flex min-w-0 flex-1 gap-2"
                  >
                    <input
                      name="title"
                      required
                      defaultValue={String(module.title ?? "")}
                      aria-label="عنوان الوحدة"
                      className={control}
                    />
                    <button
                      disabled={busy}
                      className="shrink-0 rounded-lg border border-stroke px-3 text-xs font-semibold text-ink disabled:opacity-50"
                    >
                      حفظ الاسم
                    </button>
                  </form>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      if (
                        window.confirm(
                          "حذف الوحدة سيحذف محتواها أيضاً. هل تريد المتابعة؟",
                        )
                      ) {
                        void mutate(
                          () => teachersApi.deleteModule(moduleId),
                          "تم حذف الوحدة.",
                        )
                      }
                    }}
                    className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-xs font-semibold text-danger disabled:opacity-50"
                  >
                    حذف الوحدة
                  </button>
                </div>
                <ul className="mt-3 divide-y divide-stroke">
                  {lessons.map((lesson, lessonIndex) => {
                    const lessonId = String(lesson.id)
                    const video = record(lesson.video)
                    const resources = records(lesson.resources)
                    return (
                      <li key={lessonId} className="py-3">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="flex gap-1">
                            <button
                              type="button"
                              disabled={busy || lessonIndex === 0}
                              aria-label="رفع ترتيب الدرس"
                              onClick={() =>
                                void moveLesson(
                                  moduleId,
                                  lessons,
                                  lessonIndex,
                                  -1,
                                )
                              }
                              className="rounded border border-stroke px-2 py-1 text-xs disabled:opacity-40"
                            >
                              ↑
                            </button>
                            <button
                              type="button"
                              disabled={
                                busy || lessonIndex === lessons.length - 1
                              }
                              aria-label="خفض ترتيب الدرس"
                              onClick={() =>
                                void moveLesson(
                                  moduleId,
                                  lessons,
                                  lessonIndex,
                                  1,
                                )
                              }
                              className="rounded border border-stroke px-2 py-1 text-xs disabled:opacity-40"
                            >
                              ↓
                            </button>
                          </div>
                          <form
                            onSubmit={(event) =>
                              void updateLesson(lessonId, event)
                            }
                            className="grid min-w-0 flex-1 gap-2 sm:grid-cols-[1fr_1.4fr_auto]"
                          >
                            <input
                              name="title"
                              required
                              defaultValue={String(lesson.title ?? "")}
                              aria-label="عنوان الدرس"
                              className={control}
                            />
                            <input
                              name="description"
                              defaultValue={String(lesson.description ?? "")}
                              aria-label="وصف الدرس"
                              className={control}
                            />
                            <button
                              disabled={busy}
                              className="rounded-lg border border-stroke px-3 text-xs font-semibold text-ink disabled:opacity-50"
                            >
                              حفظ الدرس
                            </button>
                          </form>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => {
                              if (window.confirm("هل تريد حذف هذا الدرس؟"))
                                void mutate(
                                  () => teachersApi.deleteLesson(lessonId),
                                  "تم حذف الدرس.",
                                )
                            }}
                            className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-xs font-semibold text-danger disabled:opacity-50"
                          >
                            حذف الدرس
                          </button>
                        </div>
                        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-ink-muted">
                          {Boolean(video.videoUrl) && (
                            <a
                              href={String(video.videoUrl)}
                              target="_blank"
                              rel="noreferrer"
                              className="text-nuwa-base underline"
                            >
                              عرض الفيديو الحالي
                            </a>
                          )}
                          {resources.map((resource) => (
                            <span
                              key={String(resource.id)}
                              className="inline-flex items-center gap-1 rounded bg-canvas px-2 py-1"
                            >
                              {String(resource.name ?? "مورد")}
                              <button
                                type="button"
                                aria-label="حذف المورد"
                                onClick={() => {
                                  if (window.confirm("هل تريد حذف هذا المورد؟"))
                                    void mutate(
                                      () =>
                                        teachersApi.deleteResource(
                                          String(resource.id),
                                        ),
                                      "تم حذف المورد.",
                                    )
                                }}
                                className="text-danger"
                              >
                                ×
                              </button>
                            </span>
                          ))}
                        </div>
                        <div className="mt-3 grid gap-3 lg:grid-cols-2">
                          <form
                            onSubmit={(event) => {
                              event.preventDefault()
                              const file = new FormData(
                                event.currentTarget,
                              ).get("file")
                              if (file instanceof File && file.size)
                                void mutate(
                                  () =>
                                    teachersApi.uploadLessonVideo(
                                      lessonId,
                                      file,
                                    ),
                                  "تم رفع فيديو الدرس.",
                                )
                            }}
                            className="flex flex-wrap items-end gap-2 rounded-lg bg-canvas p-3"
                          >
                            <label className={field}>
                              رفع ملف فيديو
                              <input
                                name="file"
                                type="file"
                                accept="video/*"
                                required
                                className="max-w-full text-xs"
                              />
                            </label>
                            <button
                              disabled={busy}
                              className="rounded-lg bg-nuwa-base px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
                            >
                              رفع الفيديو
                            </button>
                          </form>
                          <form
                            onSubmit={(event) => {
                              event.preventDefault()
                              const url = String(
                                new FormData(event.currentTarget).get(
                                  "youTubeUrl",
                                ) ?? "",
                              ).trim()
                              void mutate(
                                () =>
                                  teachersApi.setLessonYoutubeVideo(lessonId, {
                                    youTubeUrl: url,
                                  }),
                                "تم ربط فيديو YouTube.",
                              )
                              event.currentTarget.reset()
                            }}
                            className="flex flex-wrap items-end gap-2 rounded-lg bg-canvas p-3"
                          >
                            <label className={field}>
                              رابط YouTube
                              <input
                                name="youTubeUrl"
                                type="url"
                                required
                                className={control}
                              />
                            </label>
                            <button
                              disabled={busy}
                              className="rounded-lg border border-stroke px-3 py-2 text-xs font-semibold text-ink disabled:opacity-50"
                            >
                              حفظ الرابط
                            </button>
                            {video.id !== undefined && (
                              <button
                                type="button"
                                disabled={busy}
                                onClick={() => {
                                  if (
                                    window.confirm("هل تريد حذف فيديو الدرس؟")
                                  )
                                    void mutate(
                                      () =>
                                        teachersApi.deleteLessonVideo(lessonId),
                                      "تم حذف الفيديو.",
                                    )
                                }}
                                className="rounded-lg px-3 py-2 text-xs font-semibold text-danger disabled:opacity-50"
                              >
                                حذف الفيديو
                              </button>
                            )}
                          </form>
                          <form
                            onSubmit={(event) => {
                              event.preventDefault()
                              const form = new FormData(event.currentTarget)
                              const file = form.get("file")
                              if (file instanceof File && file.size)
                                void mutate(
                                  () =>
                                    teachersApi.uploadLessonResource(
                                      lessonId,
                                      file,
                                      String(form.get("name") ?? "").trim(),
                                    ),
                                  "تم رفع المورد.",
                                )
                            }}
                            className="flex flex-wrap items-end gap-2 rounded-lg bg-canvas p-3"
                          >
                            <label className={field}>
                              اسم المورد
                              <input name="name" required className={control} />
                            </label>
                            <label className={field}>
                              الملف
                              <input
                                name="file"
                                type="file"
                                required
                                className="max-w-full text-xs"
                              />
                            </label>
                            <button
                              disabled={busy}
                              className="rounded-lg border border-stroke px-3 py-2 text-xs font-semibold text-ink disabled:opacity-50"
                            >
                              رفع مورد
                            </button>
                          </form>
                          <form
                            onSubmit={(event) => {
                              event.preventDefault()
                              const form = new FormData(event.currentTarget)
                              void mutate(
                                () =>
                                  teachersApi.addExternalLessonResource(
                                    lessonId,
                                    String(form.get("name") ?? "").trim(),
                                    String(
                                      form.get("externalUrl") ?? "",
                                    ).trim(),
                                  ),
                                "تمت إضافة الرابط.",
                              )
                              event.currentTarget.reset()
                            }}
                            className="flex flex-wrap items-end gap-2 rounded-lg bg-canvas p-3"
                          >
                            <label className={field}>
                              اسم الرابط
                              <input name="name" required className={control} />
                            </label>
                            <label className={field}>
                              الرابط
                              <input
                                name="externalUrl"
                                type="url"
                                required
                                className={control}
                              />
                            </label>
                            <button
                              disabled={busy}
                              className="rounded-lg border border-stroke px-3 py-2 text-xs font-semibold text-ink disabled:opacity-50"
                            >
                              إضافة مورد خارجي
                            </button>
                          </form>
                        </div>
                        <div className="mt-3">
                          <button
                            type="button"
                            onClick={() => void openQuiz(lessonId)}
                            className="rounded-lg bg-nuwa-soft px-3 py-2 text-xs font-semibold text-nuwa-base"
                          >
                            إدارة اختبار الدرس
                          </button>
                          {quizLessonId === lessonId && (
                            <div className="mt-3 rounded-lg border border-stroke p-3">
                              {quizMissing && (
                                <form
                                  onSubmit={(event) => void createQuiz(event)}
                                  className="grid gap-2 sm:grid-cols-2"
                                >
                                  <label className={field}>
                                    عنوان الاختبار
                                    <input
                                      name="title"
                                      required
                                      className={control}
                                    />
                                  </label>
                                  <label className={field}>
                                    الوصف
                                    <input
                                      name="description"
                                      required
                                      className={control}
                                    />
                                  </label>
                                  <label className={field}>
                                    درجة النجاح
                                    <input
                                      name="passingScore"
                                      type="number"
                                      min="0"
                                      required
                                      className={control}
                                    />
                                  </label>
                                  <label className={field}>
                                    عدد المحاولات
                                    <input
                                      name="maxAttempts"
                                      type="number"
                                      min="1"
                                      required
                                      className={control}
                                    />
                                  </label>
                                  <button
                                    disabled={busy}
                                    className="rounded-lg bg-nuwa-base px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
                                  >
                                    إنشاء اختبار
                                  </button>
                                </form>
                              )}
                              {quiz && (
                                <div className="space-y-4">
                                  <div className="flex flex-wrap items-center justify-between gap-2">
                                    <p className="text-sm font-semibold text-ink">
                                      {String(quiz.title)} ·{" "}
                                      {quiz.isPublished ? "منشور" : "مسودة"}
                                    </p>
                                    <div className="flex flex-wrap gap-2">
                                      <button
                                        type="button"
                                        disabled={busy}
                                        onClick={() => void toggleQuizPublish()}
                                        className="rounded-lg border border-stroke px-3 py-2 text-xs font-semibold text-ink disabled:opacity-50"
                                      >
                                        {quiz.isPublished
                                          ? "إلغاء النشر"
                                          : "نشر الاختبار"}
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => void loadAttempts()}
                                        className="rounded-lg border border-stroke px-3 py-2 text-xs font-semibold text-ink"
                                      >
                                        محاولات الطلاب
                                      </button>
                                      <button
                                        type="button"
                                        disabled={busy}
                                        onClick={() => {
                                          if (
                                            window.confirm(
                                              "حذف الاختبار وأسئلته؟",
                                            )
                                          )
                                            void mutate(
                                              () =>
                                                quizzesApi.delete(
                                                  String(quiz.id),
                                                ),
                                              "تم حذف الاختبار.",
                                            )
                                        }}
                                        className="rounded-lg border border-danger/30 px-3 py-2 text-xs font-semibold text-danger disabled:opacity-50"
                                      >
                                        حذف الاختبار
                                      </button>
                                    </div>
                                  </div>
                                  <form
                                    onSubmit={(event) => void updateQuiz(event)}
                                    className="grid gap-2 sm:grid-cols-2"
                                  >
                                    <label className={field}>
                                      عنوان الاختبار
                                      <input
                                        name="title"
                                        required
                                        defaultValue={String(quiz.title ?? "")}
                                        className={control}
                                      />
                                    </label>
                                    <label className={field}>
                                      الوصف
                                      <input
                                        name="description"
                                        required
                                        defaultValue={String(
                                          quiz.description ?? "",
                                        )}
                                        className={control}
                                      />
                                    </label>
                                    <label className={field}>
                                      درجة النجاح
                                      <input
                                        name="passingScore"
                                        type="number"
                                        required
                                        defaultValue={String(
                                          quiz.passingScore ?? 0,
                                        )}
                                        className={control}
                                      />
                                    </label>
                                    <label className={field}>
                                      عدد المحاولات
                                      <input
                                        name="maxAttempts"
                                        type="number"
                                        min="1"
                                        required
                                        defaultValue={String(
                                          quiz.maxAttempts ?? 1,
                                        )}
                                        className={control}
                                      />
                                    </label>
                                    <button
                                      disabled={busy}
                                      className="rounded-lg border border-stroke px-3 py-2 text-xs font-semibold text-ink disabled:opacity-50"
                                    >
                                      حفظ إعدادات الاختبار
                                    </button>
                                  </form>
                                  <div className="space-y-3">
                                    {records(quiz.questions).map(
                                      (question, questionIndex) => (
                                        <article
                                          key={String(question.id)}
                                          className="rounded-lg border border-stroke p-3"
                                        >
                                          <div className="flex flex-wrap items-center justify-between gap-2">
                                            <p className="text-sm font-semibold text-ink">
                                              {String(question.text)} · النوع{" "}
                                              {String(question.type)} ·{" "}
                                              {String(question.points)} نقطة
                                            </p>
                                            <div className="flex gap-2">
                                              <button
                                                type="button"
                                                disabled={
                                                  busy || questionIndex === 0
                                                }
                                                aria-label="رفع ترتيب السؤال"
                                                onClick={() =>
                                                  void moveQuestion(
                                                    records(quiz.questions),
                                                    String(quiz.id),
                                                    questionIndex,
                                                    -1,
                                                  )
                                                }
                                                className="rounded border border-stroke px-2 py-1 text-xs disabled:opacity-40"
                                              >
                                                ↑
                                              </button>
                                              <button
                                                type="button"
                                                disabled={
                                                  busy ||
                                                  questionIndex ===
                                                    records(quiz.questions)
                                                      .length -
                                                      1
                                                }
                                                aria-label="خفض ترتيب السؤال"
                                                onClick={() =>
                                                  void moveQuestion(
                                                    records(quiz.questions),
                                                    String(quiz.id),
                                                    questionIndex,
                                                    1,
                                                  )
                                                }
                                                className="rounded border border-stroke px-2 py-1 text-xs disabled:opacity-40"
                                              >
                                                ↓
                                              </button>
                                              <button
                                                type="button"
                                                disabled={busy}
                                                onClick={() => {
                                                  if (
                                                    window.confirm(
                                                      "هل تريد حذف السؤال؟",
                                                    )
                                                  )
                                                    void removeQuestion(
                                                      String(question.id),
                                                    )
                                                }}
                                                className="text-xs font-semibold text-danger disabled:opacity-50"
                                              >
                                                حذف السؤال
                                              </button>
                                            </div>
                                          </div>
                                          <details className="mt-2">
                                            <summary className="cursor-pointer text-xs font-semibold text-nuwa-base">
                                              تعديل السؤال
                                            </summary>
                                            <form
                                              onSubmit={(event) => {
                                                event.preventDefault()
                                                const form = new FormData(
                                                  event.currentTarget,
                                                )
                                                const body = {
                                                  text: String(
                                                    form.get("text") ?? "",
                                                  ).trim(),
                                                  type: Number(
                                                    form.get("type"),
                                                  ),
                                                  points: Number(
                                                    form.get("points"),
                                                  ),
                                                }
                                                void updateQuestion(
                                                  String(question.id),
                                                  body,
                                                )
                                              }}
                                              className="mt-2 grid gap-2 sm:grid-cols-[1fr_100px_100px_auto] sm:items-end"
                                            >
                                              <label className={field}>
                                                نص السؤال
                                                <input
                                                  name="text"
                                                  required
                                                  defaultValue={String(
                                                    question.text ?? "",
                                                  )}
                                                  className={control}
                                                />
                                              </label>
                                              <label className={field}>
                                                النوع
                                                <select
                                                  name="type"
                                                  defaultValue={String(
                                                    question.type ?? 0,
                                                  )}
                                                  className={control}
                                                >
                                                  <option value="0">0</option>
                                                  <option value="1">1</option>
                                                  <option value="2">2</option>
                                                </select>
                                              </label>
                                              <label className={field}>
                                                النقاط
                                                <input
                                                  name="points"
                                                  type="number"
                                                  min="0"
                                                  required
                                                  defaultValue={String(
                                                    question.points ?? 0,
                                                  )}
                                                  className={control}
                                                />
                                              </label>
                                              <button
                                                disabled={busy}
                                                className="h-10 rounded-lg border border-stroke px-3 text-xs font-semibold text-ink disabled:opacity-50"
                                              >
                                                حفظ
                                              </button>
                                            </form>
                                          </details>
                                          <ul className="mt-2 space-y-1 text-xs text-ink-muted">
                                            {records(question.options).map(
                                              (option) => (
                                                <li
                                                  key={String(option.id)}
                                                  className="flex flex-wrap items-center justify-between gap-2"
                                                >
                                                  <details className="min-w-0 flex-1">
                                                    <summary className="cursor-pointer">
                                                      {String(option.text)}
                                                      {option.isCorrect
                                                        ? " · إجابة صحيحة"
                                                        : ""}
                                                    </summary>
                                                    <form
                                                      onSubmit={(event) => {
                                                        event.preventDefault()
                                                        const form =
                                                          new FormData(
                                                            event.currentTarget,
                                                          )
                                                        void updateOption(
                                                          String(option.id),
                                                          {
                                                            text: String(
                                                              form.get(
                                                                "text",
                                                              ) ?? "",
                                                            ).trim(),
                                                            isCorrect:
                                                              form.get(
                                                                "isCorrect",
                                                              ) === "on",
                                                          },
                                                        )
                                                      }}
                                                      className="mt-2 flex flex-wrap items-end gap-2"
                                                    >
                                                      <label className={field}>
                                                        نص الاختيار
                                                        <input
                                                          name="text"
                                                          required
                                                          defaultValue={String(
                                                            option.text ?? "",
                                                          )}
                                                          className={control}
                                                        />
                                                      </label>
                                                      <label className="flex h-10 items-center gap-2 text-xs text-ink">
                                                        <input
                                                          name="isCorrect"
                                                          type="checkbox"
                                                          defaultChecked={
                                                            option.isCorrect ===
                                                            true
                                                          }
                                                        />{" "}
                                                        صحيح
                                                      </label>
                                                      <button
                                                        disabled={busy}
                                                        className="rounded-lg border border-stroke px-3 py-2 text-xs font-semibold text-ink disabled:opacity-50"
                                                      >
                                                        حفظ
                                                      </button>
                                                    </form>
                                                  </details>
                                                  <button
                                                    type="button"
                                                    disabled={busy}
                                                    onClick={() => {
                                                      if (
                                                        window.confirm(
                                                          "هل تريد حذف هذا الاختيار؟",
                                                        )
                                                      )
                                                        void removeOption(
                                                          String(option.id),
                                                        )
                                                    }}
                                                    className="text-danger disabled:opacity-50"
                                                  >
                                                    حذف
                                                  </button>
                                                </li>
                                              ),
                                            )}
                                          </ul>
                                          <form
                                            onSubmit={(event) =>
                                              void addOption(
                                                String(question.id),
                                                event,
                                              )
                                            }
                                            className="mt-3 grid gap-2 sm:grid-cols-[1fr_90px_auto_auto] sm:items-end"
                                          >
                                            <label className={field}>
                                              إضافة اختيار
                                              <input
                                                name="text"
                                                required
                                                className={control}
                                              />
                                            </label>
                                            <label className="flex h-10 items-center gap-2 text-xs text-ink">
                                              <input
                                                name="isCorrect"
                                                type="checkbox"
                                              />{" "}
                                              صحيح
                                            </label>
                                            <label className={field}>
                                              الترتيب
                                              <input
                                                name="order"
                                                type="number"
                                                min="1"
                                                required
                                                className={control}
                                              />
                                            </label>
                                            <button
                                              disabled={busy}
                                              className="h-10 rounded-lg border border-stroke px-3 text-xs font-semibold text-ink disabled:opacity-50"
                                            >
                                              إضافة اختيار
                                            </button>
                                          </form>
                                        </article>
                                      ),
                                    )}
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setAddingQuestion((value) => !value)
                                    }
                                    className="rounded-lg bg-nuwa-soft px-3 py-2 text-xs font-semibold text-nuwa-base"
                                  >
                                    {addingQuestion
                                      ? "إخفاء نموذج السؤال"
                                      : "إضافة سؤال"}
                                  </button>
                                  {addingQuestion && (
                                    <form
                                      onSubmit={(event) =>
                                        void addQuestion(event)
                                      }
                                      className="grid gap-2 rounded-lg bg-canvas p-3 sm:grid-cols-2"
                                    >
                                      <label className={field}>
                                        نص السؤال
                                        <input
                                          name="text"
                                          required
                                          className={control}
                                        />
                                      </label>
                                      <label className={field}>
                                        نوع السؤال حسب رمز الـAPI
                                        <select
                                          name="type"
                                          required
                                          className={control}
                                        >
                                          <option value="0">0</option>
                                          <option value="1">1</option>
                                          <option value="2">2</option>
                                        </select>
                                      </label>
                                      <label className={field}>
                                        النقاط
                                        <input
                                          name="points"
                                          type="number"
                                          min="0"
                                          required
                                          className={control}
                                        />
                                      </label>
                                      <label className={field}>
                                        الترتيب
                                        <input
                                          name="order"
                                          type="number"
                                          min="1"
                                          required
                                          className={control}
                                        />
                                      </label>
                                      <button
                                        disabled={busy}
                                        className="rounded-lg bg-nuwa-base px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
                                      >
                                        حفظ السؤال
                                      </button>
                                    </form>
                                  )}
                                  {attempts && (
                                    <ul className="rounded-lg bg-canvas p-3 text-xs text-ink-muted">
                                      {attempts.length
                                        ? attempts.map((attempt) => (
                                            <li
                                              key={String(attempt.id)}
                                              className="py-1"
                                            >
                                              محاولة {String(attempt.id)} ·
                                              النتيجة{" "}
                                              {String(attempt.score ?? "—")} /{" "}
                                              {String(
                                                attempt.totalPoints ?? "—",
                                              )}{" "}
                                              ·{" "}
                                              {attempt.passed
                                                ? "اجتاز"
                                                : "لم يجتز"}
                                            </li>
                                          ))
                                        : "لا توجد محاولات مسجلة."}
                                    </ul>
                                  )}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </li>
                    )
                  })}
                </ul>
                <form
                  onSubmit={(event) => void createLesson(moduleId, event)}
                  className="mt-3 grid gap-2 rounded-lg bg-canvas p-3 sm:grid-cols-[1fr_1.5fr_100px_auto] sm:items-end"
                >
                  <span className="text-xs font-semibold text-ink-muted sm:col-span-full">
                    إضافة درس إلى: {String(module.title)}
                  </span>
                  <label className={field}>
                    العنوان
                    <input name="title" required className={control} />
                  </label>
                  <label className={field}>
                    الوصف
                    <input name="description" required className={control} />
                  </label>
                  <label className={field}>
                    الترتيب
                    <input
                      name="order"
                      type="number"
                      min="1"
                      required
                      className={control}
                    />
                  </label>
                  <button
                    disabled={busy}
                    className="h-10 rounded-lg border border-stroke px-3 text-xs font-semibold text-ink disabled:opacity-50"
                  >
                    إضافة درس
                  </button>
                </form>
              </article>
            )
          })}
        </div>
      )}
    </section>
  )
}
