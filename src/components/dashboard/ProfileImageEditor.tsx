import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from "react"

import { ImagePlus, Trash2, Upload } from "lucide-react"

import { adminApi, studentsApi, teachersApi } from "../../api/endpoints"
import PersonAvatar from "../PersonAvatar"

type ProfileRole = "student" | "teacher" | "admin"

function responseImageUrl(value: unknown): string | null {
  let current = value
  for (let depth = 0; depth < 4; depth += 1) {
    if (typeof current === "string") {
      const url = current.trim()
      if (/^(https?:\/\/|\/|data:image\/)/i.test(url)) return url
    }
    if (typeof current !== "object" || current === null) break
    const response = current as Record<string, unknown>
    for (const key of [
      "avatarUrl",
      "avatar_url",
      "profileImageUrl",
      "profile_image_url",
      "profilePictureUrl",
      "imageUrl",
      "image_url",
      "url",
    ]) {
      const url = response[key]
      if (
        typeof url === "string" &&
        /^(https?:\/\/|\/|data:image\/)/i.test(url.trim())
      ) return url.trim()
    }
    current =
      response.data ?? response.profile ?? response.user ?? response.avatar
  }
  return null
}

export default function ProfileImageEditor({
  role,
  name,
  imageUrl,
  busy = false,
  onFeedback,
  onImageChange,
  onSaved,
}: {
  role: ProfileRole
  name: string
  imageUrl?: string
  busy?: boolean
  onFeedback: (message: string) => void
  onImageChange?: (imageUrl: string) => void
  onSaved: () => void
}) {
  const [file, setFile] = useState<File | null>(null)
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(null)
  const [removed, setRemoved] = useState(false)
  const [saving, setSaving] = useState(false)
  const previewUrl = useMemo(
    () => (file ? URL.createObjectURL(file) : null),
    [file],
  )

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
  }, [previewUrl])

  useEffect(() => {
    return () => {
      if (uploadedUrl?.startsWith("blob:")) URL.revokeObjectURL(uploadedUrl)
    }
  }, [uploadedUrl])

  const shownImage = removed ? "" : previewUrl ?? uploadedUrl ?? imageUrl ?? ""
  const disabled = busy || saving

  function selectImage(event: ChangeEvent<HTMLInputElement>) {
    const selected = event.currentTarget.files?.[0] ?? null
    event.currentTarget.value = ""
    if (!selected) return
    if (!(["image/jpeg", "image/png", "image/webp"] as string[]).includes(selected.type)) {
      setFile(null)
      onFeedback("اختر ملف صورة صالحًا.")
      return
    }
    if (selected.size > 5 * 1024 * 1024) {
      setFile(null)
      onFeedback("حجم الصورة يجب ألا يتجاوز 5 ميجابايت.")
      return
    }
    onFeedback("")
    setFile(selected)
    setRemoved(false)
  }

  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!file || disabled) return
    setSaving(true)
    onFeedback("")
    try {
      const response =
        role === "admin"
          ? await adminApi.uploadProfileImage(file)
          : role === "teacher"
            ? await teachersApi.uploadProfileImage(file)
            : await studentsApi.uploadProfileImage(file)
      const returnedUrl = responseImageUrl(response)
      setUploadedUrl(returnedUrl)
      if (returnedUrl) {
        if (role === "admin")
          window.sessionStorage.setItem("eduhub.auth.image", returnedUrl)
        window.dispatchEvent(
          new CustomEvent("eduhub:profile-image-updated", {
            detail: returnedUrl,
          }),
        )
        onImageChange?.(returnedUrl)
      }
      setFile(null)
      onFeedback("تم تحديث الصورة الشخصية.")
      onSaved()
    } catch (cause) {
      onFeedback(cause instanceof Error ? cause.message : "تعذر رفع الصورة.")
    } finally {
      setSaving(false)
    }
  }

  async function removeImage() {
    if (file && !imageUrl && !uploadedUrl) {
      setFile(null)
      return
    }
    if (!imageUrl && !uploadedUrl) return
    if (!window.confirm("هل تريد حذف الصورة الشخصية؟")) return
    setSaving(true)
    onFeedback("")
    try {
      if (role === "admin") await adminApi.deleteProfileImage()
      else if (role === "teacher") await teachersApi.deleteProfileImage()
      else await studentsApi.deleteProfileImage()
      window.sessionStorage.removeItem("eduhub.auth.image")
      window.dispatchEvent(
        new CustomEvent("eduhub:profile-image-updated", { detail: "" }),
      )
      onImageChange?.("")
      setFile(null)
      setUploadedUrl(null)
      setRemoved(true)
      onFeedback("تم حذف الصورة الشخصية.")
      onSaved()
    } catch (cause) {
      onFeedback(cause instanceof Error ? cause.message : "تعذر حذف الصورة.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="mt-6 rounded-2xl border border-stroke bg-[#f8faf9] p-4 sm:p-5">
      <div className="flex flex-wrap items-center gap-4">
        <PersonAvatar name={name} imageUrl={shownImage} size="lg" />
        <div className="min-w-0 flex-1">
          <h4 className="font-semibold text-ink">الصورة الشخصية</h4>
          <p className="mt-1 text-xs leading-6 text-ink-muted">
            اختر صورة واضحة بصيغة JPG أو PNG أو WEBP، بحد أقصى 5 ميجابايت.
          </p>
          {file && (
            <p className="mt-1 truncate text-xs font-medium text-emerald-800">
              الصورة المختارة: {file.name}
            </p>
          )}
        </div>
      </div>

      <form onSubmit={(event) => void upload(event)} className="mt-4">
        <label className="group flex min-h-28 cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-emerald-900/20 bg-white px-4 py-5 text-center transition hover:border-emerald-700 hover:bg-emerald-50/50">
          <span className="grid size-10 place-items-center rounded-full bg-emerald-50 text-emerald-800 transition group-hover:bg-emerald-100">
            <ImagePlus size={19} />
          </span>
          <span className="text-sm font-semibold text-ink">
            اضغط لاختيار صورة من جهازك
          </span>
          <span className="text-xs text-ink-muted">JPG · PNG · WEBP</span>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={selectImage}
            disabled={disabled}
            className="sr-only"
          />
        </label>
        <div className="mt-3 flex flex-wrap justify-end gap-2">
          {file && (
            <button
              type="button"
              onClick={() => setFile(null)}
              disabled={disabled}
              className="inline-flex min-h-10 items-center gap-2 rounded-full border border-stroke px-4 text-sm font-semibold text-ink transition hover:bg-neutral-50 disabled:opacity-50"
            >
              إلغاء اختيار الصورة
            </button>
          )}
          {!file && (imageUrl || uploadedUrl) && !removed && (
            <button
              type="button"
              onClick={() => void removeImage()}
              disabled={disabled}
              className="inline-flex min-h-10 items-center gap-2 rounded-full border border-red-200 px-4 text-sm font-semibold text-red-700 transition hover:bg-red-50 disabled:opacity-50"
            >
              <Trash2 size={15} /> حذف الصورة
            </button>
          )}
          <button
            type="submit"
            disabled={disabled || !file}
            className="inline-flex min-h-10 items-center gap-2 rounded-full bg-gradient-to-l from-[#0b3b25] to-[#176b43] px-5 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Upload size={15} />
            {saving ? "جارٍ رفع الصورة…" : "حفظ الصورة"}
          </button>
        </div>
      </form>
    </section>
  )
}
