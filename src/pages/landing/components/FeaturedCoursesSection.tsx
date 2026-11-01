import { useCallback, useEffect, useState } from "react";

import {
  ArrowLeft,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Clock3,
  LoaderCircle,
  MessageCircle,
  RefreshCw,
  Star,
} from "lucide-react";

import { motion, useReducedMotion } from "framer-motion";

import { getAuthToken, resolveApiImageUrl } from "../../../api/client";

import { getPublicCourses } from "../../../api/catalog";
import { studentsApi } from "../../../api/endpoints";

import CourseEnrollmentContactDialog from "../../../components/dashboard/CourseEnrollmentContactDialog";

import CourseMetadataBadges from "../../../components/CourseMetadataBadges";

import CourseTeacherAvatar from "../../../components/CourseTeacherAvatar";

import ApiQueryState from "../../../components/ApiQueryState";

import type { NavigateFn } from "../../../types";

import type { LandingCatalogSummary } from "../types";

import { CourseGridSkeleton } from "./LandingSkeletons";

import { formatEgp } from "../../../utils/currency";
import {
  enrollmentCourseId,
  enrollmentRecords,
  enrollmentStatus,
  type CourseEnrollmentStatus,
} from "../../../utils/courseEnrollments";

const COURSES_PER_PAGE = 3;

function record(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : {};
}

export default function FeaturedCoursesSection({
  data,

  loading,

  error,

  onRetry,

  navigate,
}: {
  data?: LandingCatalogSummary;

  loading: boolean;

  error: string | null;

  onRetry: () => void;

  navigate: NavigateFn;
}) {
  const [page, setPage] = useState(1);

  const [courses, setCourses] = useState<Record<string, unknown>[]>([]);

  const [coursesLoading, setCoursesLoading] = useState(false);

  const [coursesError, setCoursesError] = useState<string | null>(null);

  const isStudentViewer = Boolean(
    getAuthToken() &&
    (window.sessionStorage.getItem("eduhub.auth.role") ?? "")
      .toLowerCase()
      .includes("student"),
  );

  const [courseEnrollmentStatuses, setCourseEnrollmentStatuses] = useState<
    Map<string, CourseEnrollmentStatus>
  >(() => new Map());

  const [enrollmentsChecked, setEnrollmentsChecked] = useState(
    () => !isStudentViewer,
  );

  const [enrollmentCheckFailed, setEnrollmentCheckFailed] = useState(false);

  const [enrollmentReloadKey, setEnrollmentReloadKey] = useState(0);

  const [pageReloadKey, setPageReloadKey] = useState(0);

  const [contactCourse, setContactCourse] = useState<Record<
    string,
    unknown
  > | null>(null);

  const reduce = !!useReducedMotion();

  const closeContactDialog = useCallback(() => setContactCourse(null), []);

  const refreshEnrollmentStatus = useCallback(() => {
    setEnrollmentReloadKey((key) => key + 1);
  }, []);

  useEffect(() => {
    let active = true;

    if (!isStudentViewer) {
      setCourseEnrollmentStatuses(new Map());
      setEnrollmentsChecked(true);
      setEnrollmentCheckFailed(false);
      return () => {
        active = false;
      };
    }

    setEnrollmentsChecked(false);
    setEnrollmentCheckFailed(false);

    studentsApi
      .enrollments({ page: 1, pageSize: 100 })
      .then((response) => {
        if (!active) return;

        const statuses = new Map<string, CourseEnrollmentStatus>();

        for (const enrollment of enrollmentRecords(response)) {
          const courseId = enrollmentCourseId(enrollment);
          if (courseId) statuses.set(courseId, enrollmentStatus(enrollment));
        }

        setCourseEnrollmentStatuses(statuses);
      })
      .catch(() => {
        if (active) {
          setCourseEnrollmentStatuses(new Map());
          setEnrollmentCheckFailed(true);
        }
      })
      .finally(() => {
        if (active) setEnrollmentsChecked(true);
      });

    return () => {
      active = false;
    };
  }, [enrollmentReloadKey, isStudentViewer]);

  const totalPages = Math.max(
    1,

    Math.ceil((data?.courseCount ?? 0) / COURSES_PER_PAGE),
  );

  useEffect(() => {
    if (!data) return;

    if (page === 1) {
      setCourses(data.featured.map(record).slice(0, COURSES_PER_PAGE));

      setCoursesError(null);

      setCoursesLoading(false);

      return;
    }

    let active = true;

    setCourses([]);

    setCoursesLoading(true);

    setCoursesError(null);

    getPublicCourses(page, COURSES_PER_PAGE)
      .then((result) => {
        if (active) setCourses(result.items.map(record));
      })

      .catch((cause: unknown) => {
        if (active) {
          setCoursesError(
            cause instanceof Error
              ? cause.message
              : "تعذر تحميل الدورات المطلوبة.",
          );
        }
      })

      .finally(() => {
        if (active) setCoursesLoading(false);
      });

    return () => {
      active = false;
    };
  }, [data, page, pageReloadKey]);

  const pageNumbers = (() => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, index) => index + 1);
    }

    const start = Math.max(2, Math.min(page - 1, totalPages - 3));

    const end = Math.min(totalPages - 1, Math.max(page + 1, 4));

    return [
      1,

      ...(start > 2 ? ["start-gap" as const] : []),

      ...Array.from({ length: end - start + 1 }, (_, index) => start + index),

      ...(end < totalPages - 1 ? ["end-gap" as const] : []),

      totalPages,
    ];
  })();

  // one quiet fade-in when an element first scrolls into view, nothing else

  const fade = (delay = 0) =>
    reduce
      ? {}
      : {
          initial: { opacity: 0, y: 22 },

          whileInView: { opacity: 1, y: 0 },

          viewport: { once: true, margin: "-60px" },

          transition: {
            duration: 0.7,

            delay,

            ease: [0.22, 1, 0.36, 1] as const,
          },
        };

  return (
    <section className="relative isolate overflow-hidden bg-white py-16 sm:py-20">
      <div
        aria-hidden
        className="pointer-events-none absolute -right-24 top-0 -z-10 size-96 rounded-full bg-[#eef7ef] blur-3xl"
      />

      <div className="mx-auto max-w-7xl px-5 sm:px-8">
        <motion.div
          {...fade()}
          className="flex flex-wrap items-end justify-between gap-5"
        >
          <div>
            <p className="inline-flex items-center gap-3 text-sm font-semibold text-nuwa-base">
              <span className="grid size-9 place-items-center rounded-xl bg-nuwa-base/10">
                <Star size={18} aria-hidden="true" />
              </span>
              اختيارات من المنصة
            </p>
            <motion.h2
              initial={
                reduce ? false : { opacity: 0, y: 16, filter: "blur(8px)" }
              }
              whileInView={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{
                duration: 0.75,

                delay: reduce ? 0 : 0.1,

                ease: [0.22, 1, 0.36, 1],
              }}
              className="mt-4 text-3xl font-extrabold tracking-tight text-[#143a2c] sm:text-4xl lg:text-5xl"
            >
              دورات تستحق أن تبدأ بها
            </motion.h2>
          </div>
          <button
            type="button"
            onClick={() => navigate("public:courses")}
            className="group inline-flex items-center gap-2 rounded-xl border border-[#cddbd0] bg-white px-4 py-2.5 text-sm font-semibold text-[#234736] transition-colors hover:border-[#9fbea7] hover:bg-[#edf5ef] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-200 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
          >
            كل الدورات
            <ArrowLeft
              size={16}
              className="text-nuwa-base transition-transform group-hover:-translate-x-0.5"
            />
          </button>
        </motion.div>

        <ApiQueryState
          loading={loading || coursesLoading}
          loadingContent={<CourseGridSkeleton />}
          error={error}
          isEmpty={Boolean(data && data.courseCount === 0)}
          emptyMessage="لا توجد دورات منشورة حالياً."
          onRetry={onRetry}
        >
          {data && (
            <div className="mt-9 grid grid-cols-1 gap-4 sm:gap-5 lg:grid-cols-3">
              {courses.map((course, index) => {
                const courseId = course.id ?? course.courseId;
                const courseIdString =
                  courseId === undefined || courseId === null
                    ? ""
                    : String(courseId);
                const enrollmentStatus =
                  courseEnrollmentStatuses.get(courseIdString);
                const isApproved = enrollmentStatus === "approved";
                const isPending = enrollmentStatus === "pending";
                const isCheckingEnrollment =
                  isStudentViewer && !enrollmentsChecked;
                const isEnrollmentCheckFailed =
                  isStudentViewer && enrollmentCheckFailed;

                const cover =
                  typeof course.coverImageUrl === "string"
                    ? resolveApiImageUrl(course.coverImageUrl, 800)
                    : "";

                const subjectName =
                  course.subjectName == null ? "" : String(course.subjectName);

                return (
                  <motion.article
                    key={String(courseId ?? index)}
                    {...fade(Math.min(index, 5) * 0.05)}
                    layout={!reduce}
                    className="group relative mx-auto flex min-h-64 w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-stroke bg-surface text-start shadow-sm transition-[border-color,box-shadow,transform] duration-300 hover:-translate-y-0.5 hover:border-emerald-300/70 hover:shadow-[0_16px_36px_-24px_rgba(11,59,37,.35)] sm:min-h-72 sm:rounded-3xl lg:mx-0 lg:max-w-none"
                  >
                    <div className="relative h-44 w-full shrink-0 overflow-hidden bg-gradient-to-br from-[#072d1c] via-[#0e5233] to-[#187d4d] sm:h-48 lg:h-44">
                      {cover ? (
                        <img
                          src={cover}
                          alt=""
                          loading="lazy"
                          decoding="async"
                          width={800}
                          height={450}
                          className="absolute inset-0 size-full object-cover"
                        />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="absolute -right-10 -top-10 size-48 rounded-full border border-white/10 bg-white/5 blur-sm" />
                          <div className="absolute -left-10 -bottom-10 size-36 rounded-full border border-white/10 bg-white/5 blur-sm" />
                          <div className="relative z-10 grid size-16 place-items-center rounded-2xl border border-white/20 bg-white/10 shadow-inner backdrop-blur-md">
                            <BookOpen size={30} className="text-emerald-200" />
                          </div>
                        </div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-[#091e15]/90 via-[#091e15]/30 to-black/20 transition-opacity duration-300 group-hover:opacity-85" />
                      <div
                        aria-hidden="true"
                        className="pointer-events-none absolute inset-0 z-[1] bg-[radial-gradient(ellipse_at_50%_100%,rgba(52,211,153,.2),transparent_65%)] opacity-0 transition-opacity duration-300 ease-out group-hover:opacity-100"
                      />
                      <div className="absolute inset-x-2.5 top-2.5 z-10 flex items-center justify-between gap-2 sm:inset-x-3.5 sm:top-3.5">
                        {subjectName ? (
                          <span className="inline-flex max-w-[70%] items-center gap-1 rounded-full border border-white/20 bg-emerald-950/60 px-2.5 py-1 text-[10px] font-bold text-emerald-200 shadow-sm backdrop-blur-md sm:max-w-full sm:gap-1.5 sm:px-3 sm:text-[11px]">
                            <span className="size-1.5 shrink-0 animate-pulse rounded-full bg-emerald-400" />
                            <span className="truncate">{subjectName}</span>
                          </span>
                        ) : (
                          <span />
                        )}
                        {course.academicYear != null &&
                          course.academicYear !== "" && (
                            <span className="inline-flex shrink-0 items-center rounded-full border border-white/15 bg-black/40 px-2.5 py-1 text-[10px] font-semibold text-white/90 shadow-sm backdrop-blur-md sm:px-3 sm:text-[11px]">
                              {String(course.academicYear)}
                            </span>
                          )}
                      </div>
                      {course.price != null && (
                        <div className="absolute bottom-2.5 right-2.5 z-10 sm:bottom-3.5 sm:right-3.5">
                          <span
                            className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[10px] font-black shadow-xl backdrop-blur-md sm:rounded-xl sm:px-3.5 sm:py-1.5 sm:text-xs ${
                              Number(course.price) === 0
                                ? "border border-emerald-400/50 bg-emerald-500/90 text-white shadow-emerald-950/40"
                                : "border border-white/30 bg-white/95 text-emerald-950 shadow-black/20"
                            }`}
                          >
                            {formatEgp(course.price)}
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="relative z-10 flex flex-1 flex-col bg-surface p-4 transition-colors duration-300 group-hover:bg-emerald-50/20 sm:p-6">
                      <div>
                        <CourseMetadataBadges course={course} />
                        <h3 className="line-clamp-2 text-[15px] font-bold leading-snug text-ink transition-colors duration-300 group-hover:text-nuwa-base sm:text-base">
                          {String(course.title ?? "دورة تعليمية")}
                        </h3>
                        <p className="mt-1.5 line-clamp-2 text-xs font-normal leading-relaxed text-ink-muted/90 sm:mt-2">
                          {String(
                            course.description ??
                              "محتوى تعليمي منظم يساعدك على التقدم خطوة بخطوة.",
                          )}
                        </p>
                      </div>
                      <div className="mt-auto flex flex-col items-stretch justify-between gap-3 border-t border-stroke/50 pt-3 sm:mt-5">
                        <div className="flex min-w-0 items-center gap-2.5">
                          <CourseTeacherAvatar
                            course={course}
                            name={String(
                              course.teacherName ??
                                course.subjectName ??
                                "معلم وَعي",
                            )}
                          />
                          <div className="flex min-w-0 flex-col">
                            <span className="text-[10px] font-medium text-ink-muted/70">
                              المعلم
                            </span>
                            <span className="truncate text-[11px] font-bold text-ink/90 sm:text-xs">
                              {String(
                                course.teacherName ??
                                  course.subjectName ??
                                  "منصة وَعي",
                              )}
                            </span>
                          </div>
                        </div>
                        {isApproved ? (
                          <button
                            type="button"
                            disabled={courseId == null}
                            onClick={() => {
                              if (courseId != null) {
                                navigate("public:course-detail", {
                                  courseId: courseIdString,
                                });
                              }
                            }}
                            className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-nuwa-base px-4 py-2.5 text-sm font-bold text-white shadow-sm shadow-nuwa-base/15 transition hover:-translate-y-0.5 hover:bg-nuwa-deep focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nuwa-bright focus-visible:ring-offset-2 disabled:cursor-default disabled:opacity-60"
                          >
                            <BookOpen size={16} aria-hidden="true" />
                            متابعة التقدم
                          </button>
                        ) : (
                          <div className="grid gap-2 sm:grid-cols-2">
                            <button
                              type="button"
                              disabled={
                                courseId == null || isCheckingEnrollment
                              }
                              onClick={() => {
                                if (isEnrollmentCheckFailed) {
                                  setEnrollmentReloadKey((key) => key + 1);
                                } else {
                                  setContactCourse(course);
                                }
                              }}
                              className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-xs font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-200 disabled:cursor-default disabled:opacity-70 ${
                                isEnrollmentCheckFailed
                                  ? "border-amber-200 bg-amber-50 text-amber-900 hover:bg-amber-100"
                                  : isPending
                                    ? "border-amber-200 bg-amber-50 text-amber-900 hover:bg-amber-100"
                                    : "border-transparent bg-nuwa-base text-white shadow-sm hover:-translate-y-0.5 hover:bg-nuwa-deep"
                              }`}
                            >
                              {isEnrollmentCheckFailed ? (
                                <RefreshCw size={15} aria-hidden="true" />
                              ) : isCheckingEnrollment ? (
                                <LoaderCircle
                                  size={15}
                                  className="animate-spin"
                                  aria-hidden="true"
                                />
                              ) : isPending ? (
                                <Clock3 size={15} aria-hidden="true" />
                              ) : (
                                <MessageCircle size={15} aria-hidden="true" />
                              )}
                              {isEnrollmentCheckFailed
                                ? "إعادة التحقق من الاشتراك"
                                : isCheckingEnrollment
                                  ? "جارٍ التحقق من الاشتراك..."
                                  : isPending
                                    ? "طلبك قيد المراجعة"
                                    : "طلب الالتحاق بالدورة"}
                            </button>
                            <button
                              type="button"
                              disabled={courseId == null}
                              onClick={() => {
                                if (courseId != null) {
                                  navigate("public:course-detail", {
                                    courseId: courseIdString,
                                  });
                                }
                              }}
                              className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl bg-nuwa-soft px-3 py-2.5 text-xs font-bold text-nuwa-deep transition-[transform,background-color,color] duration-300 ease-out hover:bg-nuwa-base hover:text-white hover:shadow-md hover:shadow-emerald-900/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-200 disabled:cursor-default"
                            >
                              التفاصيل
                              <ArrowLeft size={13} aria-hidden="true" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </motion.article>
                );
              })}
            </div>
          )}
        </ApiQueryState>
        {coursesError && (
          <div
            role="alert"
            className="mt-5 rounded-2xl border border-danger/20 bg-danger-light p-4 text-center text-sm text-danger"
          >
            <p>{coursesError}</p>
            <button
              type="button"
              onClick={() => setPageReloadKey((key) => key + 1)}
              className="mt-2 font-bold underline"
            >
              حاول مرة أخرى
            </button>
          </div>
        )}
        {data && totalPages > 1 && (
          <motion.nav
            {...fade()}
            aria-label="صفحات الدورات"
            className="mt-8 flex flex-wrap items-center justify-center gap-2"
          >
            <button
              type="button"
              aria-label="الصفحة السابقة"
              disabled={page === 1 || coursesLoading}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              className="grid size-11 place-items-center rounded-xl border border-[#cddbd0] bg-white text-[#234736] transition hover:border-nuwa-base hover:bg-nuwa-ice disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ChevronRight size={18} />
            </button>
            {pageNumbers.map((pageNumber) =>
              typeof pageNumber === "string" ? (
                <span
                  key={pageNumber}
                  aria-hidden="true"
                  className="px-1 text-sm text-ink-muted"
                >
                  …
                </span>
              ) : (
                <button
                  key={pageNumber}
                  type="button"
                  aria-current={page === pageNumber ? "page" : undefined}
                  onClick={() => setPage(pageNumber)}
                  disabled={coursesLoading}
                  className={`grid size-11 place-items-center rounded-xl border text-sm font-bold tabular-nums transition disabled:cursor-wait ${
                    page === pageNumber
                      ? "border-nuwa-base bg-nuwa-base text-white shadow-nuwa"
                      : "border-[#cddbd0] bg-white text-[#234736] hover:border-nuwa-base hover:bg-nuwa-ice"
                  }`}
                >
                  {pageNumber.toLocaleString("ar-EG")}
                </button>
              ),
            )}
            <button
              type="button"
              aria-label="الصفحة التالية"
              disabled={page === totalPages || coursesLoading}
              onClick={() =>
                setPage((current) => Math.min(totalPages, current + 1))
              }
              className="grid size-11 place-items-center rounded-xl border border-[#cddbd0] bg-white text-[#234736] transition hover:border-nuwa-base hover:bg-nuwa-ice disabled:cursor-not-allowed disabled:opacity-40"
            >
              <ChevronLeft size={18} />
            </button>
            <span className="basis-full text-center text-xs text-ink-muted">
              صفحة {page.toLocaleString("ar-EG")} من{" "}
              {totalPages.toLocaleString("ar-EG")}
            </span>
          </motion.nav>
        )}
        {coursesLoading && (
          <p
            aria-live="polite"
            className="mt-3 text-center text-xs text-ink-muted"
          >
            جارٍ تحميل الصفحة...
          </p>
        )}
        <CourseEnrollmentContactDialog
          course={contactCourse}
          onClose={closeContactDialog}
          navigate={navigate}
          isPending={
            contactCourse !== null &&
            courseEnrollmentStatuses.get(
              String(contactCourse.id ?? contactCourse.courseId),
            ) === "pending"
          }
          onEnrollmentRequested={refreshEnrollmentStatus}
          onEnrollmentCancelled={refreshEnrollmentStatus}
        />
      </div>
    </section>
  );
}
