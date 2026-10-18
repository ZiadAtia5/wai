import { useState, type FormEvent } from "react"

import { teachersApi } from "../../api/endpoints"
import { useConfirmation } from "../ConfirmationProvider"

const labelClass = "grid gap-1 text-xs font-semibold text-ink-muted"

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

  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const file = new FormData(event.currentTarget).get("file")

    if (!(file instanceof File) || !file.size) return

    onFeedback("")

    try {
      await teachersApi.uploadProfileImage(file)

      onFeedback("تم تحديث الصورة الشخصية.")

      onSaved()
    } catch (cause) {
      onFeedback(cause instanceof Error ? cause.message : "تعذر رفع الصورة.")
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
      <label className={labelClass}>
        الصورة الشخصية
        <input
          name="file"
          type="file"
          accept="image/*"
          required
          className="max-w-full text-sm"
        />
      </label>
      <button
        disabled={busy || deleting}
        className="rounded-lg border border-stroke px-4 py-2 text-sm font-semibold text-ink disabled:opacity-50"
      >
        رفع الصورة
      </button>
      <button
        type="button"
        disabled={busy || deleting}
        onClick={() => void remove()}
        className="rounded-lg px-4 py-2 text-sm font-semibold text-danger disabled:opacity-50"
      >
        حذف الصورة
      </button>
    </form>
  )
}
