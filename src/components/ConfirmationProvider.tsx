import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react"

import { AlertTriangle, Info, LoaderCircle, ShieldAlert, X } from "lucide-react"

export type ConfirmationVariant = "danger" | "warning" | "info" | "primary"

export interface ConfirmationOptions {
  title: string

  message: string

  variant?: ConfirmationVariant

  confirmText?: string

  cancelText?: string

  onConfirm?: () => void | Promise<void>
}

interface ConfirmationRequest extends ConfirmationOptions {
  resolve: (confirmed: boolean) => void
}

type ConfirmAction = (options: ConfirmationOptions) => Promise<boolean>

const ConfirmationContext = createContext<ConfirmAction | null>(null)

const variantStyles: Record<ConfirmationVariant, {
  icon: typeof ShieldAlert
  iconClass: string
  buttonClass: string
}> = {
  danger: {
    icon: ShieldAlert,

    iconClass: "bg-red-100 text-red-700",

    buttonClass: "bg-red-600 hover:bg-red-700 focus-visible:ring-red-500",
  },

  warning: {
    icon: AlertTriangle,

    iconClass: "bg-amber-100 text-amber-700",

    buttonClass: "bg-amber-500 hover:bg-amber-600 focus-visible:ring-amber-500",
  },

  info: {
    icon: Info,

    iconClass: "bg-sky-100 text-sky-700",

    buttonClass: "bg-sky-700 hover:bg-sky-800 focus-visible:ring-sky-600",
  },

  primary: {
    icon: Info,

    iconClass: "bg-nuwa-soft text-nuwa-base",

    buttonClass:
      "bg-nuwa-base hover:bg-nuwa-deep focus-visible:ring-nuwa-bright",
  },
}

export function useConfirmation(): ConfirmAction {
  const confirm = useContext(ConfirmationContext)

  if (!confirm) {
    throw new Error("useConfirmation must be used inside ConfirmationProvider.")
  }

  return confirm
}

export function ConfirmationProvider({ children }: { children: ReactNode }) {
  const [activeRequest, setActiveRequest] =
    useState<ConfirmationRequest | null>(null)

  const [isLoading, setIsLoading] = useState(false)

  const [isClosing, setIsClosing] = useState(false)

  const [errorMessage, setErrorMessage] = useState("")

  const activeRef = useRef<ConfirmationRequest | null>(null)

  const queueRef = useRef<ConfirmationRequest[]>([])

  const closingRef = useRef(false)

  const cancelButtonRef = useRef<HTMLButtonElement>(null)

  const confirmButtonRef = useRef<HTMLButtonElement>(null)

  const restoreFocusRef = useRef<HTMLElement | null>(null)

  const confirm = useCallback<ConfirmAction>((options) => {
    return new Promise<boolean>((resolve) => {
      const request: ConfirmationRequest = { ...options, resolve }

      if (activeRef.current) {
        queueRef.current.push(request)

        return
      }

      restoreFocusRef.current =
        document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null

      activeRef.current = request

      setErrorMessage("")

      setIsLoading(false)

      setIsClosing(false)

      closingRef.current = false

      setActiveRequest(request)
    })
  }, [])

  const settle = useCallback(
    (confirmed: boolean) => {
      if (isLoading || closingRef.current) return

      const current = activeRef.current

      if (!current) return

      closingRef.current = true

      setIsClosing(true)

      window.setTimeout(() => {
        const nextRequest = queueRef.current.shift() ?? null

        activeRef.current = nextRequest

        setErrorMessage("")

        setIsLoading(false)

        setIsClosing(false)

        closingRef.current = false

        setActiveRequest(nextRequest)

        // Let React commit the closed dialog first so its effect cleanup
        // restores body scrolling before callers navigate (notably on iOS).
        window.requestAnimationFrame(() => current.resolve(confirmed))

        if (!nextRequest) {
          window.setTimeout(() => restoreFocusRef.current?.focus(), 0)
        }
      }, 160)
    },
    [isLoading],
  )

  useEffect(() => {
    if (!activeRequest) return

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"

    const focusFrame = window.requestAnimationFrame(() => {
      cancelButtonRef.current?.focus()
    })

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault()

        if (!isLoading && !isClosing) settle(false)

        return
      }

      if (event.key !== "Tab") return

      const dialog = document.getElementById("confirmation-dialog")

      const focusable = dialog?.querySelectorAll<HTMLElement>(
        'button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])',
      )

      if (!focusable?.length) {
        event.preventDefault()
        dialog?.focus()
        return
      }

      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (!dialog?.contains(document.activeElement)) {
        event.preventDefault()
        const target = event.shiftKey ? last : first
        target.focus()
        return
      }

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

      window.cancelAnimationFrame(focusFrame)

      window.removeEventListener("keydown", handleKeyDown)
    }
  }, [activeRequest, isClosing, isLoading, settle])

  async function handleConfirm() {
    if (!activeRequest || isLoading) return

    if (!activeRequest.onConfirm) {
      settle(true)

      return
    }

    setIsLoading(true)

    setErrorMessage("")

    try {
      await activeRequest.onConfirm()

      settle(true)
    } catch (cause) {
      setErrorMessage(
        cause instanceof Error && cause.message
          ? cause.message
          : "تعذر إتمام العملية. حاول مرة أخرى.",
      )

      setIsLoading(false)

      confirmButtonRef.current?.focus()
    }
  }

  const variant = activeRequest?.variant ?? "primary"

  const styles = variantStyles[variant]

  const Icon = styles.icon

  return (
    <ConfirmationContext.Provider value={confirm}>
      <div inert={Boolean(activeRequest)}>{children}</div>
      {activeRequest && (
        <div
          className={`confirmation-backdrop fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-slate-950/45 p-4 backdrop-blur-md ${
            isClosing ? "confirmation-exit" : ""
          }`}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !isClosing)
              settle(false)
          }}
        >
          <section
            id="confirmation-dialog"
            role={variant === "danger" ? "alertdialog" : "dialog"}
            aria-modal="true"
            aria-labelledby="confirmation-title"
            aria-describedby="confirmation-message"
            aria-busy={isLoading}
            tabIndex={-1}
            className={`confirmation-panel my-auto w-full max-w-md overflow-hidden rounded-[28px] border border-white/70 bg-white shadow-[0_28px_90px_-30px_rgba(5,30,19,.55)] ${
              isClosing ? "confirmation-panel-exit" : ""
            }`}
          >
            <div className="relative p-6 sm:p-7">
              <button
                type="button"
                onClick={() => settle(false)}
                disabled={isLoading || isClosing}
                aria-label="إغلاق نافذة التأكيد"
                className="absolute left-4 top-4 grid size-9 place-items-center rounded-full text-ink-muted transition hover:bg-canvas hover:text-ink disabled:cursor-not-allowed disabled:opacity-50"
              >
                <X size={18} />
              </button>
              <div
                className={`grid size-14 place-items-center rounded-2xl ${styles.iconClass}`}
              >
                <Icon size={25} strokeWidth={1.9} aria-hidden="true" />
              </div>
              <h2
                id="confirmation-title"
                className="mt-5 pe-6 text-xl font-bold leading-snug text-ink sm:text-2xl"
              >
                {activeRequest.title}
              </h2>
              <p
                id="confirmation-message"
                className="mt-2 whitespace-pre-line text-sm leading-7 text-ink-muted"
              >
                {activeRequest.message}
              </p>
              {errorMessage && (
                <p
                  role="alert"
                  className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm leading-6 text-red-800"
                >
                  {errorMessage}
                </p>
              )}
              <div className="mt-7 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <button
                  ref={cancelButtonRef}
                  type="button"
                  onClick={() => settle(false)}
                  disabled={isLoading || isClosing}
                  className="inline-flex min-h-11 items-center justify-center rounded-xl border border-stroke px-5 text-sm font-semibold text-ink transition hover:bg-canvas focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nuwa-bright disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {activeRequest.cancelText ?? "إلغاء"}
                </button>
                <button
                  ref={confirmButtonRef}
                  type="button"
                  onClick={() => void handleConfirm()}
                  disabled={isLoading || isClosing}
                  className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-5 text-sm font-semibold text-white shadow-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-70 ${styles.buttonClass}`}
                >
                  {isLoading && (
                    <LoaderCircle size={17} className="animate-spin" />
                  )}
                  {isLoading
                    ? "جارٍ التنفيذ..."
                    : (activeRequest.confirmText ?? "تأكيد")}
                </button>
              </div>
            </div>
          </section>
        </div>
      )}
    </ConfirmationContext.Provider>
  )
}
