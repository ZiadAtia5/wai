import { ArrowLeft, ArrowUpLeft, BookOpen, Star } from "lucide-react"
import { motion, useReducedMotion } from "framer-motion"
import { resolveApiAssetUrl } from "../../../api/client"
import ApiQueryState from "../../../components/ApiQueryState"
import type { NavigateFn } from "../../../types"
import type { LandingCatalogSummary } from "../types"
import { CourseGridSkeleton } from "./LandingSkeletons"

const INITIAL_VISIBLE_COURSES = 3

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
  const reduce = !!useReducedMotion()

  // one quiet fade-in when an element first scrolls into view, nothing else
  const fade = (delay = 0) =>
    reduce
      ? {}
      : {
          initial: { opacity: 0, y: 12 },
          whileInView: { opacity: 1, y: 0 },
          viewport: { once: true, margin: "-60px" },
          transition: {
            duration: 0.5,
            delay,
            ease: [0.2, 0.7, 0.2, 1] as const,
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
            <h2 className="mt-4 text-2xl font-bold tracking-tight text-[#143a2c] sm:text-3xl">
              دورات تستحق أن تبدأ بها
            </h2>
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
            <div className="mt-9 grid gap-5 md:grid-cols-3">
              {data.featured
                .slice(0, INITIAL_VISIBLE_COURSES)
                .map((item, index) => {
                  const course = record(item)
                  const cover =
                    typeof course.coverImageUrl === "string"
                      ? resolveApiAssetUrl(course.coverImageUrl)
                      : ""
                  return (
                    <motion.article
                      key={String(course.id ?? index)}
                      {...fade(Math.min(index, 5) * 0.05)}
                      className="group overflow-hidden rounded-2xl border border-[#deebe1] bg-white shadow-[0_8px_24px_-16px_rgba(23,53,42,.28)] transition-colors hover:border-[#a9cfb3]"
                    >
                      <div className="relative flex h-44 items-end overflow-hidden bg-nuwa-deep p-5">
                        {cover ? (
                          <img
                            src={cover}
                            alt=""
                            loading="lazy"
                            decoding="async"
                            className="absolute inset-0 size-full object-cover"
                          />
                        ) : (
                          <BookOpen
                            className="absolute left-6 top-6 text-white/30"
                            size={44}
                            strokeWidth={1.5}
                            aria-hidden="true"
                          />
                        )}
                        <span className="relative rounded-lg bg-white/95 px-2.5 py-1 text-xs font-semibold text-nuwa-deep shadow-sm">
                          {String(course.academicYear ?? "دورة تعليمية")}
                        </span>
                      </div>

                      <div className="p-5">
                        <h3 className="line-clamp-1 text-lg font-bold text-[#17392c]">
                          {String(course.title ?? "دورة تعليمية")}
                        </h3>
                        <p className="mt-2 line-clamp-2 min-h-12 text-sm leading-6 text-[#718076]">
                          {String(
                            course.description ??
                              "محتوى تعليمي منظم يساعدك على التقدم خطوة بخطوة.",
                          )}
                        </p>

                        <div className="mt-4 flex items-center justify-between gap-3 border-t border-[#edf1ed] pt-4 text-sm">
                          <span className="min-w-0 truncate text-[#718076]">
                            {String(
                              course.teacherName ??
                                course.subjectName ??
                                "منصة وعي",
                            )}
                          </span>
                          <span className="shrink-0 rounded-lg bg-nuwa-base/10 px-2.5 py-1 font-bold text-nuwa-base">
                            {course.price === 0
                              ? "مجانية"
                              : typeof course.price === "number"
                                ? `${course.price} ر.س`
                                : "اكتشف الدورة"}
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={() => navigate("public:courses")}
                          className="group/link mt-4 inline-flex items-center gap-2 rounded-md text-sm font-semibold text-nuwa-base transition-colors hover:text-nuwa-deep focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-200 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
                        >
                          تفاصيل الدورة
                          <ArrowUpLeft
                            size={15}
                            className="transition-transform group-hover/link:-translate-x-0.5 group-hover/link:-translate-y-0.5"
                          />
                        </button>
                      </div>
                    </motion.article>
                  )
                })}
            </div>
          )}
        </ApiQueryState>
      </div>
    </section>
  )
}
