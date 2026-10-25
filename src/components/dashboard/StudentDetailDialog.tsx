import { useEffect, useRef, type ReactNode } from "react"

import { createPortal } from "react-dom"

import { X } from "lucide-react"

export default function StudentDetailDialog({
  title,

  description,

  onClose,

  children,
}: {
  title: string

  description?: string

  onClose: () => void

  children: ReactNode
}) {
  const closeButtonRef = useRef<HTMLButtonElement>(null)

  const onCloseRef = useRef(onClose)

  onCloseRef.current = onClose

  useEffect(() => {
    const previousOverflow = document.body.style.overflow

    document.body.style.overflow = "hidden"

    const activeElement =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null

    closeButtonRef.current?.focus()

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onCloseRef.current()

        return
      }

      if (event.key !== "Tab") return

      const dialog = closeButtonRef.current?.closest('[role="dialog"]')

      const focusable = dialog?.querySelectorAll<HTMLElement>(
        'button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])',
      )

      if (!focusable?.length) return

      const first = focusable[0]

      const last = focusable[focusable.length - 1]

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()

        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()

        first.focus()
      }
    }

    window.addEventListener("keydown", handleKeyDown)

    return () => {
      document.body.style.overflow = previousOverflow

      window.removeEventListener("keydown", handleKeyDown)

      activeElement?.focus()
    }
  }, [])

  return createPortal(
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center overflow-y-auto bg-slate-950/45 p-3 backdrop-blur-md sm:p-6"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="student-detail-title"
        aria-describedby={
          description ? "student-detail-description" : undefined
        }
        className="my-auto max-h-[min(90dvh,900px)] w-full max-w-3xl overflow-y-auto rounded-[28px] border border-white/70 bg-white shadow-[0_28px_90px_-30px_rgba(5,30,19,.55)]"
      >
        <header className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-stroke bg-white/95 px-5 py-4 backdrop-blur sm:px-7">
          <div className="min-w-0">
            <h2
              id="student-detail-title"
              className="truncate text-lg font-bold text-ink sm:text-xl"
            >
              {title}
            </h2>
            {description && (
              <p
                id="student-detail-description"
                className="mt-1 text-xs text-ink-muted"
              >
                {description}
              </p>
            )}
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            aria-label="إغلاق تفاصيل الطالب"
            className="grid size-10 shrink-0 place-items-center rounded-xl border border-stroke text-ink-muted transition hover:bg-canvas hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nuwa-base"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </header>
        <div className="p-4 sm:p-6">{children}</div>
      </section>
    </div>,

    document.body,
  )
}
