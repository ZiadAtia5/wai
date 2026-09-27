import { Menu, X } from "lucide-react"

import { useState } from "react"

import type { NavigateFn, View } from "../../types"

import NuwaLogo from "../NuwaLogo"

interface PublicNavbarProps {
  currentView: View

  navigate: NavigateFn
}

interface PublicNavigationItem {
  label: string
  view: View
}

const publicNavigation: PublicNavigationItem[] = [
  { label: "الرئيسية", view: "landing" },

  { label: "الدورات", view: "public:courses" },

  { label: "المعلمون", view: "public:teachers" },
]

export default function PublicNavbar({
  currentView,

  navigate,
}: PublicNavbarProps) {
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <header className="sticky top-0 z-40 border-b border-stroke bg-surface">
      <div className="mx-auto flex h-16 max-w-360 items-center gap-6 px-6">
        <button
          type="button"
          onClick={() => navigate("landing")}
          className="shrink-0"
          aria-label="الصفحة الرئيسية"
        >
          <NuwaLogo size="sm" />
        </button>

        <nav className="hidden flex-1 items-center justify-center gap-1 md:flex">
          {publicNavigation.map((item) => (
            <button
              type="button"
              key={item.view}
              onClick={() => navigate(item.view)}
              aria-current={currentView === item.view ? "page" : undefined}
              className={`rounded-lg px-3.5 py-2 text-sm font-medium transition-colors ${
                currentView === item.view
                  ? "bg-nuwa-soft text-nuwa-base"
                  : "text-ink-muted hover:bg-canvas hover:text-ink"
              }`}
            >
              {item.label}
            </button>
          ))}
        </nav>

        <button
          type="button"
          onClick={() => navigate("login")}
          className="ms-auto h-9 rounded-lg bg-nuwa-base px-4 text-sm font-medium text-white hover:bg-nuwa-deep"
        >
          تسجيل الدخول
        </button>

        <button
          type="button"
          className="flex h-9 w-9 items-center justify-center rounded-lg text-ink-muted hover:bg-canvas md:hidden"
          onClick={() => setMobileOpen((open) => !open)}
          aria-label={mobileOpen ? "إغلاق القائمة" : "فتح القائمة"}
          aria-expanded={mobileOpen}
        >
          {mobileOpen ? <X size={18} /> : <Menu size={18} />}
        </button>
      </div>

      {mobileOpen && (
        <nav className="flex flex-col gap-1 border-t border-stroke bg-surface px-4 py-3 md:hidden">
          {publicNavigation.map((item) => (
            <button
              type="button"
              key={item.view}
              onClick={() => {
                navigate(item.view)

                setMobileOpen(false)
              }}
              className="rounded-lg px-3 py-2.5 text-start text-sm font-medium text-ink-muted hover:bg-canvas hover:text-ink"
            >
              {item.label}
            </button>
          ))}
        </nav>
      )}
    </header>
  )
}
