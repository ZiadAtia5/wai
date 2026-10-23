import { ArrowUpLeft, BookOpen, GraduationCap } from "lucide-react"
import { motion, useReducedMotion } from "framer-motion"
import ApiQueryState from "../../../components/ApiQueryState"
import type { LandingCatalogSummary } from "../types"
import type { NavigateFn } from "../../../types"
import { AcademicYearsGridSkeleton } from "./LandingSkeletons"

export default function AcademicYearsSection({
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
    <section className="relative isolate overflow-hidden bg-[radial-gradient(ellipse_at_8%_55%,rgba(66,168,121,.09),transparent_30%)] py-16 sm:py-20">
      <div
        aria-hidden
        className="pointer-events-none absolute -left-20 top-12 -z-10 size-72 rounded-full bg-emerald-100/40 blur-3xl"
      />

      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <motion.div
          {...fade()}
          className="flex flex-wrap items-end justify-between gap-5"
        >
          <div>
            <p className="inline-flex items-center gap-3 text-sm font-semibold text-nuwa-base">
              <span className="grid size-9 place-items-center rounded-xl bg-nuwa-base/10">
                <BookOpen size={19} aria-hidden="true" />
              </span>
              تعلّم يناسب مرحلتك
            </p>
            <h2 className="mt-4 text-2xl font-bold tracking-tight text-[#143a2c] sm:text-3xl">
              صفك الدراسي، خطوتك القادمة
            </h2>
          </div>
          <p className="max-w-lg text-sm leading-7 text-[#687a70]">
            اختر صفك واستكشف ما أعده المعلمون لك من دورات ومحتوى تعليمي.
          </p>
        </motion.div>

        <ApiQueryState
          loading={loading}
          loadingContent={<AcademicYearsGridSkeleton />}
          error={error}
          isEmpty={!!data && data.academicYears.length === 0}
          emptyMessage="لا توجد صفوف دراسية متاحة حاليًا"
          onRetry={onRetry}
        >
          {data && (
            <div className="mt-9 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {data.academicYears.map((year, index) => (
                <motion.button
                  key={year.id}
                  type="button"
                  {...fade(Math.min(index, 5) * 0.05)}
                  onClick={() => navigate("public:courses")}
                  className="group flex items-center gap-4 rounded-2xl border border-[#deebe1] bg-white p-5 text-start shadow-[0_8px_24px_-16px_rgba(23,53,42,.28)] transition-colors hover:border-[#a9cfb3] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-200 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
                >
                  <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-nuwa-base/10 text-nuwa-base">
                    <GraduationCap size={23} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-bold text-[#193b2e]">
                      {year.arabicName}
                    </span>
                    <span className="mt-1 block text-sm text-[#718076]">
                      دورات ومواد تناسب مستواك
                    </span>
                  </span>
                  <span className="grid size-9 shrink-0 place-items-center rounded-full bg-[#f3f8f4] text-[#789080] transition-colors group-hover:bg-nuwa-base group-hover:text-white">
                    <ArrowUpLeft
                      size={17}
                      className="transition-transform group-hover:-translate-x-0.5 group-hover:-translate-y-0.5"
                    />
                  </span>
                </motion.button>
              ))}
            </div>
          )}
        </ApiQueryState>
      </div>
    </section>
  )
}
