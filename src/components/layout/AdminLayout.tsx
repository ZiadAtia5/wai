import type { ReactNode } from "react"

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div
      className="flex min-h-dvh flex-1 flex-col bg-canvas text-ink"
      style={{
        fontFamily:
          "'IBM Plex Sans Arabic', 'IBM Plex Sans', system-ui, sans-serif",
      }}
    >
      {children}
    </div>
  )
}
