import { useCallback, useEffect, useState, type FormEvent } from "react"

import { ApiError } from "../api/client"

import { getAuthToken } from "../api/client"

import {
  getAcademicYears,
  type AcademicYearResponse,
  type ApiRecord,
  type PagedResult,
} from "../api/catalog"

import ApiQueryState from "../components/ApiQueryState"

import { useApiQuery } from "../hooks/useApiQuery"

import type { NavigateFn } from "../types"

import { notifyError, notifySuccess } from "../utils/notifications"

interface PublicCatalogPageProps {
  title: string

  description: string

  emptyMessage: string

  load: (
    page?: number,

    pageSize?: number,

    search?: string,

    academicYear?: string,
  ) => Promise<PagedResult<ApiRecord>>

  loadDetail?: (id: string) => Promise<unknown>

  loadRelated?: (id: string) => Promise<unknown>

  action?: (id: string) => Promise<unknown>

  actionLabel?: string

  navigate?: NavigateFn
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null
    ? value as Record<string, unknown>
    : null
}

function titleOf(record: Record<string, unknown>): string {
  return String(
    record.title ??
      record.fullName ??
      record.name ??
      record.teacherName ??
      record.email ??
      "عنصر من المنصة",
  )
}

function displayValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "-"

  return typeof value === "object" ? JSON.stringify(value) : String(value)
}

function teacherNameOf(record: Record<string, unknown>): string | null {
  const nested = asRecord(record.teacher)
  const value = record.teacherName ?? record.instructorName ?? nested?.fullName ?? nested?.name
  return typeof value === "string" && value.trim() ? value.trim() : null
}

function scalarFields(record: Record<string, unknown>): [string, unknown][] {
  return Object.entries(record).filter(
    ([key, value]) =>
      !/(^id$|id$|token|image|url|createdAt|updatedAt)/i.test(key) &&
      key !== "description" &&
      value !== null &&
      ["string", "number", "boolean"].includes(typeof value),
  )
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
}: PublicCatalogPageProps) {
  const [page, setPage] = useState(1)

  const [reloadKey, setReloadKey] = useState(0)

  const [detail, setDetail] = useState<Record<string, unknown> | null>(null)

  const [related, setRelated] = useState<unknown>(null)

  const [, setActionMessage] = useState("")

  const [actionLoading, setActionLoading] = useState(false)

  const [searchInput, setSearchInput] = useState("")

  const [search, setSearch] = useState("")

  const [academicYear, setAcademicYear] = useState("")

  const [academicYears, setAcademicYears] = useState<AcademicYearResponse[]>([])

  useEffect(() => {
    let active = true

    getAcademicYears()

      .then((years) => {
        if (active) setAcademicYears(years)
      })

      .catch(() => undefined)

    return () => {
      active = false
    }
  }, [])

  const pageLoader = useCallback(
    () => load(page, 12, search, academicYear),

    [load, page, search, academicYear],
  )

  const { data, error, loading } = useApiQuery(pageLoader, reloadKey)

  async function selectRecord(item: ApiRecord) {
    const record = asRecord(item)

    if (!record) return

    setDetail(record)

    setRelated(null)

    setActionMessage("")

    if (record.id === undefined || record.id === null) return

    try {
      const id = String(record.id)

      if (loadDetail) {
        const result = asRecord(await loadDetail(id))

        if (result) setDetail(result)
      }

      if (loadRelated) setRelated(await loadRelated(id))
    } catch (cause) {
      notifyError(cause, "تعذر تحميل التفاصيل.")

      setActionMessage(
        cause instanceof ApiError ? cause.message : "تعذر تحميل التفاصيل.",
      )
    }
  }

  async function runAction() {
    if (!action || detail?.id === undefined || detail.id === null) return

    if (!getAuthToken()) {
      notifyError(new Error("يجب تسجيل الدخول أولاً لإرسال طلب الالتحاق."))

      setActionMessage("سجّل الدخول أولاً لإرسال طلب الالتحاق.")

      navigate?.("login")

      return
    }

    if (actionLoading) return

    setActionLoading(true)

    try {
      await action(String(detail.id))

      notifySuccess("تم إرسال طلب الالتحاق بنجاح.")

      setActionMessage("تم إرسال طلب الالتحاق بنجاح.")
    } catch (cause) {
      notifyError(cause, "تعذر إرسال طلب الالتحاق.")

      setActionMessage(
        cause instanceof Error ? cause.message : "تعذر تنفيذ الطلب.",
      )
    } finally {
      setActionLoading(false)
    }
  }

  const relatedItems = Array.isArray(related)
    ? related
    : asRecord(related) && Array.isArray(asRecord(related)?.items)
      ? asRecord(related)?.items as unknown[]
      : []

  const detailFields = detail ? scalarFields(detail) : []

  return (
    <div className="min-h-screen bg-canvas pb-16">
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
        <form
          onSubmit={(event: FormEvent<HTMLFormElement>) => {
            event.preventDefault()

            setPage(1)

            setSearch(searchInput.trim())

            setDetail(null)
          }}
          className="mb-6 grid gap-3 rounded-xl border border-stroke bg-surface p-4 sm:grid-cols-[1fr_220px_auto]"
        >
          <label className="grid gap-1 text-xs font-semibold text-ink-muted">
            بحث
            <input
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              className="h-10 rounded-lg border border-stroke bg-white px-3 text-sm text-ink"
              placeholder="اكتب الاسم أو عنوان الدورة"
            />
          </label>
          <label className="grid gap-1 text-xs font-semibold text-ink-muted">
            الصف الدراسي
            <select
              value={academicYear}
              onChange={(event) => {
                setAcademicYear(event.target.value)

                setPage(1)

                setDetail(null)
              }}
              className="h-10 rounded-lg border border-stroke bg-white px-3 text-sm text-ink"
            >
              <option value="">كل الصفوف</option>
              {academicYears.map((year) => (
                <option key={year.id} value={year.value}>
                  {year.arabicName}
                </option>
              ))}
            </select>
          </label>
          <button className="self-end rounded-lg bg-nuwa-base px-5 py-2.5 text-sm font-semibold text-white">
            بحث
          </button>
        </form>
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
                  setDetail(null)

                  setRelated(null)
                }}
                className="h-9 border border-stroke px-3 text-sm"
              >
                إغلاق
              </button>
            </div>
            {typeof (detail.description ?? detail.bio) === "string" && (
              <details className="mt-4 rounded-xl border border-stroke bg-canvas p-4">
                <summary className="cursor-pointer text-sm font-semibold text-nuwa-base">
                  قراءة الوصف الكامل
                </summary>
                <p className="mt-3 whitespace-pre-line text-sm leading-7 text-ink-muted">
                  {String(detail.description ?? detail.bio)}
                </p>
              </details>
            )}
            <dl className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {detailFields.slice(0, 6).map(([key, value]) => (
                <div key={key}>
                  <dt className="text-xs text-ink-muted">{key}</dt>
                  <dd className="mt-1 wrap-break-word text-sm text-ink">
                    {displayValue(value)}
                  </dd>
                </div>
              ))}
            </dl>
            {detailFields.length > 6 && (
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
                disabled={actionLoading}
                onClick={() => void runAction()}
                className="mt-5 h-10 rounded-lg bg-nuwa-base px-4 text-sm font-medium text-white disabled:cursor-wait disabled:opacity-60"
              >
                {actionLoading ? "جارٍ الإرسال..." : (actionLabel ?? "تنفيذ")}
              </button>
            )}
            {loadRelated && (
              <div className="mt-5 border-t border-stroke pt-4">
                <h3 className="mb-3 font-semibold text-ink">الدورات</h3>
                {relatedItems.length === 0 ? (
                  <p className="text-sm text-ink-muted">لا توجد دورات متاحة.</p>
                ) : (
                  <div className="grid gap-2 sm:grid-cols-2">
                    {relatedItems.map((item, index) => {
                      const record = asRecord(item)

                      if (!record) return null

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
                      )
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
                  const record = asRecord(item)

                  if (!record) return null

                  return (
                    <button
                      key={String(record.id ?? index)}
                      type="button"
                      onClick={() => void selectRecord(item)}
                      className="group rounded-2xl border border-stroke bg-surface p-5 text-start shadow-sm transition hover:-translate-y-1 hover:border-sky-300 hover:shadow-nuwa-md"
                    >
                      <h2 className="font-semibold text-ink">
                        {titleOf(record)}
                      </h2>
                      {teacherNameOf(record) && (
                        <p className="mt-1 text-xs font-semibold text-sky-700">
                          المعلم: {teacherNameOf(record)}
                        </p>
                      )}
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
                  )
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
                      setPage((value) => value - 1)

                      setDetail(null)
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
                      setPage((value) => value + 1)

                      setDetail(null)
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
  )
}
