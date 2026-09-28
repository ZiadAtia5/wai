import { useCallback, useState } from "react";

import { ApiError } from "../api/client";
import type { ApiRecord, PagedResult } from "../api/catalog";
import ApiQueryState from "../components/ApiQueryState";
import { useApiQuery } from "../hooks/useApiQuery";

interface PublicCatalogPageProps {
  title: string;
  description: string;
  emptyMessage: string;
  load: (page?: number, pageSize?: number) => Promise<PagedResult<ApiRecord>>;
  loadDetail?: (id: string) => Promise<unknown>;
  loadRelated?: (id: string) => Promise<unknown>;
  action?: (id: string) => Promise<unknown>;
  actionLabel?: string;
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

function displayValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "-";
  return typeof value === "object" ? JSON.stringify(value) : String(value);
}

function scalarFields(record: Record<string, unknown>): [string, unknown][] {
  return Object.entries(record)
    .filter(
      ([, value]) =>
        value === null ||
        ["string", "number", "boolean"].includes(typeof value),
    )
    .slice(0, 10);
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
}: PublicCatalogPageProps) {
  const [page, setPage] = useState(1);
  const [reloadKey, setReloadKey] = useState(0);
  const [detail, setDetail] = useState<Record<string, unknown> | null>(null);
  const [related, setRelated] = useState<unknown>(null);
  const [actionMessage, setActionMessage] = useState("");
  const pageLoader = useCallback(() => load(page, 12), [load, page]);
  const { data, error, loading } = useApiQuery(pageLoader, reloadKey);

  async function selectRecord(item: ApiRecord) {
    const record = asRecord(item);
    if (!record) return;
    setDetail(record);
    setRelated(null);
    setActionMessage("");
    if (record.id === undefined || record.id === null) return;
    try {
      const id = String(record.id);
      if (loadDetail) {
        const result = asRecord(await loadDetail(id));
        if (result) setDetail(result);
      }
      if (loadRelated) setRelated(await loadRelated(id));
    } catch (cause) {
      setActionMessage(
        cause instanceof ApiError ? cause.message : "تعذر تحميل التفاصيل.",
      );
    }
  }

  async function runAction() {
    if (!action || detail?.id === undefined || detail.id === null) return;
    try {
      await action(String(detail.id));
      setActionMessage("تم إرسال طلب الالتحاق بنجاح.");
    } catch (cause) {
      setActionMessage(
        cause instanceof Error ? cause.message : "تعذر تنفيذ الطلب.",
      );
    }
  }

  const relatedItems = Array.isArray(related)
    ? related
    : asRecord(related) && Array.isArray(asRecord(related)?.items)
      ? (asRecord(related)?.items as unknown[])
      : [];

  return (
    <div className="page-ambient min-h-[calc(100dvh-10rem)] bg-canvas pb-12">
      <header className="border-b border-stroke bg-surface">
        <div className="mx-auto max-w-360 px-6 py-8 md:px-10">
          <h1 className="mb-1 text-2xl font-bold text-ink">{title}</h1>
          <p className="text-sm text-ink-muted">{description}</p>
          {data && !error && (
            <p className="mt-3 text-xs text-ink-muted" aria-live="polite">
              إجمالي النتائج من الخادم: {data.totalCount}
            </p>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-360 px-6 py-8 md:px-10">
        {detail && (
          <section
            className="mb-8 border border-stroke bg-surface p-5"
            aria-live="polite"
          >
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-stroke pb-4">
              <div>
                <p className="text-xs font-semibold text-nuwa-base">التفاصيل</p>
                <h2 className="mt-1 text-xl font-bold text-ink">
                  {titleOf(detail)}
                </h2>
              </div>
              <button
                onClick={() => {
                  setDetail(null);
                  setRelated(null);
                }}
                className="h-9 border border-stroke px-3 text-sm"
              >
                إغلاق
              </button>
            </div>
            <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {scalarFields(detail).map(([key, value]) => (
                <div key={key}>
                  <dt className="text-xs text-ink-muted">{key}</dt>
                  <dd className="mt-1 wrap-break-word text-sm text-ink">
                    {displayValue(value)}
                  </dd>
                </div>
              ))}
            </dl>
            {action && (
              <button
                onClick={() => void runAction()}
                className="mt-5 h-10 bg-nuwa-base px-4 text-sm font-medium text-white"
              >
                {actionLabel ?? "تنفيذ"}
              </button>
            )}
            {actionMessage && (
              <p role="status" className="mt-3 text-sm text-ink-muted">
                {actionMessage}
              </p>
            )}
            {loadRelated && (
              <div className="mt-5 border-t border-stroke pt-4">
                <h3 className="mb-3 font-semibold text-ink">الدورات</h3>
                {relatedItems.length === 0 ? (
                  <p className="text-sm text-ink-muted">لا توجد دورات متاحة.</p>
                ) : (
                  <div className="grid gap-2 sm:grid-cols-2">
                    {relatedItems.map((item, index) => {
                      const record = asRecord(item);
                      if (!record) return null;
                      return (
                        <article
                          key={String(record.id ?? index)}
                          className="border border-stroke p-3"
                        >
                          <h4 className="font-medium text-ink">
                            {titleOf(record)}
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
          error={error}
          isEmpty={Boolean(data && data.items.length === 0)}
          emptyMessage={emptyMessage}
          onRetry={() => setReloadKey((key) => key + 1)}
        >
          {data && data.items.length > 0 && (
            <>
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                {data.items.map((item, index) => {
                  const record = asRecord(item);
                  if (!record) return null;
                  return (
                    <button
                      key={String(record.id ?? index)}
                      type="button"
                      onClick={() => void selectRecord(item)}
                      className="border border-stroke bg-surface p-5 text-start transition-colors hover:border-nuwa-base"
                    >
                      <h2 className="font-semibold text-ink">
                        {titleOf(record)}
                      </h2>
                      <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-ink-muted">
                        {String(
                          record.description ??
                            record.bio ??
                            record.subjectName ??
                            record.academicYear ??
                            "",
                        )}
                      </p>
                      <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-muted">
                        {["price", "subjectName", "academicYear", "courseCount"]
                          .filter((key) => record[key] !== undefined)
                          .map((key) => (
                            <span key={key}>
                              {key}: {displayValue(record[key])}
                            </span>
                          ))}
                      </div>
                      <span className="mt-4 inline-block text-sm font-medium text-nuwa-base">
                        عرض التفاصيل
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
