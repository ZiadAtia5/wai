import { useState } from "react"

import { ArrowDown, ArrowLeft, BookOpen, Star } from "lucide-react"

import { motion, useReducedMotion } from "framer-motion"

import { resolveApiAssetUrl } from "../../../api/client"

import ApiQueryState from "../../../components/ApiQueryState"

import type { NavigateFn } from "../../../types"

import type { LandingCatalogSummary } from "../types"

import { CourseGridSkeleton } from "./LandingSkeletons"

import { formatEgp } from "../../../utils/currency"

const INITIAL_VISIBLE_COURSES = 4
const MORE_COURSES = 4

function record(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null
    ? value as Record<string, unknown>
    : {}
}

export default function FeaturedCoursesSection({
  data,

  loading,

  error,

  onRetry,

  navigate,
}: {
  data?: LandingCatalogSummary

  loading: boolean

  error: string | null

  onRetry: () => void

  navigate: NavigateFn
}) {
  const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE_COURSES)
  const reduce = !!useReducedMotion()

  // one quiet fade-in when an element first scrolls into view, nothing else

  const fade = (delay = 0) =>
    reduce
      ? {}
      : {
          initial: { opacity: 0, y: 22 },

          whileInView: { opacity: 1, y: 0 },

          viewport: { once: true, margin: "-60px" },

          transition: {
            duration: 0.7,

            delay,

            ease: [0.22, 1, 0.36, 1] as const,
          },
        }

  return (
    <section className="relative isolate overflow-hidden bg-white py-16 sm:py-20">
      <div
        aria-hidden
        className="pointer-events-none absolute -right-24 top-0 -z-10 size-96 rounded-full bg-[#eef7ef] blur-3xl"
      />

      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <motion.div
          {...fade()}
          className="flex flex-wrap items-end justify-between gap-5"
        >
          <div>
            <p className="inline-flex items-center gap-3 text-sm font-semibold text-nuwa-base">
              <span className="grid size-9 place-items-center rounded-xl bg-nuwa-base/10">
                <Star size={18} aria-hidden="true" />
              </span>
              اختيارات من المنصة
            </p>
            <motion.h2
              initial={
                reduce ? false : { opacity: 0, y: 16, filter: "blur(8px)" }
              }
              whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{
                duration: 0.75,
                delay: reduce ? 0 : 0.1,
                ease: [0.22, 1, 0.36, 1],
              }}
              className="mt-4 text-3xl font-extrabold tracking-tight text-[#143a2c] sm:text-4xl lg:text-5xl"
            >
              دورات تستحق أن تبدأ بها
            </motion.h2>
          </div>
          <button
            type="button"
            onClick={() => navigate("public:courses")}
            className="group inline-flex items-center gap-2 rounded-xl border border-[#cddbd0] bg-white px-4 py-2.5 text-sm font-semibold text-[#234736] transition-colors hover:border-[#9fbea7] hover:bg-[#edf5ef] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-200 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
          >
            كل الدورات
            <ArrowLeft
              size={16}
              className="text-nuwa-base transition-transform group-hover:-translate-x-0.5"
            />
          </button>
        </motion.div>

        <ApiQueryState
          loading={loading}
          loadingContent={<CourseGridSkeleton />}
          error={error}
          isEmpty={Boolean(data && data.featured.length === 0)}
          emptyMessage="لا توجد دورات منشورة حالياً."
          onRetry={onRetry}
        >
          {data && (
            <div className="mt-9 grid grid-cols-1 gap-4 sm:gap-5">
              {data.featured
                .slice(0, visibleCount)

                .map((item, index) => {
                  const course = record(item)

                  const cover =
                    typeof course.coverImageUrl === "string"
                      ? resolveApiAssetUrl(course.coverImageUrl)
                      : ""
                  const subjectName =
                    course.subjectName == null ? "" : String(course.subjectName)

                  return (
                    <motion.article
                      key={String(course.id ?? index)}
                      {...fade(Math.min(index, 5) * 0.05)}
                      layout={!reduce}
                      className="group relative mx-auto flex min-h-64 w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-stroke bg-surface text-start shadow-sm transition-[border-color,box-shadow,transform] duration-300 hover:-translate-y-0.5 hover:border-emerald-300/70 hover:shadow-[0_16px_36px_-24px_rgba(11,59,37,.35)] sm:min-h-72 sm:flex-row sm:rounded-3xl"
                    >
                      <div className="relative h-44 w-full shrink-0 overflow-hidden bg-gradient-to-br from-[#072d1c] via-[#0e5233] to-[#187d4d] sm:h-auto sm:min-h-72 sm:w-[38%]">
                        {cover ? (
                          <img
                            src={cover}
                            alt=""
                            loading="lazy"
                            decoding="async"
                            className="absolute inset-0 size-full object-cover"
                          />
                        ) : (
                          <div className="absolute inset-0 flex items-center justify-center">
                            <div className="absolute -right-10 -top-10 size-48 rounded-full border border-white/10 bg-white/5 blur-sm" />
                            <div className="absolute -left-10 -bottom-10 size-36 rounded-full border border-white/10 bg-white/5 blur-sm" />
                            <div className="relative z-10 grid size-16 place-items-center rounded-2xl border border-white/20 bg-white/10 shadow-inner backdrop-blur-md">
                              <BookOpen
                                size={30}
                                className="text-emerald-200"
                              />
                            </div>
                          </div>
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-[#091e15]/90 via-[#091e15]/30 to-black/20 transition-opacity duration-300 group-hover:opacity-85" />
                        <div
                          aria-hidden="true"
                          className="pointer-events-none absolute inset-0 z-[1] bg-[radial-gradient(ellipse_at_50%_100%,rgba(52,211,153,.2),transparent_65%)] opacity-0 transition-opacity duration-300 ease-out group-hover:opacity-100"
                        />
                        <div className="absolute inset-x-2.5 top-2.5 z-10 flex items-center justify-between gap-2 sm:inset-x-3.5 sm:top-3.5">
                          {subjectName ? (
                            <span className="inline-flex max-w-[70%] items-center gap-1 rounded-full border border-white/20 bg-emerald-950/60 px-2.5 py-1 text-[10px] font-bold text-emerald-200 shadow-sm backdrop-blur-md sm:max-w-full sm:gap-1.5 sm:px-3 sm:text-[11px]">
                              <span className="size-1.5 shrink-0 animate-pulse rounded-full bg-emerald-400" />
                              <span className="truncate">{subjectName}</span>
                            </span>
                          ) : (
                            <span />
                          )}
                          {course.academicYear != null &&
                            course.academicYear !== "" && (
                              <span className="inline-flex shrink-0 items-center rounded-full border border-white/15 bg-black/40 px-2.5 py-1 text-[10px] font-semibold text-white/90 shadow-sm backdrop-blur-md sm:px-3 sm:text-[11px]">
                                {String(course.academicYear)}
                              </span>
                            )}
                        </div>
                        {course.price != null && (
                          <div className="absolute bottom-2.5 right-2.5 z-10 sm:bottom-3.5 sm:right-3.5">
                            <span
                              className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[10px] font-black shadow-xl backdrop-blur-md sm:rounded-xl sm:px-3.5 sm:py-1.5 sm:text-xs ${
                                Number(course.price) === 0
                                  ? "border border-emerald-400/50 bg-emerald-500/90 text-white shadow-emerald-950/40"
                                  : "border border-white/30 bg-white/95 text-emerald-950 shadow-black/20"
                              }`}
                            >
                              {formatEgp(course.price)}
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="relative z-10 flex flex-1 flex-col justify-between bg-surface p-4 transition-colors duration-300 group-hover:bg-emerald-50/20 sm:p-6">
                        <div>
                          <h3 className="line-clamp-2 text-[15px] font-bold leading-snug text-ink transition-colors duration-300 group-hover:text-nuwa-base sm:text-base">
                            {String(course.title ?? "دورة تعليمية")}
                          </h3>
                          <p className="mt-1.5 line-clamp-2 text-xs font-normal leading-relaxed text-ink-muted/90 sm:mt-2">
                            {String(
                              course.description ??
                                "محتوى تعليمي منظم يساعدك على التقدم خطوة بخطوة.",
                            )}
                          </p>
                        </div>
                        <div className="mt-3 flex flex-col items-stretch justify-between gap-2 border-t border-stroke/50 pt-3 sm:mt-5 sm:flex-row sm:items-center sm:gap-3 sm:pt-3.5">
                          <div className="flex min-w-0 items-center gap-2.5">
                            <div className="relative grid size-8 shrink-0 place-items-center rounded-full bg-emerald-100/80 text-emerald-900 shadow-sm ring-2 ring-emerald-500/20 transition-transform duration-300 group-hover:scale-105">
                              <BookOpen size={15} />
                            </div>
                            <div className="flex min-w-0 flex-col">
                              <span className="text-[10px] font-medium text-ink-muted/70">
                                المعلم
                              </span>
                              <span className="truncate text-[11px] font-bold text-ink/90 sm:text-xs">
                                {String(
                                  course.teacherName ??
                                    course.subjectName ??
                                    "منصة وَعي",
                                )}
                              </span>
                            </div>
                          </div>
                          <button
                            type="button"
                            disabled={
                              course.id === undefined || course.id === null
                            }
                            onClick={() =>
                              navigate("public:course-detail", {
                                courseId: String(course.id),
                              })
                            }
                            className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg bg-nuwa-soft px-3 py-2 text-xs font-bold text-nuwa-deep transition-[transform,background-color,color] duration-300 ease-out hover:bg-nuwa-base hover:text-white hover:shadow-md hover:shadow-emerald-900/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-200 disabled:cursor-default sm:gap-1.5 sm:rounded-full sm:px-4 sm:py-2"
                          >
                            التفاصيل
                            <ArrowLeft size={13} aria-hidden="true" />
                          </button>
                        </div>
                      </div>
                    </motion.article>
                  )
                })}
            </div>
          )}
        </ApiQueryState>
        {data && data.featured.length > visibleCount && (
          <motion.div {...fade()} className="mt-7 flex justify-center">
            <button
              type="button"
              onClick={() => setVisibleCount((count) => count + MORE_COURSES)}
              className="group inline-flex min-h-12 w-full max-w-sm items-center justify-center gap-2 rounded-2xl border border-[#cddbd0] bg-white px-5 py-3 text-sm font-bold text-[#234736] shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-nuwa-base/50 hover:bg-nuwa-ice hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300 sm:w-auto"
            >
              <span>عرض المزيد من الدورات</span>
              <ArrowDown size={16} className="transition-transform duration-300 group-hover:translate-y-0.5" aria-hidden="true" />
            </button>
          </motion.div>
        )}
      </div>
    </section>
  )
}
