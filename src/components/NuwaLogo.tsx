interface NuwaLogoProps {
  size?: "sm" | "md" | "lg"
  variant?: "full" | "mark" | "wordmark"
  color?: "default" | "white" | "deep"
  className?: string
}

export default function NuwaLogo({
  size = "md",
  variant = "full",
  color = "default",
  className = "",
}: NuwaLogoProps) {
  const sizes = { sm: 28, md: 36, lg: 48 }
  const h = sizes[size]

  const primaryColor =
    color === "white" ? "#FFFFFF" : color === "deep" ? "#123B66" : "#1769AA"
  const accentColor =
    color === "white"
      ? "rgba(255,255,255,0.6)"
      : color === "deep"
        ? "#2388D9"
        : "#2388D9"

  const NuwaMark = () => (
    <svg
      width={h}
      height={h}
      viewBox="0 0 36 36"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {/* Outer orbital ring */}
      <circle
        cx="18"
        cy="18"
        r="15"
        stroke={primaryColor}
        strokeWidth="1.5"
        fill="none"
        opacity="0.25"
      />
      {/* Inner ring */}
      <circle
        cx="18"
        cy="18"
        r="9"
        stroke={primaryColor}
        strokeWidth="1.8"
        fill="none"
        opacity="0.5"
      />
      {/* Core seed */}
      <circle cx="18" cy="18" r="4.5" fill={primaryColor} />
      {/* Orbital accent arc */}
      <path
        d="M 8 14 A 12 12 0 0 1 28 14"
        stroke={accentColor}
        strokeWidth="2"
        fill="none"
        strokeLinecap="round"
      />
    </svg>
  )

  if (variant === "mark") return <NuwaMark />

  const textSizes = { sm: "text-xl", md: "text-2xl", lg: "text-3xl" }
  const subSizes = { sm: "text-[9px]", md: "text-[11px]", lg: "text-sm" }

  const textColor = color === "white" ? "text-white" : "text-nuwa-deep"

  if (variant === "wordmark") {
    return (
      <div
        className={`flex flex-col items-start leading-none gap-0.5 ${className}`}
      >
        <span
          className={`${textSizes[size]} font-bold ${textColor} tracking-tight leading-none`}
          style={{
            fontFamily: "'IBM Plex Sans Arabic', sans-serif",
            letterSpacing: "-0.02em",
          }}
        >
          وَعي
        </span>
        <span
          className={`${subSizes[size]} font-medium tracking-[0.18em] uppercase`}
          style={{
            color: color === "white" ? "rgba(255,255,255,0.7)" : "#526579",
          }}
        >
          WAI
        </span>
      </div>
    )
  }

  return (
    <div
      className={`flex items-center gap-2.5 ${className}`}
      role="img"
      aria-label="شعار وَعي"
    >
      <NuwaMark />
      <div className="flex flex-col leading-none gap-0.5">
        <span
          className={`${textSizes[size]} font-bold ${textColor} tracking-tight leading-none`}
          style={{
            fontFamily: "'IBM Plex Sans Arabic', sans-serif",
            letterSpacing: "-0.02em",
          }}
        >
          وَعي
        </span>
        <span
          className={`${subSizes[size]} font-medium tracking-[0.18em] uppercase`}
          style={{
            color: color === "white" ? "rgba(255,255,255,0.6)" : "#526579",
          }}
        >
          WAI
        </span>
      </div>
    </div>
  )
}
