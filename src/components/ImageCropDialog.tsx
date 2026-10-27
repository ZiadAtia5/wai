import { useEffect, useRef, useState, type PointerEvent } from "react"
import { createPortal } from "react-dom"
import { LoaderCircle } from "lucide-react"

interface ImageCropDialogProps {
  file: File

  aspectRatio: number

  outputFormat?: "image/jpeg"

  maxOutputWidth?: number

  title: string

  onCancel: () => void

  onApply: (file: File) => void
}

interface Point {
  x: number

  y: number
}

interface DragStart {
  pointer: Point

  center: Point
}

export default function ImageCropDialog({
  file,

  aspectRatio,

  outputFormat,

  maxOutputWidth = 1600,

  title,

  onCancel,

  onApply,
}: ImageCropDialogProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const dragStart = useRef<DragStart | null>(null)

  const [image, setImage] = useState<HTMLImageElement | null>(null)

  const [imageLoading, setImageLoading] = useState(true)

  const [center, setCenter] = useState<Point>({ x: 0, y: 0 })

  const [zoom, setZoom] = useState(1)

  const [processing, setProcessing] = useState(false)

  const [error, setError] = useState("")

  useEffect(() => {
    const previousBodyOverflow = document.body.style.overflow
    const previousDocumentOverflow = document.documentElement.style.overflow

    document.body.style.overflow = "hidden"
    document.documentElement.style.overflow = "hidden"

    return () => {
      document.body.style.overflow = previousBodyOverflow
      document.documentElement.style.overflow = previousDocumentOverflow
    }
  }, [])

  useEffect(() => {
    let active = true
    const url = URL.createObjectURL(file)
    const loadedImage = new Image()
    setImage(null)
    setImageLoading(true)
    setError("")
    loadedImage.onload = () => {
      if (!active) return
      setImage(loadedImage)
      setImageLoading(false)
      setCenter({
        x: loadedImage.naturalWidth / 2,

        y: loadedImage.naturalHeight / 2,
      })

      setZoom(1)

      setError("")
    }
    loadedImage.onerror = () => {
      if (active) {
        setImageLoading(false)
        setError("تعذر فتح الصورة. اختر صورة أخرى.")
      }
    }
    loadedImage.src = url

    return () => {
      active = false
      URL.revokeObjectURL(url)
    }
  }, [file])

  const baseCropWidth = image
    ? Math.min(image.naturalWidth, image.naturalHeight * aspectRatio)
    : 0

  const cropWidth = baseCropWidth / zoom

  const cropHeight = cropWidth / aspectRatio

  useEffect(() => {
    const canvas = canvasRef.current

    const context = canvas?.getContext("2d")

    if (!canvas || !context || !image) return

    canvas.width = 720

    canvas.height = Math.round(canvas.width / aspectRatio)

    const left = Math.max(
      0,

      Math.min(image.naturalWidth - cropWidth, center.x - cropWidth / 2),
    )

    const top = Math.max(
      0,

      Math.min(image.naturalHeight - cropHeight, center.y - cropHeight / 2),
    )

    context.clearRect(0, 0, canvas.width, canvas.height)

    context.drawImage(
      image,

      left,

      top,

      cropWidth,

      cropHeight,

      0,

      0,

      canvas.width,

      canvas.height,
    )
  }, [aspectRatio, center, cropHeight, cropWidth, image])

  function moveCrop(event: PointerEvent<HTMLCanvasElement>) {
    const start = dragStart.current

    const canvas = canvasRef.current

    if (!start || !canvas || !image) return

    const bounds = canvas.getBoundingClientRect()

    const nextCenter = {
      x:
        start.center.x -
        (event.clientX - start.pointer.x) * (cropWidth / bounds.width),

      y:
        start.center.y -
        (event.clientY - start.pointer.y) * (cropHeight / bounds.height),
    }

    setCenter({
      x: Math.max(
        cropWidth / 2,
        Math.min(image.naturalWidth - cropWidth / 2, nextCenter.x),
      ),

      y: Math.max(
        cropHeight / 2,
        Math.min(image.naturalHeight - cropHeight / 2, nextCenter.y),
      ),
    })
  }

  function applyCrop() {
    const canvas = canvasRef.current

    if (!canvas || !image || processing) return

    setProcessing(true)

    setError("")

    const outputWidth = Math.max(
      1,
      Math.min(maxOutputWidth, Math.round(cropWidth)),
    )

    const outputHeight = Math.round(outputWidth / aspectRatio)

    const outputCanvas = document.createElement("canvas")

    outputCanvas.width = outputWidth

    outputCanvas.height = outputHeight

    const context = outputCanvas.getContext("2d")

    if (!context) {
      setProcessing(false)

      setError("تعذر تجهيز الصورة. جرّب صورة أخرى.")

      return
    }

    const left = Math.max(
      0,

      Math.min(image.naturalWidth - cropWidth, center.x - cropWidth / 2),
    )

    const top = Math.max(
      0,

      Math.min(image.naturalHeight - cropHeight, center.y - cropHeight / 2),
    )

    try {
      if (outputFormat === "image/jpeg") {
        context.fillStyle = "#ffffff"
        context.fillRect(0, 0, outputWidth, outputHeight)
      }
      context.drawImage(
        image,

        left,

        top,

        cropWidth,

        cropHeight,

        0,

        0,

        outputWidth,

        outputHeight,
      )

      outputCanvas.toBlob(
        (blob) => {
          setProcessing(false)

          if (!blob) {
            setError("تعذر تجهيز الصورة. جرّب صورة أخرى.")

            return
          }

          const extension =
            blob.type === "image/jpeg"
              ? "jpg"
              : blob.type.split("/")[1] || "png"

          const name = file.name.replace(/\.[^.]+$/, "")

          onApply(
            new File([blob], `${name}-cropped.${extension}`, {
              type: blob.type,

              lastModified: Date.now(),
            }),
          )
        },

        outputFormat ?? file.type,

        outputFormat === "image/jpeg" ? 0.85 : 0.92,
      )
    } catch {
      setProcessing(false)

      setError("تعذر تجهيز الصورة. جرّب صورة أخرى.")
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-[9999] grid h-[100dvh] w-full place-items-center overflow-hidden bg-slate-950/30 p-3 backdrop-blur-md sm:p-5">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="image-crop-title"
        className="flex h-[min(90dvh,900px)] max-h-[calc(100dvh-1.5rem)] min-h-0 w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-white/70 bg-white p-4 shadow-2xl shadow-slate-950/20 sm:p-6"
      >
        <header className="shrink-0">
          <h2 id="image-crop-title" className="text-lg font-bold text-ink">
            {title}
          </h2>
          <p className="mt-1 text-sm text-ink-muted">
            حرّك الصورة داخل الإطار، واستخدم شريط التكبير لضبط المقاس.
          </p>
        </header>
        <div className="relative mt-3 flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-xl bg-emerald-50 ring-1 ring-emerald-900/10">
          <canvas
            ref={canvasRef}
            aria-label="معاينة الصورة بعد القص"
            className="block h-auto max-h-full max-w-full touch-none cursor-grab active:cursor-grabbing"
            style={{ aspectRatio }}
            onPointerDown={(event) => {
              event.currentTarget.setPointerCapture(event.pointerId)

              dragStart.current = {
                pointer: { x: event.clientX, y: event.clientY },

                center,
              }
            }}
            onPointerMove={moveCrop}
            onPointerUp={() => {
              dragStart.current = null
            }}
            onPointerCancel={() => {
              dragStart.current = null
            }}
          />
          {imageLoading && (
            <div
              role="status"
              className="absolute inset-0 grid place-items-center bg-white/75 text-sm font-medium text-ink-muted backdrop-blur-sm"
            >
              <span className="inline-flex items-center gap-2">
                <LoaderCircle
                  size={18}
                  className="animate-spin text-nuwa-base"
                />
                جاري تجهيز معاينة الصورة…
              </span>
            </div>
          )}
        </div>
        <label className="mt-3 grid shrink-0 gap-2 text-sm font-semibold text-ink">
          التكبير
          <input
            type="range"
            min="1"
            max="3"
            step="0.05"
            value={zoom}
            disabled={!image || processing}
            onChange={(event) => setZoom(Number(event.currentTarget.value))}
            className="w-full accent-emerald-700"
          />
        </label>
        {error && (
          <p role="alert" className="mt-3 text-sm text-danger">
            {error}
          </p>
        )}
        <div className="mt-4 flex shrink-0 flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={processing}
            className="min-h-10 rounded-full border border-stroke px-5 text-sm font-semibold text-ink disabled:opacity-50"
          >
            إلغاء
          </button>
          <button
            type="button"
            onClick={applyCrop}
            disabled={!image || processing}
            className="min-h-10 rounded-full bg-nuwa-base px-5 text-sm font-semibold text-white disabled:opacity-50"
          >
            {processing ? "جارٍ تجهيز الصورة…" : "استخدام الصورة"}
          </button>
        </div>
      </section>
    </div>,
    document.body,
  )
}
