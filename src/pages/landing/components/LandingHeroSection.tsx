import { useState, type FormEvent } from "react"

import {
  ArrowLeft,
  BookOpen,
  GraduationCap,
  Search,
  UsersRound,
} from "lucide-react"

import { motion, useReducedMotion } from "framer-motion"

import PublicNavbar from "../../../components/layout/PublicNavbar"

import type { NavigateFn } from "../../../types"

import studentHeroImage from "../../../assets/student-hero.jpg"

import type { LandingCatalogSummary } from "../types"

export default function LandingHeroSection({
  navigate,

  data,
}: {
  navigate: NavigateFn

  data?: LandingCatalogSummary
}) {
  const [search, setSearch] = useState("")

  const reduce = !!useReducedMotion()

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    navigate("public:courses", { search: search.trim() })
  }

  return (
    <section className="relative isolate overflow-hidden bg-[radial-gradient(ellipse_at_18%_20%,rgba(66,168,121,.14),transparent_34%),radial-gradient(ellipse_at_84%_78%,rgba(232,241,232,.8),transparent_36%),linear-gradient(125deg,#fff_0%,#f8fbf7_55%,#edf5ef_100%)]">
      <PublicNavbar currentView="landing" navigate={navigate} />
      <div className="pointer-events-none absolute inset-0 opacity-[.14] [background-image:linear-gradient(rgba(23,107,67,.12)_1px,transparent_1px),linear-gradient(90deg,rgba(23,107,67,.12)_1px,transparent_1px)] [background-size:48px_48px] [mask-image:linear-gradient(to_bottom,black,transparent_85%)]" />

      <div className="relative mx-auto grid min-h-[620px] w-full min-w-0 max-w-7xl grid-cols-1 items-center gap-5 px-5 pb-12 pt-28 sm:px-8 sm:pt-32 lg:min-h-[680px] lg:grid-cols-2 lg:gap-10 lg:pb-16">
        <motion.div
          initial={reduce ? false : { opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.65, ease: [0.2, 0.7, 0.2, 1] }}
          className="relative z-10 min-w-0 max-w-2xl"
        >
          <p className="inline-flex items-center gap-2 text-sm font-semibold text-nuwa-base">
            <span className="grid size-7 place-items-center rounded-full bg-nuwa-soft">
              <GraduationCap size={16} aria-hidden="true" />
            </span>
            تعلّم من معلمين متخصصين
          </p>
          <h1 className="mt-5 min-w-0 break-words text-4xl font-extrabold leading-[1.3] text-ink sm:text-5xl lg:text-[3.75rem]">
            تعلّم. تطوّر.
            <span className="block text-nuwa-base">وَعي يفتح لك الطريق.</span>
          </h1>
          <p className="mt-5 max-w-xl text-base leading-8 text-ink-muted sm:text-lg">
            دورات واضحة، محتوى مرتب، ومعلمون يرافقونك في كل خطوة من رحلتك
            التعليمية.
          </p>

          <form
            onSubmit={submitSearch}
            className="mt-7 flex min-w-0 max-w-xl items-center gap-2 rounded-xl border border-stroke bg-white p-2 shadow-nuwa-md focus-within:border-nuwa-bright"
          >
            <Search
              className="ms-2 shrink-0 text-ink-muted"
              size={19}
              aria-hidden="true"
            />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              aria-label="ابحث عن دورة"
              placeholder="عن أي موضوع تحب أن تتعلّم؟"
              className="h-11 min-w-0 flex-1 bg-transparent px-1 text-sm text-ink outline-none placeholder:text-ink-muted/75"
            />
            <button
              type="submit"
              className="inline-flex h-11 shrink-0 items-center gap-2 rounded-lg bg-nuwa-base px-4 text-sm font-bold text-white transition hover:bg-nuwa-deep sm:px-5"
            >
              ابحث
              <ArrowLeft size={16} aria-hidden="true" />
            </button>
          </form>

          <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs font-medium text-ink-muted">
            <span className="inline-flex items-center gap-1.5">
              <BookOpen size={15} className="text-nuwa-base" />
              {data
                ? `${data.courseCount.toLocaleString("ar-EG")} دورة تعليمية`
                : "دورات متنوعة"}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <UsersRound size={15} className="text-nuwa-base" />
              {data
                ? `${data.teacherCount.toLocaleString("ar-EG")} معلمون`
                : "معلمون متخصصون"}
            </span>
          </div>
        </motion.div>

        <motion.div
          initial={reduce ? false : { opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, delay: 0.12, ease: [0.2, 0.7, 0.2, 1] }}
          className="relative mx-auto w-full max-w-[560px] py-5 sm:py-8"
        >
          <div
            aria-hidden="true"
            className="absolute inset-x-[8%] top-[10%] aspect-square rounded-full border border-nuwa-base/10"
          />
          <div
            aria-hidden="true"
            className="absolute inset-x-[16%] top-[18%] aspect-square rounded-full border border-dashed border-nuwa-base/20"
          />
          <div className="relative mx-auto aspect-[1.13/1] w-[88%] overflow-hidden rounded-[46%_46%_24px_24px] bg-nuwa-soft shadow-[0_32px_70px_-38px_rgba(11,59,37,.55)]">
            <img
              src={studentHeroImage}
              alt="طالب يراجع دروسه"
              className="size-full object-cover object-center"
              fetchPriority="high"
            />
            <div
              aria-hidden="true"
              className="absolute inset-0 bg-gradient-to-t from-nuwa-deep/20 via-transparent to-white/5"
            />
          </div>

          <div className="absolute bottom-4 left-0 flex items-center gap-3 rounded-xl border border-stroke bg-white p-3 shadow-nuwa-md sm:bottom-8 sm:left-2 sm:p-4">
            <span className="grid size-10 place-items-center rounded-lg bg-nuwa-soft text-nuwa-base">
              <BookOpen size={21} aria-hidden="true" />
            </span>
            <span>
              <span className="block text-xs text-ink-muted">ابدأ بخطوة</span>
              <span className="mt-0.5 block text-sm font-bold text-ink">
                دورات تناسب هدفك
              </span>
            </span>
          </div>

          <div className="absolute right-0 top-5 flex items-center gap-2 rounded-xl border border-stroke bg-white/95 px-3 py-2.5 shadow-nuwa-md backdrop-blur sm:right-1 sm:top-9 sm:px-4">
            <span className="grid size-9 place-items-center rounded-full bg-[#e8f4ed] text-nuwa-base">
              <GraduationCap size={19} aria-hidden="true" />
            </span>
            <span className="text-xs font-bold leading-5 text-ink">
              تعلّم على
              <br />
              وتيرتك
            </span>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
