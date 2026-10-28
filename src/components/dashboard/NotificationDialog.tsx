import { useEffect, type ReactNode } from "react"

import { createPortal } from "react-dom"

import { Bell, CheckCircle2, Clock3, Trash2, X } from "lucide-react"

export default function NotificationDialog({
  title,
  sender,
  date,
  unread,
  busy,
  onClose,
  onMarkRead,
  onDelete,
  children,
}: {
  title: string
  sender: string
  date?: ReactNode
  unread: boolean
  busy: boolean
  onClose: () => void
  onMarkRead: () => void
  onDelete: () => void
  children?: ReactNode
}) {
  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose()
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener("keydown", handleKeyDown)
    }
  }, [onClose])

  return createPortal(
    <div
      className="fixed inset-0 z-[150] flex items-center justify-center overflow-y-auto bg-slate-950/45 p-4 backdrop-blur-md sm:p-6"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="notification-dialog-title"
        className="my-auto w-full max-w-xl overflow-hidden rounded-[28px] border border-white/70 bg-white shadow-[0_28px_90px_-30px_rgba(5,30,19,.55)]"
      >
        <header className="flex items-start gap-3 border-b border-stroke/70 px-5 py-4 sm:px-6">
          <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-nuwa-soft text-nuwa-base">
            <Bell size={20} />
          </span>
          <div className="min-w-0 flex-1 pt-0.5">
            <div className="flex flex-wrap items-center gap-2">
              <h2
                id="notification-dialog-title"
                className="text-base font-extrabold leading-6 text-ink sm:text-lg"
              >
                {title}
              </h2>
              <span
                className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${
                  unread
                    ? "bg-emerald-100 text-emerald-800"
                    : "bg-slate-100 text-slate-500"
                }`}
              >
                {unread ? "جديد" : "مقروء"}
              </span>
            </div>
            <p className="mt-1 text-xs text-ink-muted">من {sender}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="إغلاق الإشعار"
            className="grid size-9 shrink-0 place-items-center rounded-xl border border-stroke text-ink-muted transition hover:bg-canvas hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nuwa-base"
          >
            <X size={17} />
          </button>
        </header>

        <div className="max-h-[55dvh] overflow-y-auto px-5 py-5 sm:px-6">
          {date != null && (
            <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-canvas px-3 py-1.5 text-xs text-ink-muted">
              <Clock3 size={14} />
              {date}
            </div>
          )}
          {children}
        </div>

        <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-stroke/70 bg-canvas/50 px-5 py-4 sm:px-6">
          <div>
            {unread ? (
              <button
                type="button"
                onClick={onMarkRead}
                disabled={busy}
                className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-nuwa-deep px-4 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-nuwa-base disabled:cursor-wait disabled:opacity-50"
              >
                <CheckCircle2 size={15} /> تحديد كمقروء
              </button>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700">
                <CheckCircle2 size={15} /> تمت قراءة الإشعار
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={onDelete}
            disabled={busy}
            className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-rose-200 bg-white px-3.5 py-2 text-xs font-semibold text-rose-700 transition hover:bg-rose-50 disabled:cursor-wait disabled:opacity-50"
          >
            <Trash2 size={14} /> حذف الإشعار
          </button>
        </footer>
      </section>
    </div>,
    document.body,
  )
}
