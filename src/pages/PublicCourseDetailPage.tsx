import { useCallback, useState } from "react";
import { ArrowRight, BookOpen, CheckCircle2, GraduationCap, UserRound } from "lucide-react";

import { coursesApi } from "../api/endpoints";
import { getAuthToken } from "../api/client";
import ApiQueryState from "../components/ApiQueryState";
import { useApiQuery } from "../hooks/useApiQuery";
import type { NavigateFn } from "../types";

type RecordValue = Record<string, unknown>;

function asRecord(value: unknown): RecordValue | null {
  return typeof value === "object" && value !== null
    ? (value as RecordValue)
    : null;
}

function text(record: RecordValue, ...keys: string[]): string {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number") return String(value);
  }
  return "";
}

export default function PublicCourseDetailPage({
  courseId,
  navigate,
}: {
  courseId: string;
  navigate: NavigateFn;
}) {
  const [reloadKey, setReloadKey] = useState(0);
  const [enrolling, setEnrolling] = useState(false);
  const [message, setMessage] = useState("");
  const loadCourse = useCallback(() => coursesApi.detail(courseId), [courseId]);
  const { data, error, loading } = useApiQuery(loadCourse, reloadKey);
  const wrapper = asRecord(data);
  const course = asRecord(wrapper?.data) ?? wrapper;
  const teacher = asRecord(course?.teacher);
  const modules = Array.isArray(course?.modules) ? course.modules : [];
  const title = course ? text(course, "title", "name", "courseName") : "";

  async function enroll() {
    if (!getAuthToken()) {
      navigate("login");
      return;
    }
    setEnrolling(true);
    setMessage("");
    try {
      await coursesApi.enroll(courseId);
      setMessage("تم إرسال طلب الالتحاق بنجاح.");
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "تعذر إرسال الطلب. حاول مرة أخرى.");
    } finally {
      setEnrolling(false);
    }
  }

  return (
    <div className="page-ambient min-h-[calc(100dvh-10rem)] bg-canvas pb-12">
      <header className="border-b border-stroke bg-surface">
        <div className="mx-auto max-w-360 px-5 py-5 sm:px-8 md:px-10">
          <button
            type="button"
            onClick={() => navigate("public:courses")}
            className="inline-flex h-10 items-center gap-2 rounded-lg px-3 text-sm font-medium text-ink-muted transition-colors hover:bg-nuwa-soft hover:text-nuwa-base"
          >
            <ArrowRight size={17} aria-hidden />
            الرجوع إلى الدورات
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-360 px-5 py-8 sm:px-8 md:px-10 md:py-12">
        <ApiQueryState
          loading={loading}
          error={error}
          isEmpty={!course}
          emptyMessage="لم يتم العثور على هذه الدورة."
          onRetry={() => setReloadKey((key) => key + 1)}
        >
          {course && (
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
              <article className="overflow-hidden rounded-2xl border border-stroke bg-surface shadow-nuwa">
                <div className="relative flex min-h-48 items-end overflow-hidden bg-nuwa-deep p-6 sm:min-h-60 sm:p-9">
                  <div aria-hidden className="absolute inset-0 opacity-25" style={{ backgroundImage: "radial-gradient(circle at 1px 1px, white 1px, transparent 0)", backgroundSize: "22px 22px" }} />
                  <div className="relative">
                    <span className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-medium text-white">
                      <BookOpen size={14} aria-hidden /> دورة تعليمية
                    </span>
                    <h1 className="max-w-3xl text-2xl font-bold leading-tight text-white sm:text-3xl md:text-4xl">
                      {title || "تفاصيل الدورة"}
                    </h1>
                  </div>
                </div>

                <div className="p-5 sm:p-7 md:p-9">
                  <div className="mb-7 flex flex-wrap gap-2">
                    {text(course, "subjectName", "subjectArabicName") && (
                      <span className="rounded-full bg-nuwa-soft px-3 py-1.5 text-sm font-medium text-nuwa-deep">
                        {text(course, "subjectName", "subjectArabicName")}
                      </span>
                    )}
                    {text(course, "academicYearName", "academicYearArabicName") && (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-canvas px-3 py-1.5 text-sm text-ink-muted">
                        <GraduationCap size={15} aria-hidden />
                        {text(course, "academicYearName", "academicYearArabicName")}
                      </span>
                    )}
                  </div>

                  <section>
                    <h2 className="text-lg font-bold text-ink">عن الدورة</h2>
                    <p className="mt-3 whitespace-pre-line leading-8 text-ink-muted">
                      {text(course, "description", "summary", "shortDescription") || "لا يوجد وصف إضافي لهذه الدورة حتى الآن."}
                    </p>
                  </section>

                  {modules.length > 0 && (
                    <section className="mt-8 border-t border-stroke pt-6">
                      <h2 className="mb-4 text-lg font-bold text-ink">محتوى الدورة</h2>
                      <ol className="space-y-3">
                        {modules.map((item, index) => {
                          const module = asRecord(item);
                          if (!module) return null;
                          const lessons = Array.isArray(module.lessons) ? module.lessons.length : undefined;
                          return (
                            <li key={String(module.id ?? index)} className="flex items-center justify-between gap-3 rounded-xl border border-stroke bg-canvas/60 p-4">
                              <span className="flex min-w-0 items-center gap-3">
                                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-nuwa-soft text-sm font-bold text-nuwa-base">{index + 1}</span>
                                <span className="truncate font-medium text-ink">{text(module, "title", "name") || `الوحدة ${index + 1}`}</span>
                              </span>
                              {lessons !== undefined && <span className="shrink-0 text-xs text-ink-muted">{lessons} دروس</span>}
                            </li>
                          );
                        })}
                      </ol>
                    </section>
                  )}
                </div>
              </article>

              <aside className="rounded-2xl border border-stroke bg-surface p-5 shadow-nuwa sm:p-6 lg:sticky lg:top-24">
                <p className="text-sm font-semibold text-nuwa-base">ابدأ رحلتك</p>
                <p className="mt-2 text-2xl font-bold text-nuwa-deep">
                  {typeof course.price === "number"
                    ? course.price === 0 ? "مجانية" : `${course.price.toLocaleString("ar-EG")} ج.م`
                    : "اطلب الالتحاق"}
                </p>
                <div className="my-5 space-y-3 border-y border-stroke py-5 text-sm">
                  <p className="flex items-center gap-2 text-ink-muted">
                    <UserRound size={16} className="text-nuwa-base" aria-hidden />
                    <span>المعلم: {text(course, "teacherName") || (teacher && text(teacher, "fullName", "name")) || "سيتم الإعلان عنه"}</span>
                  </p>
                  <p className="flex items-center gap-2 text-ink-muted">
                    <BookOpen size={16} className="text-nuwa-base" aria-hidden />
                    <span>{modules.length ? `${modules.length} وحدات تعليمية` : "محتوى تعليمي متاح"}</span>
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void enroll()}
                  disabled={enrolling}
                  className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-nuwa-base px-4 font-semibold text-white transition-colors hover:bg-nuwa-deep disabled:cursor-wait disabled:opacity-60"
                >
                  {message.startsWith("تم") ? <CheckCircle2 size={18} aria-hidden /> : null}
                  {enrolling ? "جارٍ الإرسال…" : getAuthToken() ? "طلب الالتحاق بالدورة" : "سجّل الدخول للالتحاق"}
                </button>
                {message && <p role="status" className="mt-3 text-center text-sm text-ink-muted">{message}</p>}
              </aside>
            </div>
          )}
        </ApiQueryState>
      </main>
    </div>
  );
}
