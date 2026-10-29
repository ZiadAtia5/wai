import { ChevronLeft, ChevronRight } from "lucide-react"

interface CoursePaginationProps {
  page: number

  totalPages: number

  onPageChange: (page: number) => void

  disabled?: boolean

  label?: string
}

export default function CoursePagination({
  page,

  totalPages,

  onPageChange,

  disabled = false,

  label = "صفحات الدورات",
}: CoursePaginationProps) {
  if (totalPages <= 1) return null

  const visiblePages = Array.from(
    { length: totalPages },

    (_, index) => index + 1,
  ).filter(
    (number) =>
      number === 1 || number === totalPages || Math.abs(number - page) <= 1,
  )

  return (
    <nav
      aria-label={label}
      className="mt-6 flex flex-wrap items-center justify-center gap-2 rounded-2xl border border-stroke bg-white p-3 shadow-sm"
    >
      <button
        type="button"
        aria-label="الصفحة السابقة"
        disabled={page <= 1 || disabled}
        onClick={() => onPageChange(Math.max(1, page - 1))}
        className="grid size-10 place-items-center rounded-xl border border-stroke text-ink transition hover:border-nuwa-base hover:text-nuwa-base disabled:cursor-not-allowed disabled:opacity-40"
      >
        <ChevronRight size={18} aria-hidden="true" />
      </button>
      {visiblePages.map((number, index) => {
        const previous = visiblePages[index - 1]

        return (
          <span key={number} className="contents">
            {previous !== undefined && number - previous > 1 && (
              <span aria-hidden="true" className="px-1 text-ink-muted">
                …
              </span>
            )}
            <button
              type="button"
              aria-label={`الصفحة ${number}`}
              aria-current={page === number ? "page" : undefined}
              disabled={disabled}
              onClick={() => onPageChange(number)}
              className={`grid size-10 place-items-center rounded-xl text-sm font-bold transition disabled:cursor-wait disabled:opacity-60 ${
                page === number
                  ? "bg-nuwa-base text-white shadow-sm"
                  : "border border-stroke bg-white text-ink-muted hover:border-nuwa-base hover:text-nuwa-base"
              }`}
            >
              {number}
            </button>
          </span>
        )
      })}
      <button
        type="button"
        aria-label="الصفحة التالية"
        disabled={page >= totalPages || disabled}
        onClick={() => onPageChange(Math.min(totalPages, page + 1))}
        className="grid size-10 place-items-center rounded-xl border border-stroke text-ink transition hover:border-nuwa-base hover:text-nuwa-base disabled:cursor-not-allowed disabled:opacity-40"
      >
        <ChevronLeft size={18} aria-hidden="true" />
      </button>
    </nav>
  )
}
