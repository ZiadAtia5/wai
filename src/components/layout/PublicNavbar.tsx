import {
  BookOpen,
  GraduationCap,
  House,
  LayoutDashboard,
  LogIn,
  Menu,
  UserPlus,
  X,
} from "lucide-react"

import { useEffect, useState } from "react"

import { getAuthToken } from "../../api/client"

import type { NavigateFn, View } from "../../types"

import NuwaLogo from "../NuwaLogo"

interface PublicNavbarProps {
  currentView: View

  navigate: NavigateFn
}

interface PublicNavigationItem {
  label: string

  view: View

  icon: typeof House
}

const publicNavigation: PublicNavigationItem[] = [
  { label: "الرئيسية", view: "landing", icon: House },

  { label: "الدورات", view: "public:courses", icon: BookOpen },

  { label: "المعلمون", view: "public:teachers", icon: GraduationCap },
]

export default function PublicNavbar({
  currentView,

  navigate,
}: PublicNavbarProps) {
  const [mobileOpen, setMobileOpen] = useState(false)

  const isAuthenticated = Boolean(getAuthToken())

  useEffect(() => {
    if (!mobileOpen) return

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileOpen(false)
    }

    window.addEventListener("keydown", closeOnEscape)

    return () => window.removeEventListener("keydown", closeOnEscape)
  }, [mobileOpen])

  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 1024px)")
    const closeOnDesktop = (event: MediaQueryListEvent) => {
      if (event.matches) setMobileOpen(false)
    }

    desktop.addEventListener("change", closeOnDesktop)
    return () => desktop.removeEventListener("change", closeOnDesktop)
  }, [])

  const goTo = (view: View) => {
    navigate(view)

    setMobileOpen(false)
  }

  return (
    <>
      <header className="fixed inset-x-0 top-0 z-40 border-b border-stroke bg-surface/95 shadow-sm backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-360 items-center justify-between gap-4 px-4 sm:px-6">
          <button
            type="button"
            onClick={() => goTo("landing")}
            className="shrink-0"
            aria-label="الصفحة الرئيسية"
          >
            <NuwaLogo size="sm" />
          </button>
          <nav
            className="hidden flex-1 items-center justify-center gap-1 lg:flex"
            aria-label="روابط المنصة"
          >
            {publicNavigation.map(({ label, view }) => {
              const isActive =
                currentView === view ||
                (view === "public:courses" &&
                  currentView === "public:course-detail")

              return (
                <button
                  type="button"
                  key={view}
                  onClick={() => goTo(view)}
                  aria-current={isActive ? "page" : undefined}
                  className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
                    isActive
                      ? "bg-nuwa-soft text-nuwa-base"
                      : "text-ink-muted hover:bg-canvas hover:text-ink"
                  }`}
                >
                  {label}
                </button>
              )
            })}
          </nav>
          <div className="hidden items-center gap-2 lg:flex">
            {isAuthenticated ? (
              <button
                type="button"
                onClick={() => goTo("dashboard")}
                className="inline-flex h-10 items-center gap-2 rounded-xl bg-nuwa-base px-4 text-sm font-semibold text-white transition hover:bg-nuwa-deep"
              >
                <LayoutDashboard size={17} />
                مساحة العمل
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => goTo("login")}
                  className={`h-10 rounded-xl px-4 text-sm font-semibold transition ${
                    currentView === "login"
                      ? "bg-nuwa-soft text-nuwa-base"
                      : "text-ink-muted hover:bg-canvas hover:text-ink"
                  }`}
                >
                  تسجيل الدخول
                </button>
                <button
                  type="button"
                  onClick={() => goTo("register")}
                  className="h-10 rounded-xl bg-nuwa-base px-4 text-sm font-semibold text-white transition hover:bg-nuwa-deep"
                >
                  إنشاء حساب
                </button>
              </>
            )}
          </div>
          <button
            type="button"
            className="grid size-10 place-items-center rounded-xl border border-stroke bg-white text-ink-muted shadow-nuwa transition hover:bg-canvas hover:text-nuwa-base lg:hidden"
            onClick={() => setMobileOpen((open) => !open)}
            aria-label={mobileOpen ? "إغلاق القائمة" : "فتح القائمة"}
            aria-expanded={mobileOpen}
            aria-controls="public-sidebar"
          >
            {mobileOpen ? <X size={19} /> : <Menu size={19} />}
          </button>
        </div>
      </header>

      {mobileOpen && (
        <button
          type="button"
          aria-label="إغلاق القائمة"
          onClick={() => setMobileOpen(false)}
          className="fixed inset-0 z-40 bg-neutral-950/45 backdrop-blur-[2px]"
        />
      )}
      <aside
        id="public-sidebar"
        aria-label="القائمة الرئيسية"
        aria-hidden={!mobileOpen}
        inert={!mobileOpen}
        className={`fixed inset-y-0 right-0 z-50 h-dvh w-[min(86vw,320px)] overflow-y-auto overscroll-contain border-l border-stroke bg-white p-4 shadow-2xl transition-transform duration-200 ${
          mobileOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="mb-6 flex items-center justify-between">
          <NuwaLogo size="sm" />
          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            className="grid size-9 place-items-center rounded-lg text-ink-muted transition hover:bg-canvas hover:text-ink"
            aria-label="إغلاق القائمة"
          >
            <X size={18} />
          </button>
        </div>

        <div className="mb-5 rounded-2xl bg-gradient-to-l from-nuwa-deep to-nuwa-base p-4 text-white">
          <p className="text-xs font-semibold text-white/75">
            {isAuthenticated ? "مرحباً بعودتك" : "ابدأ رحلتك التعليمية"}
          </p>
          <p className="mt-1 text-sm font-bold">
            {isAuthenticated ? "منصة وَعي" : "كل ما تحتاجه للتعلّم في مكان واحد"}
          </p>
        </div>

        <p className="mb-2 px-3 text-[11px] font-bold text-neutral-400">
          القائمة الرئيسية
        </p>
        <nav className="grid gap-1" aria-label="روابط المنصة">
          {publicNavigation.map(({ label, view, icon: Icon }) => {
            const isActive =
              currentView === view ||
              (view === "public:courses" &&
                currentView === "public:course-detail")

            return (
              <button
                type="button"
                key={view}
                onClick={() => goTo(view)}
                aria-current={isActive ? "page" : undefined}
                className={`relative flex w-full items-center gap-3 rounded-xl px-3 py-3 text-start text-sm font-semibold transition ${
                  isActive
                    ? "bg-nuwa-soft text-nuwa-base"
                    : "text-neutral-600 hover:bg-neutral-50 hover:text-ink"
                }`}
              >
                <Icon size={18} />
                <span className="flex-1">{label}</span>
                {isActive && (
                  <span className="absolute bottom-2 right-0 top-2 w-1 rounded-l-full bg-nuwa-base" />
                )}
              </button>
            )
          })}
        </nav>

        <p className="mb-2 mt-6 px-3 text-[11px] font-bold text-neutral-400">
          حسابك
        </p>
        <nav className="grid gap-1" aria-label="روابط الحساب">
          {isAuthenticated ? (
            <button
              type="button"
              onClick={() => goTo("dashboard")}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-start text-sm font-semibold text-neutral-600 transition hover:bg-neutral-50 hover:text-nuwa-base"
            >
              <LayoutDashboard size={18} />
              مساحة العمل
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={() => goTo("login")}
                className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-start text-sm font-semibold transition ${
                  currentView === "login"
                    ? "bg-nuwa-soft text-nuwa-base"
                    : "text-neutral-600 hover:bg-neutral-50 hover:text-nuwa-base"
                }`}
              >
                <LogIn size={18} />
                تسجيل الدخول
              </button>
              <button
                type="button"
                onClick={() => goTo("register")}
                className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-start text-sm font-semibold transition ${
                  currentView === "register"
                    ? "bg-nuwa-soft text-nuwa-base"
                    : "text-neutral-600 hover:bg-neutral-50 hover:text-nuwa-base"
                }`}
              >
                <UserPlus size={18} />
                إنشاء حساب
              </button>
            </>
          )}
        </nav>
      </aside>
    </>
  )
}
