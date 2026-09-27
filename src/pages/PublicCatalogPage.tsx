import { useState } from "react"

import { useApiQuery } from "../hooks/useApiQuery"

import type { ApiRecord, PagedResult } from "../api/catalog"

import ApiQueryState from "../components/ApiQueryState"

interface PublicCatalogPageProps {
  title: string

  description: string

  emptyMessage: string

  load: () => Promise<PagedResult<ApiRecord>>
}

export default function PublicCatalogPage({
  title,

  description,

  emptyMessage,

  load,
}: PublicCatalogPageProps) {
  const [reloadKey, setReloadKey] = useState(0)

  const { data, error, loading } = useApiQuery(load, reloadKey)

  const hasUnmappedItems = Boolean(data && data.items.length > 0)

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
        <ApiQueryState
          loading={loading}
          error={error}
          isEmpty={Boolean(data && data.items.length === 0)}
          emptyMessage={emptyMessage}
          onRetry={() => setReloadKey((key) => key + 1)}
        >
          {hasUnmappedItems ? (
            <div className="border-s-4 border-warning bg-warning-light p-4 text-sm text-ink">
              أعاد الخادم عناصر، لكن حقول DTO غير متاحة للتحقق من التوثيق
              الحالي؛ لم تُعرض بيانات غير معروفة.
            </div>
          ) : null}
        </ApiQueryState>
      </main>
    </div>
  )
}
