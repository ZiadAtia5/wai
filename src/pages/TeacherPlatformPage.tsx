import { useCallback, useState } from "react"

import {
  ArrowDown,
  ArrowLeft,
  BookOpen,
  GraduationCap,
  Sparkles,
} from "lucide-react"

import { resolveApiAssetUrl } from "../api/client"

import { teachersApi } from "../api/endpoints"

import ApiQueryState from "../components/ApiQueryState"
import { Skeleton, SkeletonButton, SkeletonText } from "../components/Skeleton"
import { TeacherCoursesSkeleton } from "../components/loading/SkeletonLayouts"

import { useApiQuery } from "../hooks/useApiQuery"

import type { NavigateFn } from "../types"

type PublicRecord = Record<string, unknown>

interface TeacherPlatformData {
  teacher: PublicRecord

  courses: PublicRecord[]
}

function asRecord(value: unknown): PublicRecord | null {
  return typeof value === "object" && value !== null
    ? value as PublicRecord
    : null
}

function recordsFrom(value: unknown): PublicRecord[] {
  if (Array.isArray(value)) {
    return value
      .map(asRecord)
      .filter((item): item is PublicRecord => item !== null)
  }

  const record = asRecord(value)

  if (!record) return []

  for (const key of ["items", "courses", "results"]) {
    if (Array.isArray(record[key])) {
      return recordsFrom(record[key])
    }
  }

  if (record.data !== undefined) return recordsFrom(record.data)
  if (record.result !== undefined) return recordsFrom(record.result)

  throw new Error("استجابة دورات المعلم غير متوقعة.")
}

function teacherRecordFrom(value: unknown): PublicRecord {
  const record = asRecord(value)
  if (!record) throw new Error("استجابة بيانات المعلم غير متوقعة.")

  for (const key of ["data", "teacher", "result"]) {
    if (record[key] !== undefined) return teacherRecordFrom(record[key])
  }

  return record
}

function teacherNameOf(record: PublicRecord): string {
  const name =
    record.fullName ??
    record.name ??
    record.teacherName ??
    [record.firstName, record.lastName].filter(Boolean).join(" ")

  return typeof name === "string" && name.trim() ? name.trim() : "معلم"
}

function teacherImageOf(record: PublicRecord): string {
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
    avatarRecord?.url ??
    avatarRecord?.src

  return typeof candidate === "string" && candidate.trim()
    ? resolveApiAssetUrl(candidate.trim())
    : ""
}

async function loadTeacherPlatform(
  teacherId: string,
): Promise<TeacherPlatformData> {
  const [teacherResponse, coursesResponse] = await Promise.all([
    teachersApi.byId(teacherId),
    teachersApi.courses(teacherId),
  ])
  const teacher = teacherRecordFrom(teacherResponse)
  const courses = recordsFrom(coursesResponse)

  return { teacher, courses }
}

export default function TeacherPlatformPage({
  teacherId,

  navigate,
}: {
  teacherId: string

  navigate: NavigateFn
}) {
  const [reloadKey, setReloadKey] = useState(0)
  const [failedTeacherImageUrl, setFailedTeacherImageUrl] =
    useState<string | null>(null)

  const loadPage = useCallback(
    () => loadTeacherPlatform(teacherId),
    [teacherId],
  )

  const { data, error, loading } = useApiQuery(loadPage, reloadKey)

  const teacher = data?.teacher

  const teacherName = teacher ? teacherNameOf(teacher) : "منصة المعلم"

  const teacherImage = teacher ? teacherImageOf(teacher) : ""

  const teacherBio =
    typeof teacher?.bio === "string"
      ? teacher.bio
      : typeof teacher?.description === "string"
        ? teacher.description
        : ""

  return (
    <div className="min-h-screen bg-canvas pb-16">
      <header className="px-4 pb-4 pt-7 sm:px-6 sm:pt-10 lg:px-8">
        <section className="relative mx-auto grid max-w-360 overflow-hidden rounded-[32px] border border-stroke bg-white shadow-xl shadow-emerald-950/5 lg:min-h-[570px] lg:grid-cols-2">
          <div className="relative order-1 min-h-[360px] overflow-hidden bg-gradient-to-br from-emerald-950 via-emerald-800 to-teal-700 sm:min-h-[460px] lg:min-h-[570px]">
            <div
              aria-hidden="true"
              className="absolute -right-16 -top-16 size-64 rounded-full border border-white/15 sm:size-80"
            />
            <div
              aria-hidden="true"
              className="absolute -bottom-24 -left-12 size-72 rounded-full border border-white/15 sm:size-96"
            />
            {loading ? (
              <Skeleton className="absolute inset-0 rounded-none bg-white/10" />
            ) : teacherImage && failedTeacherImageUrl !== teacherImage ? (
              <img
                src={teacherImage}
                alt={`صورة ${teacherName}`}
                className="absolute inset-0 size-full object-cover object-center"
                onError={() => setFailedTeacherImageUrl(teacherImage)}
              />
            ) : (
              <div className="absolute inset-0 grid place-items-center">
                <div className="grid size-48 place-items-center rounded-full border border-white/20 bg-white/10 shadow-2xl backdrop-blur-sm sm:size-64">
                  {loading ? (
                    <Skeleton className="size-24 rounded-full bg-white/20 sm:size-32" />
                  ) : (
                    <span className="text-7xl font-bold tracking-tight text-white/90 sm:text-8xl">
                      {teacherName
                        .trim()
                        .split(/\s+/)
                        .slice(0, 2)
                        .map((part) => part[0] ?? "")
                        .join("")}
                    </span>
                  )}
                </div>
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-emerald-950/80 via-transparent to-emerald-950/10" />
            <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-4 p-6 text-white sm:p-9">
              <div>
                <span className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-3 py-1.5 text-xs font-semibold backdrop-blur">
                  <GraduationCap size={15} />
                  معلم على منصة وَعي
                </span>
                <p dir="auto" className="mt-3 text-2xl font-bold sm:text-3xl">
                  {loading ? (
                    <Skeleton className="h-8 w-48 bg-white/25 sm:h-9" />
                  ) : teacherName}
                </p>
              </div>
              {loading ? (
                <div className="shrink-0 rounded-2xl border border-white/20 bg-black/15 px-4 py-3 text-center backdrop-blur">
                  <Skeleton className="mx-auto h-7 w-10 bg-white/25" />
                  <Skeleton className="mx-auto mt-2 h-3 w-20 bg-white/20" />
                </div>
              ) : data ? (
                <div className="shrink-0 rounded-2xl border border-white/20 bg-black/15 px-4 py-3 text-center backdrop-blur">
                  <strong className="block text-2xl leading-none">
                    {data.courses.length}
                  </strong>
                  <span className="mt-1 block text-xs text-white/80">
                    دورة تعليمية
                  </span>
                </div>
              ) : null}
            </div>
          </div>

          <div className="order-2 flex flex-col justify-center px-6 py-10 sm:px-10 sm:py-14 lg:px-14 xl:px-20">
            <span className="inline-flex w-fit items-center gap-2 rounded-full bg-nuwa-soft px-3.5 py-2 text-xs font-bold text-nuwa-deep">
              <Sparkles size={15} />
              مرحبًا بك في منصتي التعليمية
            </span>
            <p className="mt-7 text-sm font-semibold text-nuwa-base">
              رحلة تعلم تبدأ بخطوة
            </p>
            <h1
              dir="auto"
              className="mt-2 text-3xl font-bold leading-tight tracking-tight text-ink sm:text-4xl xl:text-5xl"
            >
              تعلّم مع
              <span className="mt-1 block text-nuwa-base">
                {loading ? (
                  <Skeleton className="h-10 w-52 bg-nuwa-soft sm:h-12" />
                ) : teacherName}
              </span>
            </h1>
            <p
              dir="auto"
              className="mt-5 max-w-xl whitespace-pre-line text-sm leading-8 text-ink-muted sm:text-base"
            >
              {loading ? (
                <SkeletonText className="mt-5 max-w-xl" lines={3} />
              ) : (
                teacherBio ||
                "اكتشف الدورات التعليمية وتعلّم بأسلوب واضح ومنظم، خطوة بخطوة."
              )}
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <button
                type="button"
                disabled={loading}
                onClick={() =>
                  document
                    .getElementById("teacher-courses")
                    ?.scrollIntoView({ behavior: "smooth", block: "start" })
                }
                className="inline-flex h-12 items-center gap-2 rounded-xl bg-nuwa-base px-5 text-sm font-bold text-white shadow-lg shadow-emerald-900/15 transition hover:-translate-y-0.5 hover:bg-nuwa-deep"
              >
                {loading ? (
                  <>
                    <SkeletonButton className="h-4 w-24 bg-white/25" />
                    <Skeleton className="size-4 rounded bg-white/25" />
                  </>
                ) : (
                  <>
                    استكشف الدورات
                    <ArrowDown size={17} />
                  </>
                )}
              </button>
              <span className="text-xs font-medium text-ink-muted">
                محتوى تعليمي أُعدّ بعناية
              </span>
            </div>
          </div>
        </section>
      </header>

      <main className="mx-auto max-w-360 px-4 py-8 sm:px-6 md:px-10">
        <section id="teacher-courses" className="scroll-mt-24">
          <div className="mb-5 flex items-end justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-nuwa-base">اختَر مسارك</p>
              <h2 className="mt-1 text-2xl font-bold text-ink">
                الدورات التعليمية
              </h2>
            </div>
          </div>

          <ApiQueryState
            loading={loading}
            loadingContent={<TeacherCoursesSkeleton />}
            error={error}
            isEmpty={Boolean(data && data.courses.length === 0)}
            emptyMessage="لا توجد دورات منشورة متاحة لهذا المعلم حاليًا."
            onRetry={() => setReloadKey((key) => key + 1)}
          >
            {data && data.courses.length > 0 && (
              <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                {data.courses.map((course, index) => {
                  const courseId = course.id

                  const coverImage = String(
                    course.coverImageUrl ??
                      course.thumbnailUrl ??
                      course.imageUrl ??
                      "",
                  )

                  const title = String(
                    course.title ?? course.name ?? "دورة تعليمية",
                  )

                  const description =
                    typeof course.description === "string"
                      ? course.description
                      : "محتوى تعليمي منظم يساعدك على التقدم خطوة بخطوة."

                  return (
                    <button
                      key={String(courseId ?? index)}
                      type="button"
                      disabled={courseId === undefined || courseId === null}
                      onClick={() => {
                        if (courseId !== undefined && courseId !== null) {
                          navigate("public:course-detail", {
                            courseId: String(courseId),
                          })
                        }
                      }}
                      className="group flex min-h-80 flex-col overflow-hidden rounded-[24px] border border-stroke bg-white text-start shadow-sm transition duration-300 hover:-translate-y-1 hover:border-emerald-300 hover:shadow-nuwa-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-800 disabled:cursor-default"
                    >
                      <div className="relative flex h-44 w-full items-end overflow-hidden bg-gradient-to-br from-emerald-950 via-emerald-800 to-teal-700 p-4">
                        {coverImage ? (
                          <img
                            src={coverImage}
                            alt=""
                            className="absolute inset-0 size-full object-cover transition duration-500 group-hover:scale-105"
                          />
                        ) : (
                          <>
                            <div className="absolute -left-6 -top-10 size-40 rounded-full border border-white/15" />
                            <BookOpen
                              size={40}
                              className="absolute left-5 top-5 text-white/75"
                            />
                          </>
                        )}
                        <span className="relative rounded-full border border-white/20 bg-black/20 px-3 py-1 text-xs font-semibold text-white backdrop-blur">
                          {String(course.academicYear ?? "دورة تعليمية")}
                        </span>
                      </div>
                      <div className="flex flex-1 flex-col p-5">
                        <h3 className="line-clamp-1 text-lg font-bold text-ink">
                          {title}
                        </h3>
                        <p className="mt-2 line-clamp-3 min-h-18 text-sm leading-7 text-ink-muted">
                          {description}
                        </p>
                        <div className="mt-auto flex items-center justify-between gap-3 border-t border-stroke pt-4 text-sm">
                          <span className="line-clamp-1 text-ink-muted">
                            {String(course.subjectName ?? "دورة تعليمية")}
                          </span>
                          <span className="inline-flex shrink-0 items-center gap-1 font-semibold text-nuwa-base">
                            اكتشف الدورة
                            <ArrowLeft size={15} />
                          </span>
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </ApiQueryState>
        </section>
      </main>
    </div>
  )
}
