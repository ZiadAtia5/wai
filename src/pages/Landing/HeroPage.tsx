import {
  ArrowLeft,
  BookOpen,
  GraduationCap,
  Users,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";

import { getPublicCourses, getPublicTeachers } from "../../api/catalog";
import ApiQueryState from "../../components/ApiQueryState";
import { useApiQuery } from "../../hooks/useApiQuery";
import type { NavigateFn } from "../../types";

async function loadCatalogSummary() {
  const [courses, teachers] = await Promise.all([
    getPublicCourses(1, 1),
    getPublicTeachers(1, 1),
    // TODO: أضف endpoint عدد الطلاب هنا، مثلاً getPublicStudents(1, 1)
  ]);

  return {
    courseCount: courses.totalCount,
    teacherCount: teachers.totalCount,
    // null لحد ما يتوصل بـ API حقيقي (بيظهر "—" بدل رقم وهمي)
    studentCount: null as number | null,
  };
}

/* ───────────── Motion helpers (CSS + IntersectionObserver) ───────────── */

function usePrefersReducedMotion() {
  const [reduce, setReduce] = useState(false);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduce(query.matches);
    const onChange = (event: MediaQueryListEvent) => setReduce(event.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  return reduce;
}

function useInViewOnce<T extends Element>(margin = "-40px") {
  const ref = useRef<T>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (typeof IntersectionObserver === "undefined") {
      setInView(true);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          observer.disconnect();
        }
      },
      { rootMargin: margin },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [margin]);

  return { ref, inView };
}

function Reveal({
  children,
  delay = 0,
  className,
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  const { ref, inView } = useInViewOnce<HTMLDivElement>();
  const reduce = usePrefersReducedMotion();
  const shown = inView || reduce;

  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: shown ? 1 : 0,
        filter: shown ? "blur(0px)" : "blur(8px)",
        transition: reduce
          ? "none"
          : `opacity 450ms ease-out ${delay}s, filter 450ms ease-out ${delay}s`,
      }}
    >
      {children}
    </div>
  );
}

function CountUp({ value }: { value: number }) {
  const { ref, inView } = useInViewOnce<HTMLSpanElement>("0px");
  const reduce = usePrefersReducedMotion();
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (reduce) {
      setDisplay(value);
      return;
    }
    if (!inView) return;

    const duration = 900;
    const startTime = performance.now();
    let frame = 0;

    const tick = (now: number) => {
      const progress = Math.min((now - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(value * eased));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [inView, value, reduce]);

  return <span ref={ref}>{display.toLocaleString("ar-EG")}</span>;
}

/* ───────────── Page ───────────── */

export default function LandingPage({ navigate }: { navigate: NavigateFn }) {
  const [reloadKey, setReloadKey] = useState(0);
  const { data, error, loading } = useApiQuery(loadCatalogSummary, reloadKey);

  const stats: StatItemProps[] = [
    { icon: GraduationCap, label: "الطلاب", value: data?.studentCount ?? null },
    { icon: Users, label: "المعلمون", value: data?.teacherCount ?? null },
    { icon: BookOpen, label: "الدورات", value: data?.courseCount ?? null },
  ];

  const maxValue = Math.max(0, ...stats.map((stat) => stat.value ?? 0));

  return (
    <div className="bg-canvas">
      <section className="page-ambient relative flex min-h-[calc(100svh-4rem)] items-center overflow-hidden border-b border-stroke bg-surface">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              "radial-gradient(circle at 1px 1px, var(--color-stroke, #e5e7eb) 1px, transparent 0)",
            backgroundSize: "24px 24px",
            maskImage:
              "radial-gradient(ellipse at 25% 40%, black 0%, transparent 70%)",
            WebkitMaskImage:
              "radial-gradient(ellipse at 25% 40%, black 0%, transparent 70%)",
          }}
        />

        <div className="relative mx-auto grid w-full max-w-360 items-center gap-10 px-6 py-12 sm:px-8 md:grid-cols-2 md:gap-14 md:px-10 md:py-16">
          <div>
            <Reveal>
              <p className="mb-4 inline-flex items-center gap-2 text-sm lg:text-xl font-semibold text-nuwa-base">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-nuwa-base opacity-60" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-nuwa-base" />
                </span>
                منصة وَعي التعليمية
              </p>
            </Reveal>

            <Reveal delay={0.07}>
              <h1 className="mb-4 text-3xl font-bold leading-tight text-nuwa-deep md:text-4xl lg:text-5xl">
                المعرفة تبدأ من وَعي
              </h1>
            </Reveal>

            <Reveal delay={0.14}>
              <p className="mb-8 max-w-xl leading-relaxed text-ink-muted">
                تصفح الدورات والمعلمين المتاحين مباشرة من المنصة.
              </p>
            </Reveal>

            <Reveal delay={0.21}>
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={() => navigate("public:courses")}
                  className="group inline-flex h-11 items-center gap-2 rounded-lg bg-nuwa-base px-5 font-medium text-white transition-colors hover:bg-nuwa-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-nuwa-base"
                >
                  <BookOpen size={17} />
                  تصفح الدورات
                  <ArrowLeft
                    size={16}
                    className="transition-transform group-hover:-translate-x-1"
                  />
                </button>
                <button
                  onClick={() => navigate("public:teachers")}
                  className="inline-flex h-11 items-center gap-2 rounded-lg border border-stroke bg-white px-5 font-medium text-ink transition-colors hover:border-nuwa-base focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-nuwa-base"
                >
                  <Users size={17} />
                  المعلمون
                </button>
                <a
                  href="#about-platform"
                  className="inline-flex h-11 items-center rounded-lg px-3 font-medium text-nuwa-base transition-colors hover:bg-nuwa-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-nuwa-base"
                >
                  عن المنصة
                </a>
              </div>
            </Reveal>
          </div>

          <Reveal delay={0.14}>
            <div className="mx-auto w-full max-w-xl overflow-hidden rounded-xl border border-stroke bg-white shadow-sm">
              <div className="flex h-11 items-center justify-between border-b border-stroke px-4">
                <div className="flex items-center gap-3">
                  <span aria-hidden className="flex gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57] shadow-[inset_0_0_0_1px_rgba(0,0,0,0.12)]" />
                    <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e] shadow-[inset_0_0_0_1px_rgba(0,0,0,0.12)]" />
                    <span className="h-2.5 w-2.5 rounded-full bg-[#28c840] shadow-[inset_0_0_0_1px_rgba(0,0,0,0.12)]" />
                  </span>
                  <span className="text-sm font-semibold text-ink">
                    لوحة المنصة
                  </span>
                </div>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-stroke bg-canvas px-2.5 py-1 text-xs text-ink-muted">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-nuwa-base opacity-60" />
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-nuwa-base" />
                  </span>
                  مباشر
                </span>
              </div>

              <div className="bg-linear-to-b from-white to-canvas/50 p-5 md:p-6">
                <ApiQueryState
                  loading={loading}
                  error={error}
                  isEmpty={false}
                  emptyMessage=""
                  onRetry={() => setReloadKey((key) => key + 1)}
                >
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-medium text-ink-muted">نظرة عامة</p>
                      <h3 className="mt-0.5 font-bold text-ink">مؤشرات المنصة</h3>
                    </div>
                    <span className="inline-flex items-center gap-2 rounded-full border border-success-light bg-success-light px-3 py-1.5 text-xs font-semibold text-success">
                      <span className="h-1.5 w-1.5 rounded-full bg-success" />
                      بيانات مباشرة
                    </span>
                  </div>

                  <dl className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                    {stats.map((stat) => (
                      <StatItem key={stat.label} {...stat} />
                    ))}
                  </dl>

                  <div className="mt-5 rounded-xl border border-stroke bg-white p-4">
                    <h3 className="mb-4 text-sm font-semibold text-ink">
                      المحتوى المنشور
                    </h3>
                    <div className="space-y-4">
                      {stats.filter((stat) => stat.value !== null).map((stat) => (
                        <BarRow
                          key={stat.label}
                          label={stat.label}
                          value={stat.value}
                          max={maxValue}
                        />
                      ))}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => navigate("public:courses")}
                    className="group mt-4 inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-nuwa-soft text-sm font-semibold text-nuwa-base transition-colors hover:bg-nuwa-base hover:text-white"
                  >
                    استكشف المنصة
                    <ArrowLeft size={15} className="transition-transform group-hover:-translate-x-1" aria-hidden />
                  </button>
                </ApiQueryState>
              </div>
            </div>
          </Reveal>
        </div>
      </section>
    </div>
  );
}

/* ───────────── Pieces ───────────── */

interface StatItemProps {
  icon: LucideIcon;
  label: string;
  value: number | null;
}

function StatItem({ icon: Icon, label, value }: StatItemProps) {
  return (
    <div className="min-w-0 rounded-xl border border-stroke bg-white p-3 sm:p-3.5">
      <div className="mb-3 flex items-center justify-between gap-2 text-ink-muted">
        <dt className="truncate text-xs">{label}</dt>
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-nuwa-soft text-nuwa-base">
          <Icon size={16} aria-hidden />
        </span>
      </div>
      <dd className="text-xl font-bold leading-none text-ink sm:text-2xl">
        {value === null ? "—" : <CountUp value={value} />}
      </dd>
    </div>
  );
}

function BarRow({
  label,
  value,
  max,
}: {
  label: string;
  value: number | null;
  max: number;
}) {
  const { ref, inView } = useInViewOnce<HTMLDivElement>("0px");
  const reduce = usePrefersReducedMotion();
  const target =
    value === null || max === 0 ? 0 : Math.max(4, (value / max) * 100);
  const width = inView || reduce ? target : 0;

  return (
    <div ref={ref}>
      <div className="mb-1.5 flex items-center justify-between text-xs">
        <span className="text-ink-muted">{label}</span>
        <span className="font-semibold text-ink">
          {value === null ? "—" : value.toLocaleString("ar-EG")}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-canvas">
        <div
          className="h-full rounded-full bg-nuwa-base"
          style={{
            width: `${width}%`,
            transition: reduce ? "none" : "width 700ms ease-out",
          }}
        />
      </div>
    </div>
  );
}
