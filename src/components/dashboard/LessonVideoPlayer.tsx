import { useEffect, useRef } from "react"

type VideoRecord = Record<string, unknown>

function asRecord(value: unknown): VideoRecord {
  return typeof value === "object" && value !== null
    ? value as VideoRecord
    : {}
}

export function youtubeVideoId(value: unknown): string | null {
  if (typeof value !== "string") return null
  const input = value.trim()
  if (/^[\w-]{11}$/.test(input)) return input

  try {
    const url = new URL(input)
    const host = url.hostname.toLowerCase().replace(/^www\./, "")
    if (url.protocol !== "https:" && url.protocol !== "http:") return null
    if (host === "youtu.be") {
      const id = url.pathname.split("/").filter(Boolean)[0]
      return id && /^[\w-]{11}$/.test(id) ? id : null
    }
    if (!["youtube.com", "m.youtube.com", "youtube-nocookie.com"].includes(host)) return null
    const path = url.pathname.split("/").filter(Boolean)
    const id = url.searchParams.get("v") ??
      (["embed", "shorts", "live"].includes(path[0] ?? "") ? path[1] : null)
    return id && /^[\w-]{11}$/.test(id) ? id : null
  } catch {
    return null
  }
}

function safeMediaUrl(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null
  try {
    const base = import.meta.env.VITE_API_BASE_URL || window.location.origin
    const url = new URL(value.trim(), base)
    if (url.protocol !== "https:") return null
    if (url.username || url.password) return null
    return url.href
  } catch {
    return null
  }
}

export default function LessonVideoPlayer({
  video: value,
  title,
  lastPosition = 0,
  onPause,
  onEnded,
}: {
  video: unknown
  title: string
  lastPosition?: number
  onPause?: (seconds: number) => void
  onEnded?: (seconds: number) => void
}) {
  const video = asRecord(value)
  const youtubeId = youtubeVideoId(video.providerVideoId) ?? youtubeVideoId(video.videoUrl)
  const src = youtubeId
    ? `https://www.youtube-nocookie.com/embed/${youtubeId}?rel=0&modestbranding=1`
    : safeMediaUrl(video.videoUrl)
  const playerRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    const player = playerRef.current
    if (!player || !Number.isFinite(lastPosition) || lastPosition <= 0) return
    const resume = () => {
      if (player.duration > lastPosition) player.currentTime = lastPosition
      player.removeEventListener("loadedmetadata", resume)
    }
    player.addEventListener("loadedmetadata", resume)
    return () => player.removeEventListener("loadedmetadata", resume)
  }, [lastPosition, src])

  if (!src) {
    return (
      <div className="mt-3 rounded-2xl border border-dashed border-stroke bg-canvas px-4 py-6 text-center text-sm text-ink-muted">
        لا يوجد فيديو صالح للعرض في هذا الدرس.
      </div>
    )
  }

  return (
    <div className="mt-4 overflow-hidden rounded-2xl border border-stroke bg-[#071f14] shadow-lg shadow-emerald-950/10">
      <div className="flex items-center justify-between gap-3 border-b border-white/10 px-4 py-3 text-white">
        <span className="min-w-0 truncate text-sm font-semibold">{title}</span>
        <span className="shrink-0 rounded-full bg-white/10 px-2.5 py-1 text-[11px] text-emerald-50">
          {youtubeId ? "مشاهدة عبر يوتيوب" : "فيديو الدرس"}
        </span>
      </div>
      <div className="aspect-video w-full bg-black">
        {youtubeId ? (
          <iframe
            src={src}
            title={title}
            className="size-full border-0"
            loading="lazy"
            referrerPolicy="strict-origin-when-cross-origin"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
          />
        ) : (
          <video
            ref={playerRef}
            src={src}
            title={title}
            controls
            playsInline
            preload="metadata"
            controlsList="nodownload noremoteplayback"
            disablePictureInPicture
            className="size-full"
            onPause={(event) => onPause?.(event.currentTarget.currentTime)}
            onEnded={(event) => onEnded?.(event.currentTarget.currentTime)}
          >
            المتصفح لا يدعم تشغيل الفيديو.
          </video>
        )}
      </div>
    </div>
  )
}
