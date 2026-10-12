import {
  ArrowLeft,
  ArrowUpLeft,
  BookOpen,
  Check,
  GraduationCap,
  Play,
  Sparkles,
  Users,
} from "lucide-react"
import { useState } from "react"

import {
  getAcademicYears,
  getPublicCourses,
  getPublicTeachers,
} from "../api/catalog"
import ApiQueryState from "../components/ApiQueryState"
import { useApiQuery } from "../hooks/useApiQuery"
import type { NavigateFn } from "../types"

async function loadCatalogSummary() {
  const [courses, teachers, academicYears, featured] = await Promise.all([
    getPublicCourses(1, 1),
    getPublicTeachers(1, 1),
    getAcademicYears(),
    getPublicCourses(1, 3),
  ])
  return {
    courseCount: courses.totalCount,
    teacherCount: teachers.totalCount,
    academicYears,
    featured: featured.items,
  }
}

function record(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null
    ? value as Record<string, unknown>
    : {}
}

export default function LandingPage({ navigate }: { navigate: NavigateFn }) {
  const [reloadKey, setReloadKey] = useState(0)
  const { data, error, loading } = useApiQuery(loadCatalogSummary, reloadKey)

  return (
    <div className="overflow-hidden bg-canvas">
      <section className="relative isolate bg-[#0b2742] text-white">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_82%_30%,rgba(35,136,217,.34),transparent_38%),radial-gradient(ellipse_at_8%_90%,rgba(23,105,170,.25),transparent_35%)]" />
        <div className="mx-auto grid max-w-7xl items-center gap-12 px-5 py-16 sm:px-8 md:min-h-[570px] md:grid-cols-[1.08fr_.92fr] md:py-24">
          <div>
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3.5 py-1.5 text-sm text-sky-100">
              <Sparkles size={15} /> تعليم يفتح لك آفاقاً جديدة
            </div>
            <h1 className="max-w-2xl text-4xl font-bold leading-[1.35] tracking-tight sm:text-5xl md:text-[3.55rem]">
              طريقك إلى التفوق
              <br />
              <span className="text-sky-300">يبدأ من هنا</span>
            </h1>
            <p className="mt-6 max-w-xl text-base leading-8 text-slate-300 sm:text-lg">
              اكتشف دورات تعليمية يقدمها معلمون متخصصون، وتعلّم بالوتيرة التي
              تناسبك مع متابعة واضحة لتقدمك.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <button
                onClick={() => navigate("public:courses")}
                className="inline-flex h-12 items-center gap-2 rounded-xl bg-sky-400 px-5 font-semibold text-[#09233d] shadow-lg shadow-sky-950/20 transition hover:bg-sky-300"
              >
                اكتشف الدورات <ArrowLeft size={17} />
              </button>
              <button
                onClick={() => navigate("public:teachers")}
                className="inline-flex h-12 items-center gap-2 rounded-xl border border-white/20 bg-white/5 px-5 font-semibold text-white transition hover:bg-white/10"
              >
                <Users size={17} /> تعرف على معلمينا
              </button>
            </div>
            <div className="mt-10 flex flex-wrap gap-x-6 gap-y-3 text-sm text-slate-300">
              <span className="inline-flex items-center gap-2">
                <Check size={16} className="text-emerald-300" /> محتوى تعليمي
                منظم
              </span>
              <span className="inline-flex items-center gap-2">
                <Check size={16} className="text-emerald-300" /> متابعة لتقدمك
              </span>
            </div>
          </div>
          <div className="relative mx-auto w-full max-w-[460px]">
            <div className="absolute -inset-5 rounded-[2.5rem] bg-sky-400/10 blur-2xl" />
            <div className="relative rounded-[2rem] border border-white/10 bg-gradient-to-br from-white/10 to-white/[.03] p-5 shadow-2xl backdrop-blur sm:p-7">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-300">مساحة تعلمك</p>
                  <p className="mt-1 text-xl font-semibold">ابدأ بخطوة اليوم</p>
                </div>
                <div className="grid size-12 place-items-center rounded-2xl bg-sky-300/15 text-sky-200">
                  <GraduationCap size={25} />
                </div>
              </div>
              <div className="my-6 rounded-2xl border border-white/10 bg-[#071d32]/70 p-5">
                <div className="flex items-center gap-3">
                  <div className="grid size-11 place-items-center rounded-xl bg-sky-300 text-[#09233d]">
                    <BookOpen size={21} />
                  </div>
                  <div>
                    <p className="font-semibold">تعلّم بأسلوبك</p>
                    <p className="text-sm text-slate-400">
                      دروس وموارد واختبارات
                    </p>
                  </div>
                  <Play size={16} className="ms-auto text-sky-200" />
                </div>
                <div className="mt-5 h-2 overflow-hidden rounded-full bg-white/10">
                  <div className="h-full w-2/3 rounded-full bg-gradient-to-l from-sky-300 to-cyan-200" />
                </div>
                <div className="mt-2 flex justify-between text-xs text-slate-400">
                  <span>تقدمك يتحدث مع كل درس</span>
                  <span>●</span>
                </div>
              </div>
              <ApiQueryState
                loading={loading}
                error={error}
                isEmpty={false}
                emptyMessage=""
                onRetry={() => setReloadKey((key) => key + 1)}
              >
                {data && (
                  <div className="grid grid-cols-2 gap-3">
                    <Stat
                      icon={<BookOpen size={17} />}
                      label="دورة متاحة"
                      value={data.courseCount}
                    />
                    <Stat
                      icon={<Users size={17} />}
                      label="معلم"
                      value={data.teacherCount}
                    />
                  </div>
                )}
              </ApiQueryState>
            </div>
            <div className="absolute -bottom-5 -left-3 hidden items-center gap-2 rounded-xl border border-white/10 bg-[#123b5b] px-4 py-3 text-sm shadow-xl sm:flex">
              <span className="grid size-8 place-items-center rounded-lg bg-emerald-300/15 text-emerald-200">
                <Check size={17} />
              </span>
              <span>تعلّم، تقدّم، وأنجز</span>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-14 sm:px-8 md:py-20">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-nuwa-base">
              تعلم يناسب مرحلتك
            </p>
            <h2 className="mt-2 text-2xl font-bold text-ink sm:text-3xl">
              صفك الدراسي، خطوتك القادمة
            </h2>
          </div>
          <p className="max-w-lg text-sm leading-7 text-ink-muted">
            اختر صفك واستكشف ما أعده المعلمون لك من دورات ومحتوى تعليمي.
          </p>
        </div>
        <ApiQueryState
          loading={loading}
          error={error}
          isEmpty={false}
          emptyMessage=""
          onRetry={() => setReloadKey((key) => key + 1)}
        >
          {data && (
            <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {data.academicYears.map((year, index) => (
                <button
                  key={year.id}
                  onClick={() => navigate("public:courses")}
                  className="group flex items-center gap-4 rounded-2xl border border-stroke bg-white p-5 text-start shadow-sm transition hover:-translate-y-0.5 hover:border-sky-300 hover:shadow-nuwa-md"
                >
                  <span
                    className={`grid size-12 place-items-center rounded-xl ${
                      index % 2
                        ? "bg-violet-50 text-violet-700"
                        : "bg-sky-50 text-nuwa-base"
                    }`}
                  >
                    <GraduationCap size={23} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold text-ink">
                      {year.arabicName}
                    </span>
                    <span className="mt-1 block text-sm text-ink-muted">
                      دورات ومواد تناسب مستواك
                    </span>
                  </span>
                  <ArrowUpLeft
                    size={18}
                    className="text-ink-muted transition group-hover:-translate-x-1 group-hover:translate-y-1 group-hover:text-nuwa-base"
                  />
                </button>
              ))}
            </div>
          )}
        </ApiQueryState>
      </section>

      <section className="bg-white py-14 md:py-20">
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-nuwa-base">
                اختيارات من المنصة
              </p>
              <h2 className="mt-2 text-2xl font-bold text-ink sm:text-3xl">
                دورات تستحق أن تبدأ بها
              </h2>
            </div>
            <button
              onClick={() => navigate("public:courses")}
              className="inline-flex items-center gap-2 text-sm font-semibold text-nuwa-base hover:text-nuwa-deep"
            >
              كل الدورات <ArrowLeft size={16} />
            </button>
          </div>
          <ApiQueryState
            loading={loading}
            error={error}
            isEmpty={Boolean(data && data.featured.length === 0)}
            emptyMessage="لا توجد دورات منشورة حالياً."
            onRetry={() => setReloadKey((key) => key + 1)}
          >
            {data && (
              <div className="mt-8 grid gap-5 md:grid-cols-3">
                {data.featured.map((item, index) => {
                  const course = record(item)
                  return (
                    <article
                      key={String(course.id ?? index)}
                      className="overflow-hidden rounded-2xl border border-stroke bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-nuwa-md"
                    >
                      <div className="relative flex h-40 items-end overflow-hidden bg-gradient-to-br from-[#123b66] via-[#1769aa] to-[#56b5d8] p-5">
                        {typeof course.coverImageUrl === "string" &&
                        course.coverImageUrl ? (
                          <img
                            src={course.coverImageUrl}
                            alt=""
                            className="absolute inset-0 size-full object-cover"
                          />
                        ) : (
                          <>
                            <div className="absolute -left-8 -top-12 size-44 rounded-full border border-white/15" />
                            <div className="absolute -left-1 -top-5 size-28 rounded-full border border-white/15" />
                            <BookOpen
                              className="absolute left-6 top-6 text-white/25"
                              size={45}
                            />
                          </>
                        )}
                        <span className="relative rounded-full bg-white/90 px-3 py-1 text-xs font-semibold text-nuwa-deep">
                          {String(course.academicYear ?? "دورة تعليمية")}
                        </span>
                      </div>
                      <div className="p-5">
                        <h3 className="line-clamp-1 text-lg font-bold text-ink">
                          {String(course.title ?? "دورة تعليمية")}
                        </h3>
                        <p className="mt-2 line-clamp-2 min-h-12 text-sm leading-6 text-ink-muted">
                          {String(
                            course.description ??
                              "محتوى تعليمي منظم يساعدك على التقدم خطوة بخطوة.",
                          )}
                        </p>
                        <div className="mt-4 flex items-center justify-between border-t border-stroke pt-4 text-sm">
                          <span className="text-ink-muted">
                            {String(
                              course.teacherName ??
                                course.subjectName ??
                                "منصة وعي",
                            )}
                          </span>
                          <span className="font-bold text-nuwa-base">
                            {course.price === 0
                              ? "مجانية"
                              : typeof course.price === "number"
                                ? `${course.price} ر.س`
                                : "اكتشف الدورة"}
                          </span>
                        </div>
                      </div>
                    </article>
                  )
                })}
              </div>
            )}
          </ApiQueryState>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 py-14 sm:px-8 md:py-20">
        <div className="grid gap-8 rounded-[2rem] bg-nuwa-soft p-7 sm:p-10 md:grid-cols-[1fr_auto] md:items-center">
          <div>
            <p className="text-sm font-semibold text-nuwa-base">جاهز تبدأ؟</p>
            <h2 className="mt-2 text-2xl font-bold text-ink sm:text-3xl">
              خطوتك الأولى أقرب مما تتصور
            </h2>
            <p className="mt-3 max-w-2xl text-ink-muted">
              أنشئ حسابك، اختر دورتك، وتابع تقدمك في مكان واحد.
            </p>
          </div>
          <button
            onClick={() => navigate("register")}
            className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-nuwa-base px-6 font-semibold text-white transition hover:bg-nuwa-deep"
          >
            أنشئ حساباً الآن <ArrowLeft size={17} />
          </button>
        </div>
      </section>
      <footer className="border-t border-stroke bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-5 py-7 text-sm text-ink-muted sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <span className="font-bold text-nuwa-deep">وَعي التعليمية</span>
          <span>منصة تجمع الطالب والمعلم في رحلة تعلم واحدة.</span>
        </div>
      </footer>
    </div>
  )
}

function Stat({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode
  label: string
  value: number
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[.06] p-3">
      <span className="grid size-9 place-items-center rounded-lg bg-sky-300/15 text-sky-200">
        {icon}
      </span>
      <span>
        <span className="block text-lg font-bold">{value}</span>
        <span className="text-xs text-slate-300">{label}</span>
      </span>
    </div>
  )
}
