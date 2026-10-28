import { useEffect, useRef, useState } from "react"

function useInViewport<T extends Element>() {
  const elementRef = useRef<T | null>(null)
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    const element = elementRef.current
    if (!element || isVisible) return

    if (!("IntersectionObserver" in window)) {
      setIsVisible(true)
      return
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return
        setIsVisible(true)
        observer.disconnect()
      },
      { threshold: 0.15, rootMargin: "0px 0px -32px 0px" },
    )

    observer.observe(element)
    return () => observer.disconnect()
  }, [isVisible])

  return { elementRef, isVisible }
}

interface AnimatedNumberProps {
  value: string | number
  className?: string
}

export function AnimatedNumber({ value, className }: AnimatedNumberProps) {
  const raw = String(value)
  const normalized = raw
    .replace(/[٠-٩]/g, (digit) => String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)))
    .replace(/[۰-۹]/g, (digit) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(digit)))
    .replace(/٬/g, ",")
    .replace(/٫/g, ".")
  const match = normalized.match(/-?\d[\d,.]*/)
  const target = match ? Number(match[0].replace(/,/g, "")) : null
  const prefix = match ? normalized.slice(0, match.index) : ""
  const suffix = match
    ? normalized.slice((match.index ?? 0) + match[0].length)
    : ""
  const [current, setCurrent] = useState(0)
  const { elementRef, isVisible } = useInViewport<HTMLSpanElement>()

  useEffect(() => {
    if (!isVisible || target === null || !Number.isFinite(target)) return
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setCurrent(target)
      return
    }

    let frame = 0
    let startTime = 0
    const duration = 900
    setCurrent(0)
    const animate = (time: number) => {
      if (!startTime) startTime = time
      const progress = Math.min((time - startTime) / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setCurrent(target * eased)
      if (progress < 1) frame = window.requestAnimationFrame(animate)
    }
    frame = window.requestAnimationFrame(animate)
    return () => window.cancelAnimationFrame(frame)
  }, [isVisible, target])

  if (target === null || !Number.isFinite(target)) {
    return <span className={className}>{raw}</span>
  }

  const shown = Number.isInteger(target)
    ? Math.round(current)
    : Number(current.toFixed(1))

  return (
    <span ref={elementRef} className={className}>
      {prefix}
      {new Intl.NumberFormat("ar-EG", {
        maximumFractionDigits: Number.isInteger(target) ? 0 : 1,
      }).format(shown)}
      {suffix}
    </span>
  )
}

export function AnimatedBar({
  value,
  className,
}: {
  value: number
  className: string
}) {
  const { elementRef, isVisible } = useInViewport<HTMLDivElement>()
  const reduceMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)",
  ).matches
  const active = isVisible

  return (
    <div
      ref={elementRef}
      className={className}
      style={{
        width: `${active ? Math.max(0, Math.min(value, 100)) : 0}%`,
        transition: reduceMotion
          ? "none"
          : "width 900ms cubic-bezier(0.22, 1, 0.36, 1)",
      }}
    />
  )
}
