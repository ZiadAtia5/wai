import {
  ArrowLeft,
  Atom,
  BookOpen,
  Calculator,
  Code2,
  FlaskConical,
  Languages,
  Sparkles,
  type LucideIcon,
} from "lucide-react"

import { motion, useReducedMotion } from "framer-motion"

import type { NavigateFn } from "../../../types"

type Category = {
  name: string
  detail: string
  icon: LucideIcon
  iconClassName: string
  glowClassName: string
  borderHoverClass: string
}

const CATEGORIES: readonly Category[] = [
  {
    name: "الرياضيات",
    detail: "فهم المسائل خطوة بخطوة",
    icon: Calculator,
    iconClassName: "bg-blue-500/10 text-blue-600 ring-blue-500/20",
    glowClassName: "from-blue-500/15 via-blue-400/5 to-transparent",
    borderHoverClass: "hover:border-blue-500/50 hover:shadow-blue-500/10",
  },
  {
    name: "العلوم",
    detail: "اكتشف كيف يعمل العالم",
    icon: FlaskConical,
    iconClassName: "bg-emerald-500/10 text-emerald-600 ring-emerald-500/20",
    glowClassName: "from-emerald-500/15 via-emerald-400/5 to-transparent",
    borderHoverClass: "hover:border-emerald-500/50 hover:shadow-emerald-500/10",
  },
  {
    name: "اللغة العربية",
    detail: "قراءة وتعبير ومهارات",
    icon: Languages,
    iconClassName: "bg-amber-500/10 text-amber-600 ring-amber-500/20",
    glowClassName: "from-amber-500/15 via-amber-400/5 to-transparent",
    borderHoverClass: "hover:border-amber-500/50 hover:shadow-amber-500/10",
  },
  {
    name: "اللغة الإنجليزية",
    detail: "تعلّم بثقة وممارسة",
    icon: BookOpen,
    iconClassName: "bg-violet-500/10 text-violet-600 ring-violet-500/20",
    glowClassName: "from-violet-500/15 via-violet-400/5 to-transparent",
    borderHoverClass: "hover:border-violet-500/50 hover:shadow-violet-500/10",
  },
  {
    name: "الفيزياء والكيمياء",
    detail: "من الفكرة إلى التجربة",
    icon: Atom,
    iconClassName: "bg-cyan-500/10 text-cyan-600 ring-cyan-500/20",
    glowClassName: "from-cyan-500/15 via-cyan-400/5 to-transparent",
    borderHoverClass: "hover:border-cyan-500/50 hover:shadow-cyan-500/10",
  },
  {
    name: "البرمجة",
    detail: "اصنع أول مشروع لك",
    icon: Code2,
    iconClassName: "bg-rose-500/10 text-rose-600 ring-rose-500/20",
    glowClassName: "from-rose-500/15 via-rose-400/5 to-transparent",
    borderHoverClass: "hover:border-rose-500/50 hover:shadow-rose-500/10",
  },
]

type CategoriesSectionProps = {
  navigate: NavigateFn
}

export default function CategoriesSection({
  navigate,
}: CategoriesSectionProps) {
  const reduce = !!useReducedMotion()

  const handleExploreAll = () => {
    navigate("public:courses", {
      search: "",
    })
  }

  const handleCategorySelect = (category: string) => {
    navigate("public:courses", {
      search: category,
    })
  }

  return (
    <section
      dir="rtl"
      aria-labelledby="categories-heading"
      className="relative overflow-hidden bg-[#f4f6f8] py-14 sm:py-20"
    >
      {/* خلفية جمالية خفيفة */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-20 -top-20 size-[400px] rounded-full bg-nuwa-base/5 blur-[100px]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-20 -left-20 size-[400px] rounded-full bg-blue-500/5 blur-[100px]"
      />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* الترويسة والعنوان */}
        <div className="mb-8 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <motion.div
            initial={reduce ? false : { opacity: 0, y: 22 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{
              duration: 0.7,
              ease: [0.22, 1, 0.36, 1],
            }}
          >
            <motion.div
              initial={reduce ? false : { opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{
                duration: 0.55,
                delay: reduce ? 0 : 0.08,
                ease: [0.22, 1, 0.36, 1],
              }}
              className="mb-2 inline-flex items-center gap-1.5 rounded-full border border-nuwa-base/20 bg-nuwa-base/10 px-3 py-1 shadow-2xs"
            >
              <span className="size-1.5 animate-pulse rounded-full bg-nuwa-base" />
              <span className="text-[11px] font-bold text-nuwa-base tracking-wide">
                تعلّم حسب اهتمامك
              </span>
            </motion.div>

            <motion.h2
              id="categories-heading"
              initial={
                reduce ? false : { opacity: 0, y: 18, filter: "blur(8px)" }
              }
              whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{
                duration: 0.7,
                delay: reduce ? 0 : 0.16,
                ease: [0.22, 1, 0.36, 1],
              }}
              className="text-3xl font-black tracking-tight text-ink sm:text-4xl lg:text-5xl"
            >
              اكتشف مجالات <span className="text-nuwa-base">التعلّم</span>
            </motion.h2>
          </motion.div>

          {/* زر الاستكشاف العام (سطح المكتب) */}
          <button
            type="button"
            onClick={handleExploreAll}
            className="
              group hidden shrink-0 items-center gap-2
              rounded-xl border border-slate-300/80
              bg-white/90 px-4 py-2
              text-xs font-bold text-ink
              shadow-xs transition-all duration-200
              hover:-translate-y-0.5
              hover:border-nuwa-base/50
              hover:text-nuwa-base
              hover:shadow-md
              focus-visible:outline-none
              focus-visible:ring-2
              focus-visible:ring-nuwa-base
              sm:flex
            "
          >
            <span>استكشف كل الدورات</span>
            <ArrowLeft
              size={14}
              aria-hidden="true"
              className="transition-transform duration-200 group-hover:-translate-x-1 text-nuwa-base"
            />
          </button>
        </div>

        {/* شبكة المجالات (الكروت المدمجة والمصغرة) */}
        <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-3 lg:grid-cols-6">
          {CATEGORIES.map((category) => {
            const Icon = category.icon

            return (
              <button
                key={category.name}
                type="button"
                onClick={() => handleCategorySelect(category.name)}
                aria-label={`استكشف دورات ${category.name}`}
                className={`
                  group relative flex min-h-[160px]
                  flex-col justify-between overflow-hidden
                  rounded-2xl border border-slate-200/90
                  bg-white/95 p-4 text-right
                  shadow-[0_2px_8px_rgba(15,23,42,0.04)]
                  transition-all duration-300
                  hover:-translate-y-1
                  hover:bg-white
                  hover:shadow-[0_12px_24px_rgba(15,23,42,0.08)]
                  focus-visible:outline-none
                  focus-visible:ring-2
                  focus-visible:ring-nuwa-base
                  ${category.borderHoverClass}
                `}
              >
                {/* خلفية التمرير الهادئة */}
                <div
                  aria-hidden="true"
                  className={`
                    absolute inset-0 bg-gradient-to-br
                    opacity-0 transition-opacity duration-300
                    group-hover:opacity-100 pointer-events-none
                    ${category.glowClassName}
                  `}
                />

                {/* رأس الكارت (الأيقونة والشارة) */}
                <div className="relative z-10 flex items-center justify-between">
                  <span
                    className={`
                      relative grid size-10 shrink-0
                      place-items-center rounded-xl
                      ring-1 shadow-2xs
                      transition-all duration-300
                      group-hover:scale-105
                      ${category.iconClassName}
                    `}
                  >
                    <Icon size={20} strokeWidth={2.2} aria-hidden="true" />
                  </span>

                  <Sparkles
                    size={14}
                    className="text-nuwa-base opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                  />
                </div>

                {/* النصوص والتفاصيل */}
                <div className="relative z-10 mt-3">
                  <span className="block text-sm font-black tracking-tight text-ink transition-colors duration-200 group-hover:text-nuwa-base">
                    {category.name}
                  </span>

                  <span className="mt-1 block text-[11px] leading-tight text-ink-muted line-clamp-1">
                    {category.detail}
                  </span>

                  {/* سهم التفاعل المصغر */}
                  <div
                    aria-hidden="true"
                    className="
                      mt-3 inline-flex
                      items-center gap-1
                      text-[11px] font-extrabold
                      text-nuwa-base
                      opacity-0 -translate-x-2
                      transition-all duration-300
                      group-hover:translate-x-0
                      group-hover:opacity-100
                    "
                  >
                    <span>استكشف</span>
                    <ArrowLeft
                      size={12}
                      className="transition-transform duration-200 group-hover:-translate-x-0.5"
                    />
                  </div>
                </div>
              </button>
            )
          })}
        </div>

        {/* زر الاستكشاف العام (للموبايل) */}
        <button
          type="button"
          onClick={handleExploreAll}
          className="
            mt-6 flex w-full
            items-center justify-center gap-2
            rounded-xl border border-slate-300
            bg-white px-4 py-3
            text-xs font-bold text-ink
            shadow-2xs transition-all duration-200
            hover:border-nuwa-base/40 hover:text-nuwa-base
            sm:hidden
          "
        >
          <span>استكشف كل الدورات</span>
          <ArrowLeft size={14} aria-hidden="true" />
        </button>
      </div>
    </section>
  )
}
