import { useState, type FormEvent } from "react"
import { LoaderCircle } from "lucide-react"

import { teachersApi } from "../../api/endpoints"
import { useConfirmation } from "../ConfirmationProvider"
import FileUploadField from "./FileUploadField"

export default function TeacherAvatarForm({
  busy,

  onFeedback,

  onSaved,
}: {
  busy: boolean

  onFeedback: (message: string) => void

  onSaved: () => void
}) {
  const confirm = useConfirmation()
  const [deleting, setDeleting] = useState(false)
  const [uploading, setUploading] = useState(false)

  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const file = new FormData(event.currentTarget).get("file")

    if (!(file instanceof File) || !file.size) return

    onFeedback("")
    setUploading(true)

    try {
      await teachersApi.uploadProfileImage(file)

      onFeedback("تم تحديث الصورة الشخصية.")

      onSaved()
    } catch (cause) {
      onFeedback(cause instanceof Error ? cause.message : "تعذر رفع الصورة.")
    } finally {
      setUploading(false)
    }
  }

  async function remove() {
    const confirmed = await confirm({
      title: "حذف الصورة الشخصية؟",
      message: "سيتم حذف الصورة من ملف المعلم وإظهار الصورة الافتراضية.",
      variant: "danger",
      confirmText: "حذف الصورة",
      onConfirm: async () => {
        setDeleting(true)
        onFeedback("")
        try {
          await teachersApi.deleteProfileImage()
        } finally {
          setDeleting(false)
        }
      },
    })
    if (!confirmed) return

    onFeedback("تم حذف الصورة الشخصية.")
    onSaved()
  }

  return (
    <form
      onSubmit={(event) => void upload(event)}
      className="mt-4 flex flex-wrap items-end gap-3 border-t border-stroke pt-4"
    >
      <div className="min-w-0 flex-1">
        <FileUploadField
          name="file"
          title="اختيار صورة شخصية"
          accept="image/*"
          required
          disabled={busy || deleting || uploading}
        />
      </div>
      <button
        disabled={busy || deleting || uploading}
        className="inline-flex items-center gap-2 rounded-lg border border-stroke px-4 py-2 text-sm font-semibold text-ink disabled:opacity-50"
      >
        {uploading && <LoaderCircle size={15} className="animate-spin" />}
        {uploading ? "جارٍ رفع الصورة…" : "رفع الصورة"}
      </button>
      <button
        type="button"
        disabled={busy || deleting || uploading}
        onClick={() => void remove()}
        className="rounded-lg px-4 py-2 text-sm font-semibold text-danger disabled:opacity-50"
      >
        حذف الصورة
      </button>
    </form>
  )
}
