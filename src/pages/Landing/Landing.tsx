import { ArrowLeft, BookOpen, GraduationCap, ShieldCheck, Sparkles } from "lucide-react";

import type { NavigateFn } from "../../types";
import CoursesShowcase from "./CoursesSection";
import HeroPage from "./HeroPage";
import TeachersPage from "./Teachers";

const platformBenefits = [
  {
    icon: BookOpen,
    title: "محتوى واضح ومنظم",
    description: "تعرّف على الدورات ومعلوماتها الأساسية قبل أن تختار ما يناسبك.",
  },
  {
    icon: GraduationCap,
    title: "معلمون بخبرات متنوعة",
    description: "اكتشف ملفات المعلمين وتعرّف على خبراتهم والدورات التي يقدمونها.",
  },
  {
    icon: ShieldCheck,
    title: "تجربة تعليمية موثوقة",
    description: "منصة تجمع رحلة التعلّم في مكان واحد، من استكشاف المحتوى حتى طلب الالتحاق.",
  },
];

export default function Landing({ navigate }: { navigate: NavigateFn }) {
  return (
    <>
      <HeroPage navigate={navigate} />
      <CoursesShowcase navigate={navigate} />
      <TeachersPage navigate={navigate} embedded />

      <section id="about-platform" className="page-ambient relative flex min-h-[calc(100svh-4rem)] scroll-mt-20 items-center overflow-hidden border-y border-stroke bg-surface">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              "radial-gradient(circle at 1px 1px, var(--color-stroke, #e5e7eb) 1px, transparent 0)",
            backgroundSize: "24px 24px",
            maskImage: "radial-gradient(ellipse at 80% 50%, black 0%, transparent 68%)",
            WebkitMaskImage: "radial-gradient(ellipse at 80% 50%, black 0%, transparent 68%)",
          }}
        />
        <div className="relative mx-auto grid w-full max-w-360 items-center gap-10 px-6 py-14 sm:px-8 md:grid-cols-[0.9fr_1.1fr] md:gap-16 md:px-10 md:py-16">
          <div>
            <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-nuwa-base/15 bg-nuwa-soft px-3 py-1.5 text-sm font-semibold text-nuwa-base">
              <Sparkles size={16} aria-hidden />
              عن وَعي
            </p>
            <h2 className="max-w-xl text-3xl font-bold leading-tight text-nuwa-deep sm:text-4xl md:text-5xl">
              تعليم أوضح، وخطوات أقرب لأهدافك
            </h2>
            <p className="mt-5 max-w-xl text-base leading-8 text-ink-muted md:text-lg">
              وَعي تجمع الدورات والمعلمين في مساحة واحدة لتستكشف خياراتك، وتقارن
              التفاصيل، وتبدأ رحلة تعلم تناسب طموحك بثقة.
            </p>
            <button
              type="button"
              onClick={() => navigate("public:courses")}
              className="group mt-7 inline-flex h-12 items-center gap-2 rounded-lg bg-nuwa-base px-5 font-semibold text-white transition-colors hover:bg-nuwa-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-nuwa-base"
            >
              اكتشف الدورات
              <ArrowLeft size={17} className="transition-transform group-hover:-translate-x-1" aria-hidden />
            </button>
          </div>

          <div className="relative rounded-3xl border border-stroke bg-white/90 p-4 shadow-nuwa-md sm:p-6">
            <div className="mb-4 flex items-center justify-between gap-3 rounded-2xl bg-nuwa-deep p-5 text-white sm:p-6">
              <div>
                <p className="text-sm text-white/70">مساحة واحدة</p>
                <h3 className="mt-1 text-xl font-bold sm:text-2xl">لكل خطوة في تعلّمك</h3>
              </div>
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-white">
                <BookOpen size={24} aria-hidden />
              </span>
            </div>
            <div className="space-y-3">
              {platformBenefits.map(({ icon: Icon, title, description }, index) => (
                <article
                  key={title}
                  className="flex items-start gap-4 rounded-2xl border border-stroke bg-surface p-4 sm:p-5"
                >
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-nuwa-soft text-nuwa-base">
                    <Icon size={21} aria-hidden />
                  </span>
                  <div>
                    <p className="mb-1 text-xs font-semibold text-nuwa-base">0{index + 1}</p>
                    <h3 className="font-semibold text-ink">{title}</h3>
                    <p className="mt-1 text-sm leading-6 text-ink-muted">{description}</p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
