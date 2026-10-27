import { useEffect, useRef, useState } from "react"
import { FileCheck2, Upload } from "lucide-react"

export default function FileUploadField({
  name,
  title,
  accept,
  required = false,
  disabled = false,
  helperText = "اضغط لاختيار ملف من جهازك",
}: {
  name: string
  title: string
  accept?: string
  required?: boolean
  disabled?: boolean
  helperText?: string
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [fileName, setFileName] = useState("")

  useEffect(() => {
    const form = inputRef.current?.form
    if (!form) return

    const resetFileName = () => setFileName("")
    form.addEventListener("reset", resetFileName)

    return () => form.removeEventListener("reset", resetFileName)
  }, [])

  return (
    <div className="grid min-w-0 gap-2">
      <label
        className={`group relative flex min-h-16 cursor-pointer items-center gap-3 rounded-xl border border-dashed border-nuwa-base/30 bg-white px-3 py-2.5 transition hover:border-nuwa-base hover:bg-nuwa-soft/40 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-nuwa-base/30 ${disabled ? "cursor-not-allowed opacity-60" : ""}`}
      >
        <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-nuwa-soft text-nuwa-base transition group-hover:bg-white">
          <Upload size={18} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-xs font-bold text-ink">{title}</span>
          <span className="mt-1 block text-[11px] leading-4 text-ink-muted">
            {helperText}
          </span>
        </span>
        <span className="shrink-0 rounded-lg bg-canvas px-3 py-2 text-[11px] font-semibold text-nuwa-deep">
          استعراض
        </span>
        <input
          ref={inputRef}
          name={name}
          type="file"
          accept={accept}
          required={required}
          disabled={disabled}
          className="sr-only"
          onChange={(event) =>
            setFileName(event.currentTarget.files?.[0]?.name ?? "")
          }
        />
      </label>
      {fileName && (
        <span className="flex min-w-0 items-center gap-1.5 text-[11px] font-medium text-emerald-800">
          <FileCheck2 size={14} className="shrink-0" />
          <span className="truncate" title={fileName}>
            {fileName}
          </span>
        </span>
      )}
    </div>
  )
}
