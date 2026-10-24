import {
  ArrowLeft,
  BookOpen,
  CirclePlay,
  GraduationCap,
  Sparkles,
  TrendingUp,
} from "lucide-react"

import { motion, useReducedMotion } from "framer-motion"

import type { NavigateFn } from "../../../types"

import type { LandingCatalogSummary } from "../types"

export default function CallToActionSection({
  navigate,

  data,
}: {
  navigate: NavigateFn

  data?: LandingCatalogSummary
}) {
  const reduce = !!useReducedMotion()

  const stats = [
    {
      value: data ? data.courseCount.toLocaleString("ar-EG") : "متنوعة",

      label: "دورات تعليمية",

      icon: BookOpen,
    },

    {
      value: data ? data.teacherCount.toLocaleString("ar-EG") : "خبرات",

      label: "معلمون متخصصون",

      icon: GraduationCap,
    },

    { value: "خطوة بخطوة", label: "دروس مرتبة", icon: CirclePlay },

    { value: "في أي وقت", label: "تعلّم بوتيرتك", icon: TrendingUp },
  ]

  return (
    <section className="relative isolate overflow-hidden bg-[linear-gradient(112deg,#0b3b25_0%,#125b39_58%,#176b43_100%)] py-12 text-white sm:py-16">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[.12] [background-image:linear-gradient(rgba(255,255,255,.42)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.42)_1px,transparent_1px)] [background-size:34px_34px] [mask-image:linear-gradient(90deg,transparent,black)]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-20 -top-28 size-80 rounded-full border border-white/15"
      />
      <motion.div
        initial={reduce ? false : { opacity: 0, y: 18 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-60px" }}
        transition={{ duration: 0.55, ease: [0.2, 0.7, 0.2, 1] }}
        className="relative mx-auto grid max-w-7xl gap-8 px-5 sm:px-8 lg:grid-cols-[.9fr_1.35fr_auto] lg:items-center lg:gap-10"
      >
        <div className="max-w-md">
          <p className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-200">
            <Sparkles size={16} aria-hidden="true" />
            ابدأ من هنا
          </p>
          <h2 className="mt-3 text-3xl font-bold leading-[1.35] sm:text-4xl">
            معرفة اليوم،
            <span className="block text-emerald-200">تصنع فرص الغد.</span>
          </h2>
          <p className="mt-3 max-w-sm text-sm leading-7 text-white/75">
            اختر دورتك، تعلّم من خبرات معلمينا، واحتفل بكل خطوة تتقدمها.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-x-4 gap-y-5 border-y border-white/15 py-5 sm:grid-cols-4 sm:gap-5 sm:border-y-0 sm:border-x sm:px-6 sm:py-1">
          {stats.map(({ value, label, icon: Icon }, index) => (
            <motion.div
              key={label}
              initial={reduce ? false : { opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: reduce ? 0 : index * 0.08 }}
              className="min-w-0"
            >
              <span className="mb-3 grid size-9 place-items-center rounded-lg border border-white/20 bg-white/10 text-emerald-200">
                <Icon size={18} aria-hidden="true" />
              </span>
              <strong className="block truncate text-base font-bold tabular-nums sm:text-lg">
                {value}
              </strong>
              <span className="mt-1 block text-xs text-white/70">{label}</span>
            </motion.div>
          ))}
        </div>

        <button
          type="button"
          onClick={() => navigate("register")}
          className="inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-white px-5 text-sm font-bold text-nuwa-deep shadow-lg shadow-black/10 transition hover:-translate-y-0.5 hover:bg-emerald-50"
        >
          ابدأ رحلتك
          <ArrowLeft size={16} aria-hidden="true" />
        </button>
      </motion.div>
    </section>
  )
}
