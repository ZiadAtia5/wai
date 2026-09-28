import {
  ArrowRight,
  BookOpen,
  GraduationCap,
  Mail,
  Search,
  Sparkles,
  UserCheck,
  Users,
} from "lucide-react";
import { useCallback, useState } from "react";

import { getPublicTeachers } from "../../api/catalog";
import { resolveApiAssetUrl } from "../../api/client";
import ApiQueryState from "../../components/ApiQueryState";
import { Reveal } from "./Reveal";
import { useApiQuery } from "../../hooks/useApiQuery";
import type { NavigateFn } from "../../types";

// Wavy background element matching the theme style
function CatalogGridPattern() {
  return (
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
  );
}

export default function TeachersPage({
  navigate,
  embedded = false,
}: {
  navigate: NavigateFn;
  embedded?: boolean;
}) {
  const [reloadKey, setReloadKey] = useState(0);
  const [searchTerm, setSearchTerm] = useState("");

  // API Call - standard catalog loader
  const loadTeachers = useCallback(() => getPublicTeachers(1, 50), []);
  const { data, error, loading } = useApiQuery(loadTeachers, reloadKey);

  const teachersList = (data?.items ?? []).map(toTeacherCard).filter(
    (teacher): teacher is TeacherCardModel => teacher !== null,
  );

  const filteredTeachers = teachersList.filter((teacher) => {
    const query = searchTerm.toLowerCase().trim();
    return (
      teacher.fullName.toLowerCase().includes(query) ||
      teacher.email.toLowerCase().includes(query) ||
      teacher.bio.toLowerCase().includes(query)
    );
  });

  return (
    <div className={`page-ambient bg-canvas ${embedded ? "" : "min-h-[calc(100dvh-10rem)]"}`}>
      {/* ───────────── Header Hero Section ───────────── */}
      {!embedded && <section className="relative overflow-hidden border-b border-stroke bg-surface">
        <CatalogGridPattern />

        <div className="relative mx-auto max-w-360 px-6 py-12 md:px-10 md:py-16">
          <Reveal>
            <button
              onClick={() => navigate("landing")}
              className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-ink-muted transition-colors hover:text-nuwa-base"
            >
              <ArrowRight size={16} />
              العودة للرئيسية
            </button>
          </Reveal>

          <div className="grid gap-8 md:grid-cols-2 md:items-center">
            <div>
              <Reveal delay={0.05}>
                <p className="mb-3 inline-flex items-center gap-2 text-sm font-semibold text-nuwa-base">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-nuwa-base opacity-60" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-nuwa-base" />
                  </span>
                  النخبة التعليمية
                </p>
              </Reveal>

              <Reveal delay={0.1}>
                <h1 className="mb-4 text-3xl font-bold leading-tight text-nuwa-deep md:text-4xl">
                  المعلمون والخبراء
                </h1>
              </Reveal>

              <Reveal delay={0.15}>
                <p className="max-w-xl leading-relaxed text-ink-muted">
                  نُخبة من أفضل المعلمين والأكاديميين المكرسين لنقل الخبرة
                  والمعرفة إليك مباشرة عبر منصة وَعي.
                </p>
              </Reveal>
            </div>

            {/* Quick Stats Panel */}
            <Reveal delay={0.15}>
              <div className="rounded-xl border border-stroke bg-white p-5 shadow-sm md:p-6">
                <div className="flex items-center justify-between border-b border-stroke pb-4">
                  <div className="flex items-center gap-2">
                    <Users size={18} className="text-nuwa-base" />
                    <span className="font-semibold text-ink">
                      إحصائيات الكادر
                    </span>
                  </div>
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-stroke bg-canvas px-2.5 py-1 text-xs text-ink-muted">
                    <Sparkles size={12} className="text-nuwa-base" />
                    معتمدون
                  </span>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-4">
                  <div className="border-t-2 border-nuwa-base pt-3">
                    <dt className="text-xs text-ink-muted">إجمالي المعلمين</dt>
                    <dd className="mt-1 text-2xl font-bold text-ink">
                      {data?.totalCount ?? "—"}
                    </dd>
                  </div>
                  <div className="border-t-2 border-nuwa-base pt-3">
                    <dt className="text-xs text-ink-muted">المواد المتاحة</dt>
                    <dd className="mt-1 text-2xl font-bold text-ink">نشطة</dd>
                  </div>
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </section>}

      {/* ───────────── Search & Filter Controls ───────────── */}
      <section className="mx-auto max-w-360 px-6 pt-8 md:px-10">
        <Reveal delay={0.2}>
          {embedded && (
            <div className="mb-6">
              <p className="mb-2 text-sm font-semibold text-nuwa-base">المعلمون</p>
              <h2 className="text-2xl font-bold text-nuwa-deep md:text-3xl">
                تعرّف على معلمي وَعي
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-7 text-ink-muted">
                استكشف ملفات المعلمين وخبراتهم، وابحث عمّن يناسب أهدافك التعليمية.
              </p>
            </div>
          )}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative flex-1 max-w-md">
              <Search
                size={18}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-ink-muted"
              />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="ابحث عن معلم بالأسم أو التخصص..."
                className="h-11 w-full rounded-lg border border-stroke bg-white pr-10 pl-4 text-sm text-ink outline-none transition-colors placeholder:text-ink-muted focus:border-nuwa-base focus:ring-1 focus:ring-nuwa-base"
              />
            </div>

            <div className="flex items-center gap-2 text-xs text-ink-muted">
              <span>عرض:</span>
              <span className="font-semibold text-ink">
                {filteredTeachers.length} معلم
              </span>
            </div>
          </div>
        </Reveal>
      </section>

      {/* ───────────── Content / Grid Section ───────────── */}
      <section className="mx-auto max-w-360 px-6 py-8 md:px-10 md:py-12">
        <ApiQueryState
          loading={loading}
          error={error}
          isEmpty={filteredTeachers.length === 0}
          emptyMessage="لم يتم العثور على معلمين يطابقون بحثك."
          onRetry={() => setReloadKey((key) => key + 1)}
        >
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {filteredTeachers.map((teacher, index) => (
              <Reveal key={teacher.id || index} delay={(index % 6) * 0.05}>
                <TeacherCard teacher={teacher} navigate={navigate} />
              </Reveal>
            ))}
          </div>
        </ApiQueryState>
      </section>
    </div>
  );
}

/* ───────────── Components ───────────── */

interface TeacherCardProps {
  teacher: TeacherCardModel;
  navigate: NavigateFn;
}

interface TeacherCardModel {
    id: string | number;
    fullName: string;
    email: string;
    bio: string;
    avatarUrl?: string;
    courseCount?: number;
    studentCount?: number;
}

function toTeacherCard(value: unknown, index: number): TeacherCardModel | null {
  if (typeof value !== "object" || value === null) return null;
  const record = value as Record<string, unknown>;
  const text = (...keys: string[]) => {
    for (const key of keys) {
      const candidate = record[key];
      if (typeof candidate === "string" && candidate.trim()) return candidate.trim();
    }
    return "";
  };
  const firstName = text("firstName", "givenName");
  const lastName = text("lastName", "familyName");
  const avatarPath = text("avatarUrl", "profileImageUrl", "imageUrl");
  const id = record.id;
  return {
    id: typeof id === "string" || typeof id === "number" ? id : index,
    fullName: text("fullName", "teacherName", "name", "arabicName") || `${firstName} ${lastName}`.trim() || "معلم بـ منصة وَعي",
    email: text("email"),
    bio: text("bio", "description", "about"),
    avatarUrl: avatarPath ? resolveApiAssetUrl(avatarPath) : undefined,
    courseCount: typeof record.courseCount === "number" ? record.courseCount : undefined,
    studentCount: typeof record.studentCount === "number" ? record.studentCount : undefined,
  };
}

function TeacherCard({ teacher, navigate }: TeacherCardProps) {
  const fullName = teacher.fullName;

  const initials = fullName
    .split(" ")
    .slice(0, 2)
    .map((n) => n[0])
    .join("");

  return (
    <div className="group relative flex flex-col justify-between overflow-hidden rounded-xl border border-stroke bg-white p-6 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-nuwa-base hover:shadow-md">
      <div>
        {/* Header Avatar & Status */}
        <div className="mb-4 flex items-start justify-between">
          <div className="relative">
            {teacher.avatarUrl ? (
              <img
                src={teacher.avatarUrl}
                alt={fullName}
                className="h-14 w-14 rounded-full border border-stroke object-cover"
              />
            ) : (
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-canvas text-base font-bold text-nuwa-base border border-stroke">
                {initials || <UserCheck size={20} />}
              </div>
            )}
            <span
              className="absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full border-2 border-white bg-emerald-500"
              title="معلم معتمد"
            />
          </div>

          <span className="inline-flex items-center gap-1 rounded-md border border-stroke bg-canvas px-2.5 py-1 text-xs font-medium text-ink-muted">
            <GraduationCap size={13} className="text-nuwa-base" />
            معلم
          </span>
        </div>

        {/* Teacher Info */}
        <h3 className="mb-1 text-lg font-bold text-ink transition-colors group-hover:text-nuwa-base">
          {fullName}
        </h3>

        {teacher.email && (
          <p className="mb-3 inline-flex items-center gap-1.5 text-xs text-ink-muted dir-ltr">
            <Mail size={12} className="text-stroke" />
            {teacher.email}
          </p>
        )}

        <p className="mb-6 line-clamp-2 text-xs leading-relaxed text-ink-muted">
          {teacher.bio ||
            "نخبة من خيرة الكوادر الأكاديمية المعتمدة لتقديم أفضل تجربة تعليمية ومتابعة مستمرة للطلاب."}
        </p>
      </div>

      {/* Footer / Meta Info & Actions */}
      <div className="border-t border-stroke pt-4">
        <div className="mb-4 grid grid-cols-2 gap-2 text-center text-xs">
          <div className="rounded-lg bg-canvas p-2">
            <span className="block text-ink-muted">الدورات</span>
            <span className="font-semibold text-ink">
              {teacher.courseCount ?? "—"}
            </span>
          </div>
          <div className="rounded-lg bg-canvas p-2">
            <span className="block text-ink-muted">الطلاب</span>
            <span className="font-semibold text-ink">
              {teacher.studentCount ?? "—"}
            </span>
          </div>
        </div>

        <button
          onClick={() => navigate("public:teachers")}
          className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-lg bg-canvas font-medium text-xs text-ink transition-colors group-hover:bg-nuwa-base group-hover:text-white"
        >
          <BookOpen size={14} />
          عرض الملف والدورات
        </button>
      </div>
    </div>
  );
}
