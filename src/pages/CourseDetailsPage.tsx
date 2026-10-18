import { useEffect, useState } from "react"

import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  CircleDollarSign,
  GraduationCap,
  LockKeyhole,
  Play,
  ShieldCheck,
  UserRound,
} from "lucide-react"

import { ApiError, getAuthToken } from "../api/client"

import { coursesApi, studentsApi } from "../api/endpoints"

import LessonVideoPlayer from "../components/dashboard/LessonVideoPlayer"

import { notifyError, notifySuccess } from "../utils/notifications"

import type { NavigateFn } from "../types"

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
    "enrollments",
  ]) {
    if (Array.isArray(item[key])) return (item[key] as unknown[]).map(record)
  }

  return []
}

function courseRecord(value: unknown): RecordValue {
  const result = record(unwrap(value))

  for (const key of ["course", "courseDetails", "courseData", "result"]) {
    if (result[key] && typeof result[key] === "object")
      return courseRecord(result[key])
  }

  return result
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

function coursePrice(value: unknown): string {
  const price = Number(value)

  if (!Number.isFinite(price) || price <= 0) return "مجانية"

  return new Intl.NumberFormat("ar-EG", {
    style: "currency",
    currency: "EGP",
    maximumFractionDigits: 0,
  }).format(price)
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

  navigate,

  onBack,
}: {
  courseId: string

  navigate: NavigateFn

  onBack?: () => void
}) {
  const [course, setCourse] = useState<RecordValue | null>(null)

  const [access, setAccess] = useState<AccessState>("checking")

  const [loading, setLoading] = useState(true)

  const [error, setError] = useState("")

  const [requesting, setRequesting] = useState(false)

  async function loadPage(active = () => true) {
    setLoading(true)

    setError("")

    const token = getAuthToken()

    const role = (
      window.sessionStorage.getItem("eduhub.auth.role") ?? ""
    ).toLowerCase()

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

        nextAccess = enrollmentState(enrollment)
      } catch {
        // Fail closed: do not request a video-bearing response when enrollment cannot be verified.

        nextAccess = "verification-failed"
      }
    }

    try {
      const response =
        nextAccess === "approved"
          ? await coursesApi.detail(courseId)
          : await coursesApi.publicDetail(courseId)

      if (!active()) return

      setCourse(courseRecord(response))

      setAccess(nextAccess)
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

    const role = (
      window.sessionStorage.getItem("eduhub.auth.role") ?? ""
    ).toLowerCase()

    if (!role.includes("student")) {
      notifyError(new Error("طلب الالتحاق متاح لحساب الطالب فقط."))

      return
    }

    setRequesting(true)

    try {
      await coursesApi.enroll(courseId)

      setAccess("pending")

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

  const modules = list(course?.modules ?? course?.courseModules)

  const lessonCount = modules.reduce(
    (count, module) =>
      count + list(module.lessons ?? module.courseLessons).length,
    0,
  )

  const canWatch = access === "approved"

  const cover = String(
    course?.coverImageUrl ?? course?.thumbnailUrl ?? course?.imageUrl ?? "",
  )

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
          <div className="space-y-5" aria-busy="true">
            <div className="h-72 animate-pulse rounded-[2rem] bg-white" />
            <div className="h-40 animate-pulse rounded-2xl bg-white" />
          </div>
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
                  className="absolute inset-0 -z-20 size-full object-cover opacity-40"
                />
              )}
              <div className="absolute inset-0 -z-10 bg-gradient-to-l from-emerald-950/95 via-emerald-950/60 to-emerald-950/15" />
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
                <CircleDollarSign size={17} /> {coursePrice(course.price)}
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

                {modules.length ? (
                  <div className="mt-5 space-y-4">
                    {modules.map((module, moduleIndex) => {
                      const lessons = list(
                        module.lessons ?? module.courseLessons,
                      )

                      return (
                        <details
                          key={String(module.id ?? moduleIndex)}
                          open
                          className="group overflow-hidden rounded-2xl border border-stroke bg-[#fbfdfb]"
                        >
                          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-4 sm:p-5">
                            <span className="flex min-w-0 items-center gap-3">
                              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-nuwa-soft text-nuwa-base">
                                <BookOpen size={19} />
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
                            <span className="shrink-0 text-xs text-ink-muted">
                              {lessons.length} دروس
                            </span>
                          </summary>
                          <div className="divide-y divide-stroke border-t border-stroke bg-white px-4 sm:px-5">
                            {lessons.length ? (
                              lessons.map((lesson, lessonIndex) => {
                                const video = videoFromLesson(lesson)

                                return (
                                  <article
                                    key={String(
                                      lesson.id ??
                                        lesson.lessonId ??
                                        lessonIndex,
                                    )}
                                    className="py-4"
                                  >
                                    <div className="flex items-start gap-3">
                                      <span
                                        className={`mt-0.5 grid size-9 shrink-0 place-items-center rounded-xl ${
                                          canWatch
                                            ? "bg-emerald-50 text-emerald-700"
                                            : "bg-neutral-100 text-neutral-500"
                                        }`}
                                      >
                                        {canWatch ? (
                                          <Play size={16} />
                                        ) : (
                                          <LockKeyhole size={16} />
                                        )}
                                      </span>
                                      <div className="min-w-0 flex-1">
                                        <h3 className="font-bold text-ink">
                                          {String(
                                            lesson.title ??
                                              lesson.name ??
                                              `الدرس ${lessonIndex + 1}`,
                                          )}
                                        </h3>
                                        {Boolean(lesson.description) && (
                                          <p className="mt-1 whitespace-pre-line text-sm leading-6 text-ink-muted">
                                            {String(lesson.description)}
                                          </p>
                                        )}
                                        {!canWatch && (
                                          <p className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-ink-muted">
                                            <LockKeyhole size={13} /> الفيديو
                                            مقفل حتى قبول طلب الالتحاق
                                          </p>
                                        )}
                                      </div>
                                    </div>
                                    {canWatch && video && (
                                      <LessonVideoPlayer
                                        video={video}
                                        title={String(
                                          lesson.title ?? "فيديو الدرس",
                                        )}
                                      />
                                    )}
                                    {canWatch && !video && (
                                      <p className="mt-3 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
                                        لم يضف المدرّس فيديو لهذا الدرس بعد.
                                      </p>
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
                    onClick={() => void requestEnrollment()}
                    className="mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-l from-[#176b43] to-[#0b3b25] px-4 py-3 text-sm font-bold text-white shadow-lg shadow-nuwa-base/15 transition hover:-translate-y-0.5 disabled:cursor-wait disabled:opacity-60"
                  >
                    {requesting ? "جارٍ إرسال الطلب..." : "طلب الالتحاق بالدورة"}
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
                  <span className="mt-4 flex min-h-11 items-center justify-center gap-2 rounded-xl bg-amber-50 px-4 py-2 text-sm font-bold text-amber-800">
                    <LockKeyhole size={16} /> الطلب قيد المراجعة
                  </span>
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
    </main>
  )
}
