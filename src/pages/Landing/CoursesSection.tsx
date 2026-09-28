import { ArrowLeft, BookOpen, GraduationCap, Sparkles } from "lucide-react";
import { useState } from "react";

import { getPublicCourses } from "../../api/catalog";
import ApiQueryState from "../../components/ApiQueryState";
import { Reveal } from "./Reveal";
import { useApiQuery } from "../../hooks/useApiQuery";
import type { NavigateFn } from "../../types";

/* ───────────── Data adapter ─────────────
 * كل ما يخص شكل بيانات الكورس في مكان واحد.
 * لو أسماء الحقول عندك مختلفة، عدّل الدالة toCourseCard فقط.
 */

const PAGE_SIZE = 6;

interface CourseCardModel {
  id: string | number;
  title: string;
  description?: string;
  teacherName?: string;
  subjectName?: string;
  yearName?: string;
  price?: number;
  imageUrl?: string;
}

type Rec = Record<string, unknown>;

const isRec = (value: unknown): value is Rec =>
  typeof value === "object" && value !== null;

function pickString(record: Rec, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return undefined;
}

function toCourseCard(raw: Rec, index: number): CourseCardModel | null {
  const title = pickString(raw, ["title", "name", "arabicName", "courseName"]);
  if (!title) return null;

  const teacher = isRec(raw.teacher) ? raw.teacher : undefined;
  const year = isRec(raw.academicYear) ? raw.academicYear : undefined;

  return {
    id:
      typeof raw.id === "string" || typeof raw.id === "number" ? raw.id : index,
    title,
    description: pickString(raw, [
      "description",
      "summary",
      "shortDescription",
    ]),
    teacherName:
      pickString(raw, ["teacherName", "teacherFullName"]) ??
      (teacher && pickString(teacher, ["fullName", "name", "arabicName"])),
    subjectName: pickString(raw, ["subjectName", "subjectArabicName"]),
    yearName:
      pickString(raw, ["academicYearName", "academicYearArabicName"]) ??
      (year && pickString(year, ["arabicName", "name"])),
    price: typeof raw.price === "number" ? raw.price : undefined,
    imageUrl: pickString(raw, [
      "thumbnailUrl",
      "imageUrl",
      "coverImageUrl",
      "coverUrl",
      "image",
    ]),
  };
}

async function loadCourses() {
  const page = await getPublicCourses(1, PAGE_SIZE);
  const raw = page as unknown as Rec;
  const list = [raw.items, raw.data, raw.courses, raw.results].find(
    Array.isArray,
  ) as unknown[] | undefined;

  const courses = (list ?? [])
    .filter(isRec)
    .map(toCourseCard)
    .filter((course): course is CourseCardModel => course !== null);

  return { courses, totalCount: page.totalCount };
}

/* ───────────── Component ───────────── */

export default function CoursesShowcase({
  navigate,
}: {
  navigate: NavigateFn;
}) {
  const [reloadKey, setReloadKey] = useState(0);
  const { data, error, loading } = useApiQuery(loadCourses, reloadKey);

  return (
    <section className="page-ambient border-b border-stroke bg-canvas">
      <header className="relative overflow-hidden border-b border-stroke bg-surface">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              "radial-gradient(circle at 1px 1px, var(--color-stroke, #e5e7eb) 1px, transparent 0)",
            backgroundSize: "24px 24px",
            maskImage: "radial-gradient(ellipse at 75% 45%, black 0%, transparent 72%)",
            WebkitMaskImage: "radial-gradient(ellipse at 75% 45%, black 0%, transparent 72%)",
          }}
        />
        <div className="relative mx-auto grid max-w-360 gap-8 px-6 py-12 sm:px-8 md:grid-cols-2 md:items-center md:gap-12 md:px-10 md:py-16">
          <Reveal>
            <div>
              <p className="mb-3 inline-flex items-center gap-2 text-sm font-semibold text-nuwa-base">
                <BookOpen size={16} aria-hidden />
                مكتبة وَعي التعليمية
              </p>
              <h2 className="text-3xl font-bold leading-tight text-nuwa-deep md:text-4xl">
                دورات تصنع خطوتك التالية
              </h2>
              <p className="mt-4 max-w-xl leading-8 text-ink-muted">
                تصفّح الدورات المتاحة، تعرّف على محتواها ومعلميها، واختر المسار
                الذي ينسجم مع أهدافك التعليمية.
              </p>
              <button
                onClick={() => navigate("public:courses")}
                className="group mt-6 inline-flex h-11 items-center gap-2 rounded-lg bg-nuwa-base px-5 font-medium text-white transition-colors hover:bg-nuwa-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-nuwa-base"
              >
                {data && data.totalCount > 0
                  ? `استكشف كل الدورات (${data.totalCount.toLocaleString("ar-EG")})`
                  : "استكشف كل الدورات"}
                <ArrowLeft size={16} className="transition-transform group-hover:-translate-x-1" />
              </button>
            </div>
          </Reveal>

          <Reveal delay={0.12}>
            <div className="rounded-2xl border border-stroke bg-white p-5 shadow-nuwa-md sm:p-6">
              <div className="flex items-center justify-between gap-3 border-b border-stroke pb-4">
                <div className="flex items-center gap-3">
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-nuwa-soft text-nuwa-base">
                    <GraduationCap size={22} aria-hidden />
                  </span>
                  <div>
                    <h3 className="font-semibold text-ink">تعلّم على طريقتك</h3>
                    <p className="mt-0.5 text-xs text-ink-muted">اختر الدورة المناسبة لك</p>
                  </div>
                </div>
                <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-stroke bg-canvas px-2.5 py-1 text-xs text-ink-muted">
                  <Sparkles size={13} className="text-nuwa-base" aria-hidden />
                  محتوى متجدد
                </span>
              </div>
              <div className="mt-5 grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-canvas p-4">
                  <p className="text-xs text-ink-muted">الدورات المنشورة</p>
                  <p className="mt-1 text-2xl font-bold text-nuwa-deep">
                    {loading ? "…" : data?.totalCount.toLocaleString("ar-EG") ?? "—"}
                  </p>
                </div>
                <div className="rounded-xl bg-canvas p-4">
                  <p className="text-xs text-ink-muted">طريقة التصفح</p>
                  <p className="mt-1 text-lg font-bold text-nuwa-deep">بكل سهولة</p>
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </header>

      <div className="mx-auto max-w-360 px-6 py-10 sm:px-8 md:px-10 md:py-14">
        <div className="mb-7 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="mb-1 text-sm font-semibold text-nuwa-base">ابدأ التعلّم</p>
            <h3 className="text-xl font-bold text-nuwa-deep md:text-2xl">
              أحدث الدورات على المنصة
            </h3>
          </div>
          <button
            onClick={() => navigate("public:courses")}
            className="inline-flex min-h-10 items-center gap-2 rounded-lg px-3 text-sm font-medium text-nuwa-base transition-colors hover:bg-nuwa-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-nuwa-base"
          >
            عرض الكتالوج
            <ArrowLeft size={16} aria-hidden />
          </button>
        </div>
        <ApiQueryState
          loading={loading}
          error={error}
          isEmpty={!!data && data.courses.length === 0}
          emptyMessage="لا توجد دورات منشورة حاليًا."
          onRetry={() => setReloadKey((key) => key + 1)}
        >
          <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {data?.courses.map((course, index) => (
              <li key={course.id}>
                <Reveal delay={(index % 3) * 0.07}>
                  <CourseCard
                    course={course}
                    onOpen={() =>
                      navigate(`public:course:${encodeURIComponent(String(course.id))}`)
                    }
                  />
                </Reveal>
              </li>
            ))}
          </ul>
        </ApiQueryState>
      </div>
    </section>
  );
}

/* ───────────── Card ───────────── */

function CourseCard({
  course,
  onOpen,
}: {
  course: CourseCardModel;
  onOpen: () => void;
}) {
  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-xl border border-stroke bg-white transition-colors hover:border-nuwa-base">
      {/* الغلاف */}
      <div className="relative h-40 overflow-hidden border-b border-stroke bg-canvas">
        {course.imageUrl ? (
          <img
            src={course.imageUrl}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover"
          />
        ) : (
          <>
            <div
              aria-hidden
              className="absolute inset-0"
              style={{
                backgroundImage:
                  "radial-gradient(circle at 1px 1px, var(--color-stroke, #e5e7eb) 1px, transparent 0)",
                backgroundSize: "18px 18px",
              }}
            />
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="flex h-16 w-16 items-center justify-center rounded-xl border border-stroke bg-white text-nuwa-base shadow-sm">
                <BookOpen size={28} aria-hidden />
              </span>
            </div>
          </>
        )}

        {course.yearName && (
          <span className="absolute start-3 top-3 inline-flex items-center gap-1.5 rounded-md border border-stroke bg-white/95 px-2.5 py-1 text-xs font-medium text-nuwa-deep backdrop-blur-sm">
            <GraduationCap size={13} aria-hidden />
            {course.yearName}
          </span>
        )}
      </div>

      {/* المحتوى */}
      <div className="flex flex-1 flex-col p-5">
        <h3 className="mb-2 line-clamp-2 text-base font-semibold leading-snug text-ink">
          {course.title}
        </h3>
        {course.description && (
          <p className="mb-5 line-clamp-2 text-sm leading-relaxed text-ink-muted">
            {course.description}
          </p>
        )}
        {course.subjectName && (
          <span className="mb-4 w-fit rounded-md bg-nuwa-soft px-2.5 py-1 text-xs font-medium text-nuwa-deep">
            {course.subjectName}
          </span>
        )}

        <div className="mt-auto flex items-center justify-between gap-3 border-t border-stroke pt-4">
          <div className="flex min-w-0 items-center gap-2.5">
            {course.teacherName && (
              <>
                <span
                  aria-hidden
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-nuwa-base/10 text-xs font-bold text-nuwa-deep"
                >
                  {course.teacherName.charAt(0)}
                </span>
                <span className="truncate text-sm text-ink-muted">
                  {course.teacherName}
                </span>
              </>
            )}
            {!course.teacherName && typeof course.price === "number" && (
              <PriceTag price={course.price} />
            )}
          </div>

          <div className="flex shrink-0 items-center gap-3">
            {course.teacherName && typeof course.price === "number" && (
              <PriceTag price={course.price} />
            )}
            <button
              onClick={onOpen}
              aria-label={`عرض ${course.title}`}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-stroke text-ink-muted transition-colors hover:border-nuwa-base hover:bg-nuwa-base hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-nuwa-base"
            >
              <ArrowLeft size={16} />
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}

function PriceTag({ price }: { price: number }) {
  return (
    <span className="text-sm font-bold text-nuwa-deep">
      {price === 0 ? "مجانية" : `${price.toLocaleString("ar-EG")} ج.م`}
    </span>
  );
}
