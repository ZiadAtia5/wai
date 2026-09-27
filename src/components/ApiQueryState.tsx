interface ApiQueryStateProps {
  loading: boolean

  error: string | null

  isEmpty: boolean

  emptyMessage: string

  onRetry: () => void

  children: React.ReactNode
}

export default function ApiQueryState({
  loading,

  error,

  isEmpty,

  emptyMessage,

  onRetry,

  children,
}: ApiQueryStateProps) {
  if (loading) {
    return (
      <div
        className="py-16 text-center text-sm text-ink-muted"
        aria-live="polite"
      >
        جارٍ تحميل البيانات من الخادم...
      </div>
    )
  }

  if (error) {
    return (
      <div className="py-16 text-center" role="alert">
        <p className="text-sm text-danger mb-4">{error}</p>
        <button
          type="button"
          onClick={onRetry}
          className="h-10 px-5 bg-nuwa-base text-white text-sm font-medium rounded-lg hover:bg-nuwa-deep"
        >
          إعادة المحاولة
        </button>
      </div>
    )
  }

  if (isEmpty) {
    return (
      <div className="py-16 text-center text-sm text-ink-muted">
        {emptyMessage}
      </div>
    )
  }

  return children
}
