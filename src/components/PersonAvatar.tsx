import { useState } from "react"
import { resolveApiAssetUrl } from "../api/client"

interface PersonAvatarProps {
  name: string
  imageUrl?: string
  size?: "sm" | "md" | "lg"
  status?: "active" | "pending" | "inactive"
}

const avatarColors = [
  "bg-[#f6cbb7]",
  "bg-[#f5c1bc]",
  "bg-[#ccebd0]",
  "bg-[#cfd6f7]",
  "bg-[#f4dfb2]",
  "bg-[#e4d1f4]",
  "bg-[#c9e9ec]",
  "bg-[#f9dfc5]",
]

const sizeClasses = {
  sm: "size-10 text-xs",
  md: "size-14 text-base",
  lg: "size-20 text-2xl",
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  return (parts.length > 1
    ? `${parts[0][0]}${parts.at(-1)?.[0] ?? ""}`
    : parts[0]?.slice(0, 2) ?? "?").toLocaleUpperCase()
}

export default function PersonAvatar({
  name,
  imageUrl,
  size = "md",
  status,
}: PersonAvatarProps) {
  const [failedImageUrl, setFailedImageUrl] = useState<string | null>(null)
  const colorIndex = [...name].reduce((sum, character) => sum + character.charCodeAt(0), 0) % avatarColors.length
  const resolvedImageUrl = imageUrl ? resolveApiAssetUrl(imageUrl) : ""

  return (
    <span className={`relative inline-grid shrink-0 place-items-center ${sizeClasses[size]}`}>
      <span
        className={`grid size-full place-items-center overflow-hidden rounded-full font-semibold text-ink ${avatarColors[colorIndex]}`}
      >
        {resolvedImageUrl && failedImageUrl !== imageUrl ? (
          <img
            src={resolvedImageUrl}
            alt=""
            className="size-full object-cover"
            onError={() => setFailedImageUrl(imageUrl ?? "")}
          />
        ) : (
          initials(name)
        )}
      </span>
      {status && status !== "active" && (
        <span
          className={`absolute bottom-0 right-0 size-3.5 rounded-full border-2 border-white ${
            status === "pending" ? "bg-amber-500" : "bg-neutral-400"
          }`}
          aria-label={
            status === "pending" ? "قيد الانتظار" : "غير نشط"
          }
        />
      )}
    </span>
  )
}

