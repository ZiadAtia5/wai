import { useCallback, useEffect, useState, type FormEvent } from "react";

import { ArrowLeft, BookOpen, GraduationCap, UserRound } from "lucide-react";

import { ApiError, resolveApiAssetUrl } from "../api/client";

import { getAuthToken } from "../api/client";
import { studentsApi } from "../api/endpoints";

import {
  getAcademicYears,
  type AcademicYearResponse,
  type ApiRecord,
  type PagedResult,
} from "../api/catalog";

import ApiQueryState from "../components/ApiQueryState";

import PersonAvatar from "../components/PersonAvatar";
import { Skeleton, SkeletonText } from "../components/Skeleton";
import { CatalogGridSkeleton } from "../components/loading/SkeletonLayouts";

import { useApiQuery } from "../hooks/useApiQuery";

import type { NavigateFn } from "../types";

import { notifyError, notifySuccess } from "../utils/notifications";

interface PublicCatalogPageProps {
  title: string;

  description: string;

  emptyMessage: string;

  load: (
    page?: number,

    pageSize?: number,

    search?: string,

    academicYear?: string,
  ) => Promise<PagedResult<ApiRecord>>;

  loadDetail?: (id: string) => Promise<unknown>;

  loadRelated?: (id: string) => Promise<unknown>;

  action?: (id: string) => Promise<unknown>;

  actionLabel?: string;

  navigate?: NavigateFn;

  personCards?: boolean;

  courseCatalog?: boolean;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : null;
}

function titleOf(record: Record<string, unknown>): string {
  return String(
    record.title ??
      record.fullName ??
      record.name ??
      record.teacherName ??
      record.email ??
      "عنصر من المنصة",
  );
}

function personNameOf(record: Record<string, unknown>): string {
  const fullName =
    record.fullName ??
    record.name ??
    record.teacherName ??
    [record.firstName, record.lastName].filter(Boolean).join(" ");

  return typeof fullName === "string" && fullName.trim()
    ? fullName.trim()
    : "معلم";
}

function personBioOf(record: Record<string, unknown>): string {
  const bio = record.bio ?? record.description;
  return typeof bio === "string" ? bio : "";
}

function displayValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "-";

  return typeof value === "object" ? JSON.stringify(value) : String(value);
}

function teacherNameOf(record: Record<string, unknown>): string | null {
  const nested = asRecord(record.teacher);

  const value =
    record.teacherName ??
    record.instructorName ??
    nested?.fullName ??
    nested?.name;

  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function scalarFields(record: Record<string, unknown>): [string, unknown][] {
  return Object.entries(record).filter(
    ([key, value]) =>
      !/(^id$|id$|token|image|url|createdAt|updatedAt)/i.test(key) &&
      key !== "description" &&
      value !== null &&
      ["string", "number", "boolean"].includes(typeof value),
  );
}

export default function PublicCatalogPage({
  title,

  description,

  emptyMessage,

  load,

  loadDetail,

  loadRelated,

  action,

  actionLabel,

  navigate,

  personCards = false,
  courseCatalog = false,
}: PublicCatalogPageProps) {
  const [page, setPage] = useState(1);

  const [reloadKey, setReloadKey] = useState(0);

  const [detail, setDetail] = useState<Record<string, unknown> | null>(null);

  const [related, setRelated] = useState<unknown>(null);

  const [, setActionMessage] = useState("");

  const [actionLoading, setActionLoading] = useState(false);

  const [searchInput, setSearchInput] = useState("");

  const [search, setSearch] = useState("");

  const [academicYear, setAcademicYear] = useState("");

  const [academicYears, setAcademicYears] = useState<AcademicYearResponse[]>(
    [],
  );
  const [academicYearsLoading, setAcademicYearsLoading] = useState(false);
  const [relatedLoading, setRelatedLoading] = useState(false);
  const [enrolledCourseIds, setEnrolledCourseIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [enrollmentChecked, setEnrollmentChecked] = useState(false);

  useEffect(() => {
    const role = window.sessionStorage.getItem("eduhub.auth.role") ?? "";
    if (!action || !role.includes("student") || !getAuthToken()) {
      setEnrollmentChecked(true);
      return;
    }

    let active = true;
    studentsApi
      .enrollments({ page: 1, pageSize: 100 })
      .then((response) => {
        if (!active) return;
        const root = asRecord(response);
        const nested = asRecord(root?.data);
        const items = Array.isArray(response)
          ? response
          : Array.isArray(root?.items)
            ? root.items
            : Array.isArray(root?.enrollments)
              ? root.enrollments
              : Array.isArray(root?.data)
                ? root.data
                : Array.isArray(nested?.items)
                  ? nested.items
                  : Array.isArray(nested?.enrollments)
                    ? nested.enrollments
                    : [];
        const ids = items.flatMap((item) => {
          const record = asRecord(item);
          const course = asRecord(record?.course);
          const id = record?.courseId ?? course?.id;
          return id === undefined || id === null ? [] : [String(id)];
        });
        setEnrolledCourseIds(new Set(ids));
      })
      .catch(() => undefined)
      .finally(() => {
        if (active) setEnrollmentChecked(true);
      });

    return () => {
      active = false;
    };
  }, [action]);

  useEffect(() => {
    if (personCards) return;

    let active = true;
    setAcademicYearsLoading(true);

    getAcademicYears()
      .then((years) => {
        if (active) setAcademicYears(years);
      })

      .catch(() => undefined)
      .finally(() => {
        if (active) setAcademicYearsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [personCards]);

  const pageLoader = useCallback(
    () => load(page, 12, search, academicYear),

    [load, page, search, academicYear],
  );

  const { data, error, loading } = useApiQuery(pageLoader, reloadKey);

  async function selectRecord(item: ApiRecord) {
    const record = asRecord(item);

    if (!record) return;

    setDetail(record);

    setRelated(null);

    setActionMessage("");

    if (record.id === undefined || record.id === null) {
      setRelatedLoading(false);
      return;
    }

    setRelatedLoading(Boolean(loadRelated));

    try {
      const id = String(record.id);

      if (loadDetail) {
        const result = asRecord(await loadDetail(id));

        if (result) setDetail(result);
      }

      if (loadRelated) setRelated(await loadRelated(id));
    } catch (cause) {
      notifyError(cause, "تعذر تحميل التفاصيل.");

      setActionMessage(
        cause instanceof ApiError ? cause.message : "تعذر تحميل التفاصيل.",
      );
    } finally {
      setRelatedLoading(false);
    }
  }

  async function runAction() {
    if (!action || detail?.id === undefined || detail.id === null) return;

    const courseId = String(detail.id);
    if (enrolledCourseIds.has(courseId)) {
      setActionMessage("أنت مسجل بالفعل في هذه الدورة.");
      return;
    }

    if (!getAuthToken()) {
      notifyError(new Error("يجب تسجيل الدخول أولاً لإرسال طلب الالتحاق."));

      setActionMessage("سجّل الدخول أولاً لإرسال طلب الالتحاق.");

      navigate?.("login");

      return;
    }

    if (
      courseCatalog &&
      !(window.sessionStorage.getItem("eduhub.auth.role") ?? "")
        .toLowerCase()
        .includes("student")
    ) {
      const message = "طلب الالتحاق بالدورات متاح لحساب الطالب فقط.";
      notifyError(new Error(message));
      setActionMessage(message);
      return;
    }

    if (actionLoading) return;

    setActionLoading(true);

    try {
      await action(courseId);

      setEnrolledCourseIds((current) => new Set(current).add(courseId));

      notifySuccess("تم إرسال طلب الالتحاق بنجاح.");

      setActionMessage("تم إرسال طلب الالتحاق بنجاح.");
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "";
      const duplicate =
        (cause instanceof ApiError && cause.status === 409) ||
        /already|duplicate|enrolled|enrollment|مسجل|التحاق|مكرر/i.test(message);
      if (duplicate) {
        setEnrolledCourseIds((current) => new Set(current).add(courseId));
        setActionMessage("أنت مسجل بالفعل في هذه الدورة.");
        notifySuccess("أنت مسجل بالفعل في هذه الدورة.");
        return;
      }
      notifyError(cause, "تعذر إرسال طلب الالتحاق.");

      setActionMessage(
        cause instanceof Error ? cause.message : "تعذر تنفيذ الطلب.",
      );
    } finally {
      setActionLoading(false);
    }
  }

  const relatedItems = Array.isArray(related)
    ? related
    : asRecord(related) && Array.isArray(asRecord(related)?.items)
      ? (asRecord(related)?.items as unknown[])
      : [];

  const detailFields = detail ? scalarFields(detail) : [];
  const catalogHeader = courseCatalog || personCards;

  return (
    <div className="min-h-screen bg-canvas pb-16">
      <header
        className={
          catalogHeader
            ? "px-4 pt-5 sm:px-6 lg:px-8"
            : "border-b border-stroke bg-surface"
        }
      >
        <div
          className={`mx-auto max-w-360 ${catalogHeader ? "rounded-[28px] bg-gradient-to-br from-emerald-950 via-emerald-900 to-teal-800 px-6 py-10 text-white shadow-xl shadow-emerald-950/10 md:px-10 md:py-14" : "px-6 py-8 md:px-10"}`}
        >
          {catalogHeader && (
            <span className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-semibold text-emerald-50">
              {personCards ? (
                <>
                  <GraduationCap size={15} /> معلمو منصة وَعي
                </>
              ) : (
                <>
                  <BookOpen size={15} /> تعلّم على وتيرتك
                </>
              )}
            </span>
          )}
          <div className="flex flex-wrap items-end justify-between gap-5">
            <div>
              <h1
                className={`mb-2 font-bold tracking-tight ${catalogHeader ? "text-3xl md:text-4xl" : "text-2xl text-ink"}`}
              >
                {title}
              </h1>
              <p
                className={`max-w-2xl text-sm leading-7 ${catalogHeader ? "text-emerald-50/80 md:text-base" : "text-ink-muted"}`}
              >
                {description}
              </p>
            </div>
            {catalogHeader && loading && (
              <div
                aria-busy="true"
                className="rounded-2xl border border-white/15 bg-white/10 px-5 py-3 text-center backdrop-blur"
              >
                <Skeleton className="mx-auto h-7 w-14 bg-white/25" />
                <Skeleton className="mx-auto mt-2 h-3 w-20 bg-white/20" />
              </div>
            )}
            {catalogHeader && data && !error && (
              <div className="rounded-2xl border border-white/15 bg-white/10 px-5 py-3 text-center backdrop-blur">
                <strong className="block text-2xl">{data.totalCount}</strong>
                <span className="text-xs text-emerald-50/75">
                  {personCards ? "معلم مسجل" : "دورة متاحة"}
                </span>
              </div>
            )}
          </div>
          {!catalogHeader && loading && (
            <Skeleton className="mt-3 h-4 w-40" />
          )}
          {!catalogHeader && data && !error && (
            <p className="mt-3 text-xs text-ink-muted" aria-live="polite">
              إجمالي النتائج : {data.totalCount}
            </p>
          )}
        </div>
      </header>

      <main className="mx-auto min-w-0 max-w-360 px-4 py-6 sm:px-6 sm:py-8 md:px-10">
        <form
          onSubmit={(event: FormEvent<HTMLFormElement>) => {
            event.preventDefault();

            setPage(1);

            setSearch(searchInput.trim());

            setDetail(null);
          }}
          className={`mb-7 grid min-w-0 gap-3 rounded-2xl border border-stroke bg-surface p-4 shadow-sm sm:items-end ${personCards ? "sm:grid-cols-[minmax(0,1fr)_auto]" : "sm:grid-cols-[minmax(0,1fr)_minmax(150px,220px)_auto]"} ${catalogHeader ? "sm:p-5 md:p-6" : ""}`}
        >
          <label className="grid min-w-0 gap-1 text-xs font-semibold text-ink-muted">
            بحث
            <input
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              className="h-11 min-w-0 w-full rounded-xl border border-stroke bg-canvas px-3 text-sm text-ink outline-none transition focus:border-emerald-700 focus:ring-4 focus:ring-emerald-800/10"
              placeholder={personCards ? "ابحث باسم المعلم" : "اكتب الاسم أو عنوان الدورة"}
            />
          </label>
          {!personCards && (
            <label className="grid min-w-0 gap-1 text-xs font-semibold text-ink-muted">
            الصف الدراسي
            <select
              value={academicYear}
              disabled={academicYearsLoading}
              aria-busy={academicYearsLoading}
              onChange={(event) => {
                setAcademicYear(event.target.value);

                setPage(1);

                setDetail(null);
              }}
              className="h-11 min-w-0 w-full rounded-xl border border-stroke bg-canvas px-3 text-sm text-ink outline-none transition focus:border-emerald-700 focus:ring-4 focus:ring-emerald-800/10"
            >
              <option value="">
                {academicYearsLoading ? "جارٍ تحميل الصفوف..." : "كل الصفوف"}
              </option>
              {academicYears.map((year) => (
                <option key={year.id} value={year.value}>
                  {year.arabicName}
                </option>
              ))}
            </select>
            </label>
          )}
          <button className="min-h-11 w-full rounded-xl bg-nuwa-base px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-nuwa-deep focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-nuwa-base sm:w-auto">
            بحث
          </button>
        </form>
        {detail && (
          <section
            className={`mb-8 overflow-hidden rounded-[28px] border border-stroke bg-surface shadow-lg shadow-slate-900/5 ${courseCatalog ? "" : "p-5"}`}
            aria-live="polite"
          >
            {courseCatalog && (
              <div className="relative flex min-h-44 items-end overflow-hidden bg-gradient-to-br from-emerald-950 via-emerald-800 to-teal-700 px-6 py-7 text-white md:min-h-56 md:px-9">
                {String(
                  detail.coverImageUrl ??
                    detail.thumbnailUrl ??
                    detail.imageUrl ??
                    "",
                ) && (
                  <img
                    src={resolveApiAssetUrl(
                      String(
                        detail.coverImageUrl ??
                          detail.thumbnailUrl ??
                          detail.imageUrl,
                      ),
                    )}
                    alt=""
                    className="absolute inset-0 size-full object-cover opacity-30"
                  />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-emerald-950/80 to-transparent" />
                <div className="relative z-10 max-w-3xl">
                  <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-semibold backdrop-blur">
                    <GraduationCap size={15} /> تفاصيل الدورة
                  </span>
                  <h2 className="mt-3 text-2xl font-bold leading-tight md:text-3xl">
                    {titleOf(detail)}
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setDetail(null);
                    setRelated(null);
                  }}
                  className="absolute left-5 top-5 z-10 inline-flex h-10 items-center gap-2 rounded-full border border-white/25 bg-black/15 px-4 text-sm font-semibold text-white backdrop-blur transition hover:bg-white/15"
                >
                  إغلاق <ArrowLeft size={16} />
                </button>
              </div>
            )}
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-stroke pb-4">
              <div>
                {personCards && (
                  <div className="flex items-center gap-4">
                    <PersonAvatar
                      name={personNameOf(detail)}
                      imageUrl={String(
                        detail.avatarUrl ??
                          detail.profileImageUrl ??
                          detail.imageUrl ??
                          "",
                      )}
                      size="lg"
                    />
                    <div>
                      <p className="text-xs font-semibold text-nuwa-base">
                        معلم في منصة وَعي
                      </p>
                      <h2 className="mt-1 text-xl font-bold text-ink">
                        {personNameOf(detail)}
                      </h2>
                    </div>
                  </div>
                )}
                {!courseCatalog && !personCards && (
                  <>
                    <p className="text-xs font-semibold text-nuwa-base">
                      التفاصيل
                    </p>
                    <h2 className="mt-1 text-xl font-bold text-ink">
                      {titleOf(detail)}
                    </h2>
                  </>
                )}
                {courseCatalog && (
                  <div className="flex flex-wrap gap-2">
                    {detail.academicYear != null && (
                      <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-900">
                        {String(detail.academicYear)}
                      </span>
                    )}
                    {detail.subjectName != null && (
                      <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700">
                        {String(detail.subjectName)}
                      </span>
                    )}
                  </div>
                )}
              </div>
              {!courseCatalog && !personCards && (
                <button
                  onClick={() => {
                    setDetail(null);

                    setRelated(null);
                  }}
                  className="h-9 border border-stroke px-3 text-sm"
                >
                  إغلاق
                </button>
              )}
            </div>
            {personCards && personBioOf(detail) && (
              <p className="mt-4 whitespace-pre-line rounded-2xl bg-canvas p-5 text-sm leading-8 text-ink-muted">
                {personBioOf(detail)}
              </p>
            )}
            {!personCards &&
              typeof (detail.description ?? detail.bio) === "string" && (
              <p
                className={`whitespace-pre-line text-sm leading-8 text-ink-muted ${courseCatalog ? "px-6 py-5 md:px-9 md:py-7 md:text-base" : "mt-4 rounded-xl border border-stroke bg-canvas p-4"}`}
              >
                {String(detail.description ?? detail.bio)}
              </p>
            )}
            {!personCards && <dl
              className={`grid gap-3 sm:grid-cols-2 lg:grid-cols-3 ${courseCatalog ? "px-6 pb-6 md:px-9" : "mt-4"}`}
            >
              {detailFields
                .filter(
                  ([key]) => !/(^id$|image|url|description|bio)/i.test(key),
                )
                .slice(0, courseCatalog ? 9 : 6)
                .map(([key, value]) => (
                  <div key={key}>
                    <dt className="text-xs text-ink-muted">{key}</dt>
                    <dd
                      className={`mt-1 wrap-break-word text-sm text-ink ${courseCatalog ? "rounded-xl bg-canvas p-3" : ""}`}
                    >
                      {displayValue(value)}
                    </dd>
                  </div>
                ))}
            </dl>}
            {!personCards && detailFields.length > 6 && (
              <details className="mt-4 rounded-xl border border-stroke bg-canvas">
                <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-nuwa-base">
                  عرض التفاصيل الإضافية ({detailFields.length - 6})
                </summary>
                <dl className="grid gap-3 border-t border-stroke p-4 sm:grid-cols-2 lg:grid-cols-3">
                  {detailFields.slice(6).map(([key, value]) => (
                    <div key={key} className="rounded-lg bg-white p-3">
                      <dt className="text-xs text-ink-muted">{key}</dt>
                      <dd className="mt-1 break-words text-sm text-ink">
                        {displayValue(value)}
                      </dd>
                    </div>
                  ))}
                </dl>
              </details>
            )}
            {action && (
              <button
                type="button"
                disabled={
                  actionLoading ||
                  (enrolledCourseIds.has(String(detail.id)) &&
                    enrollmentChecked)
                }
                onClick={() => void runAction()}
                className={`inline-flex h-12 items-center justify-center rounded-xl bg-nuwa-base px-6 text-sm font-bold text-white shadow-md shadow-emerald-900/15 transition hover:-translate-y-0.5 hover:bg-nuwa-deep disabled:cursor-not-allowed disabled:opacity-60 ${courseCatalog ? "mx-6 mb-6 w-[calc(100%-3rem)] md:mx-9 md:w-auto md:min-w-64" : "mt-5"}`}
              >
                {actionLoading
                  ? "جارٍ الإرسال..."
                  : enrolledCourseIds.has(String(detail.id)) &&
                      enrollmentChecked
                    ? "مسجل بالفعل"
                    : (actionLabel ?? "تنفيذ")}
              </button>
            )}
            {loadRelated && (
              <div className="mt-5 border-t border-stroke pt-4">
                <h3 className="mb-3 font-semibold text-ink">
                  {personCards ? "الدورات التعليمية" : "الدورات"}
                </h3>
                {relatedLoading ? (
                  <div
                    aria-busy="true"
                    className="grid gap-2 sm:grid-cols-2"
                  >
                    {[0, 1].map((index) => (
                      <div
                        key={index}
                        aria-hidden="true"
                        className="rounded-2xl border border-stroke bg-white p-4"
                      >
                        <Skeleton className="h-36 w-full rounded-2xl" />
                        <Skeleton className="mt-4 h-5 w-2/3" />
                        <SkeletonText className="mt-3" lines={2} />
                        <div className="mt-4 flex justify-between border-t border-stroke pt-3">
                          <Skeleton className="h-4 w-24" />
                          <Skeleton className="h-4 w-20" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : relatedItems.length === 0 ? (
                  <p className="text-sm text-ink-muted">لا توجد دورات متاحة.</p>
                ) : (
                  <div className="grid gap-2 sm:grid-cols-2">
                    {relatedItems.map((item, index) => {
                      const record = asRecord(item);

                      if (!record) return null;

                      const courseId = record.id;
                      const courseTitle = String(
                        record.title ?? record.name ?? "دورة تعليمية",
                      );
                      const coverImage = String(
                        record.coverImageUrl ??
                          record.thumbnailUrl ??
                          record.imageUrl ??
                          "",
                      );
                      const coverImageUrl = coverImage
                        ? resolveApiAssetUrl(coverImage)
                        : "";

                      if (personCards) {
                        return (
                          <button
                            key={String(courseId ?? index)}
                            type="button"
                            disabled={courseId === undefined || courseId === null}
                            onClick={() => {
                              if (courseId !== undefined && courseId !== null) {
                                navigate?.("public:course-detail", {
                                  courseId: String(courseId),
                                });
                              }
                            }}
                            className="group overflow-hidden rounded-2xl border border-stroke bg-white text-start shadow-sm transition hover:-translate-y-1 hover:border-emerald-300 hover:shadow-nuwa-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-800 disabled:cursor-default disabled:hover:translate-y-0 disabled:hover:shadow-sm"
                          >
                            <div className="relative flex h-36 items-end overflow-hidden bg-gradient-to-br from-emerald-950 via-emerald-800 to-teal-700 p-4">
                              {coverImageUrl ? (
                                <img
                                  src={coverImageUrl}
                                  alt=""
                                  className="absolute inset-0 size-full object-cover transition duration-500 group-hover:scale-105"
                                />
                              ) : (
                                <>
                                  <div className="absolute -left-6 -top-10 size-40 rounded-full border border-white/15" />
                                  <BookOpen
                                    size={38}
                                    className="absolute left-5 top-5 text-white/75"
                                  />
                                </>
                              )}
                              <span className="relative rounded-full border border-white/20 bg-black/20 px-3 py-1 text-xs font-semibold text-white backdrop-blur">
                                {String(record.academicYear ?? "دورة تعليمية")}
                              </span>
                            </div>
                            <div className="p-4">
                              <h4 className="line-clamp-1 font-bold text-ink">
                                {courseTitle}
                              </h4>
                              <p className="mt-2 line-clamp-2 min-h-12 text-sm leading-6 text-ink-muted">
                                {String(
                                  record.description ??
                                    "محتوى تعليمي منظم يساعدك على التقدم خطوة بخطوة.",
                                )}
                              </p>
                              <div className="mt-4 flex items-center justify-between gap-3 border-t border-stroke pt-3 text-xs">
                                <span className="line-clamp-1 text-ink-muted">
                                  {String(
                                    record.subjectName ?? "دورة تعليمية",
                                  )}
                                </span>
                                <span className="shrink-0 font-semibold text-nuwa-base">
                                  تفاصيل الدورة
                                  <ArrowLeft
                                    size={14}
                                    className="ms-1 inline"
                                  />
                                </span>
                              </div>
                            </div>
                          </button>
                        );
                      }

                      return (
                        <article
                          key={String(courseId ?? index)}
                          className="overflow-hidden rounded-2xl border border-stroke p-3"
                        >
                          <h4 className="font-medium text-ink">
                            {courseTitle}
                          </h4>
                          <p className="mt-1 text-xs text-ink-muted">
                            {scalarFields(record)
                              .slice(0, 3)
                              .map(
                                ([key, value]) =>
                                  `${key}: ${displayValue(value)}`,
                              )
                              .join(" · ")}
                          </p>
                        </article>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </section>
        )}

        <ApiQueryState
          loading={loading}
          loadingContent={
            <CatalogGridSkeleton
              kind={personCards ? "person" : courseCatalog ? "course" : "record"}
            />
          }
          error={error}
          isEmpty={Boolean(data && data.items.length === 0)}
          emptyMessage={emptyMessage}
          onRetry={() => setReloadKey((key) => key + 1)}
        >
          {data && data.items.length > 0 && (
            <>
              <div
                className={`grid gap-5 md:grid-cols-2 ${courseCatalog ? "xl:grid-cols-3" : "lg:grid-cols-3"}`}
              >
                {data.items.map((item, index) => {
                  const record = asRecord(item);

                  if (!record) return null;

                  return (
                    <button
                      key={String(record.id ?? index)}
                      type="button"
                      onClick={() => {
                        if (courseCatalog && navigate && record.id != null) {
                          navigate("public:course-detail", {
                            courseId: String(record.id),
                          });
                          return;
                        }

                        if (personCards) {
                          const teacherId = record.id ?? record.teacherId;
                          if (
                            teacherId !== undefined &&
                            teacherId !== null &&
                            navigate
                          ) {
                            navigate("teacher:platform", {
                              teacherId: String(teacherId),
                            });
                            return;
                          }
                        }

                        void selectRecord(item);
                      }}
                      className={`group relative overflow-hidden rounded-[24px] border border-stroke bg-surface p-5 text-start shadow-sm transition duration-300 hover:-translate-y-1 hover:border-emerald-300 hover:shadow-nuwa-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-800 ${courseCatalog ? "flex min-h-80 flex-col" : ""} ${
                        personCards
                          ? "flex min-h-72 flex-col items-center text-center hover:border-emerald-400 hover:shadow-xl"
                          : ""
                      }`}
                    >
                      {courseCatalog && (
                        <div className="relative mb-5 grid h-40 place-items-center overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-950 via-emerald-800 to-teal-700">
                          {String(
                            record.coverImageUrl ??
                              record.thumbnailUrl ??
                              record.imageUrl ??
                              "",
                          ) ? (
                            <img
                              src={resolveApiAssetUrl(
                                String(
                                  record.coverImageUrl ??
                                    record.thumbnailUrl ??
                                    record.imageUrl,
                                ),
                              )}
                              alt=""
                              className="absolute inset-0 size-full object-cover transition duration-500 group-hover:scale-105"
                            />
                          ) : (
                            <>
                              <div className="absolute -right-6 -top-10 size-40 rounded-full border border-white/15" />
                              <div className="absolute -right-1 -top-4 size-28 rounded-full border border-white/15" />
                              <BookOpen
                                size={42}
                                className="relative text-white/90"
                              />
                            </>
                          )}
                          <span className="absolute bottom-3 right-3 rounded-full border border-white/20 bg-black/20 px-3 py-1 text-xs font-semibold text-white backdrop-blur">
                            {String(record.academicYear ?? "دورة تعليمية")}
                          </span>
                        </div>
                      )}
                      {personCards && (
                        <PersonAvatar
                          name={personNameOf(record)}
                          imageUrl={String(
                            record.avatarUrl ??
                              record.profileImageUrl ??
                              record.imageUrl ??
                              "",
                          )}
                          size="lg"
                        />
                      )}
                      <h2
                        className={`font-semibold leading-7 text-ink ${courseCatalog ? "text-lg" : ""} ${
                          personCards ? "mt-3" : ""
                        }`}
                      >
                        {personCards ? personNameOf(record) : titleOf(record)}
                      </h2>
                      {!personCards && teacherNameOf(record) && (
                        <p className="mt-1 text-xs font-semibold text-emerald-700">
                          المعلم: {teacherNameOf(record)}
                        </p>
                      )}
                      <p className="mt-2 line-clamp-3 text-sm leading-7 text-ink-muted">
                        {String(
                          personCards
                            ? personBioOf(record)
                            : (record.description ??
                                record.bio ??
                                record.subjectName ??
                                record.academicYear ??
                                ""),
                        )}
                      </p>
                      {!personCards && <div
                        className={`mt-4 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-muted ${
                          personCards ? "justify-center" : ""
                        }`}
                      >
                        {(courseCatalog
                          ? ["price", "subjectName", "academicYear"]
                          : personCards
                            ? ["courseCount", "academicYear"]
                            : [
                                "price",
                                "subjectName",
                                "academicYear",
                                "courseCount",
                              ]
                        )

                          .filter((key) => record[key] !== undefined)

                          .map((key) => (
                            <span key={key}>
                              {key === "price"
                                ? "السعر"
                                : key === "subjectName"
                                  ? "المادة"
                                  : key === "academicYear"
                                    ? "الصف"
                                    : key}
                              : {displayValue(record[key])}
                            </span>
                          ))}
                      </div>}
                      {courseCatalog && (
                        <div className="mt-auto flex items-center justify-between border-t border-stroke pt-4 text-xs text-ink-muted">
                          <span className="inline-flex items-center gap-1.5">
                            {teacherNameOf(record) ? (
                              <UserRound size={14} />
                            ) : (
                              <BookOpen size={14} />
                            )}
                            {teacherNameOf(record) ?? "دورة تعليمية"}
                          </span>
                          <span className="inline-flex items-center gap-1 font-semibold text-emerald-800">
                            التفاصيل <ArrowLeft size={14} />
                          </span>
                        </div>
                      )}
                      <span
                        className={`${
                          personCards ? "mt-auto pt-4" : "mt-4"
                        } inline-block text-sm font-semibold text-nuwa-base`}
                      >
                        {personCards ? "استكشف دورات المعلم" : "عرض التفاصيل"}
                      </span>
                    </button>
                  );
                })}
              </div>
              {data.totalPages > 1 && (
                <nav
                  className="mt-6 flex items-center justify-between border-t border-stroke pt-4"
                  aria-label="صفحات النتائج"
                >
                  <button
                    disabled={page <= 1}
                    onClick={() => {
                      setPage((value) => value - 1);

                      setDetail(null);
                    }}
                    className="h-10 border border-stroke px-4 text-sm disabled:opacity-40"
                  >
                    السابق
                  </button>
                  <span className="text-sm text-ink-muted">
                    صفحة {data.page} من {data.totalPages}
                  </span>
                  <button
                    disabled={page >= data.totalPages}
                    onClick={() => {
                      setPage((value) => value + 1);

                      setDetail(null);
                    }}
                    className="h-10 border border-stroke px-4 text-sm disabled:opacity-40"
                  >
                    التالي
                  </button>
                </nav>
              )}
            </>
          )}
        </ApiQueryState>
      </main>
    </div>
  );
}
