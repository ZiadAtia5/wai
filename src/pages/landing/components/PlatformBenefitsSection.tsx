import {
  BookOpenCheck,
  ClipboardCheck,
  GraduationCap,
  TrendingUp,
} from "lucide-react"

const benefits = [
  {
    title: "معلمون متخصصون",

    detail: "خبرة تقرّب المعلومة",

    icon: GraduationCap,
  },

  { title: "دروس مرتبة", detail: "تعلّم خطوة بخطوة", icon: BookOpenCheck },

  { title: "اختبارات دورية", detail: "تأكد من فهمك", icon: ClipboardCheck },

  { title: "تابع تقدمك", detail: "اعرف أين وصلت", icon: TrendingUp },
]

export default function PlatformBenefitsSection() {
  return (
    <section className="border-y border-stroke bg-white">
      <div className="mx-auto grid max-w-7xl grid-cols-2 gap-x-5 gap-y-6 px-5 py-6 sm:px-8 md:grid-cols-4 md:py-7">
        {benefits.map(({ title, detail, icon: Icon }) => (
          <div key={title} className="flex items-center gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-nuwa-soft text-nuwa-base">
              <Icon size={20} aria-hidden="true" />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-bold text-ink">
                {title}
              </span>
              <span className="mt-0.5 block text-xs text-ink-muted">
                {detail}
              </span>
            </span>
          </div>
        ))}
      </div>
    </section>
  )
}
