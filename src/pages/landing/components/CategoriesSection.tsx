import {
  Atom,
  BookOpen,
  Calculator,
  Code2,
  FlaskConical,
  Languages,
} from "lucide-react"

import type { NavigateFn } from "../../../types"

const categories = [
  {
    name: "الرياضيات",

    detail: "فهم المسائل خطوة بخطوة",

    icon: Calculator,

    color: "bg-[#edf4ff] text-[#4169a2]",
  },

  {
    name: "العلوم",

    detail: "اكتشف كيف يعمل العالم",

    icon: FlaskConical,

    color: "bg-[#eaf6ef] text-[#28744c]",
  },

  {
    name: "اللغة العربية",

    detail: "قراءة وتعبير ومهارات",

    icon: Languages,

    color: "bg-[#fff3e7] text-[#a15f26]",
  },

  {
    name: "اللغة الإنجليزية",

    detail: "تعلّم بثقة وممارسة",

    icon: BookOpen,

    color: "bg-[#f4effa] text-[#735a91]",
  },

  {
    name: "الفيزياء والكيمياء",

    detail: "من الفكرة إلى التجربة",

    icon: Atom,

    color: "bg-[#e8f5f5] text-[#277477]",
  },

  {
    name: "البرمجة",

    detail: "اصنع أول مشروع لك",

    icon: Code2,

    color: "bg-[#fff0ef] text-[#a34e48]",
  },
]

export default function CategoriesSection({
  navigate,
}: {
  navigate: NavigateFn
}) {
  return (
    <section className="bg-white py-14 sm:py-16">
      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-nuwa-base">تعلّم ما يهمك</p>
            <h2 className="mt-2 text-2xl font-bold text-ink sm:text-3xl">
              اكتشف مجالات التعلّم
            </h2>
          </div>
          <button
            type="button"
            onClick={() => navigate("public:courses", { search: "" })}
            className="text-sm font-bold text-nuwa-base underline decoration-nuwa-base/30 underline-offset-4 transition hover:text-nuwa-deep"
          >
            استكشف كل الدورات
          </button>
        </div>

        <div className="mt-7 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {categories.map(({ name, detail, icon: Icon, color }) => (
            <button
              key={name}
              type="button"
              onClick={() => navigate("public:courses", { search: name })}
              className="group flex min-h-36 flex-col items-start justify-between rounded-xl border border-stroke bg-surface p-4 text-start transition hover:-translate-y-0.5 hover:border-stroke-strong hover:shadow-nuwa"
            >
              <span
                className={`grid size-10 place-items-center rounded-lg ${color}`}
              >
                <Icon size={20} aria-hidden="true" />
              </span>
              <span>
                <span className="block text-sm font-bold text-ink">{name}</span>
                <span className="mt-1 block text-xs leading-5 text-ink-muted">
                  {detail}
                </span>
              </span>
            </button>
          ))}
        </div>
      </div>
    </section>
  )
}
