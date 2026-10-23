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
import { createPortal } from "react-dom"
import { motion } from "framer-motion"

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
  const [scrolled, setScrolled] = useState(false)

  const isAuthenticated = Boolean(getAuthToken())
  const isOnLandingHero = currentView === "landing" && !scrolled

  useEffect(() => {
    const updateScrollState = () => setScrolled(window.scrollY > 24)
    updateScrollState()
    window.addEventListener("scroll", updateScrollState, { passive: true })
    return () => window.removeEventListener("scroll", updateScrollState)
  }, [])

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
    createPortal(<>
      <header className={`fixed inset-x-3 top-4 z-[100] mx-auto max-w-7xl rounded-[1.75rem] border backdrop-blur-xl transition-colors duration-300 sm:inset-x-6 sm:top-5 ${isOnLandingHero ? "border-[#dce9de]/90 bg-white/85 shadow-[0_10px_32px_rgba(18,67,42,.1)]" : "border-white/50 bg-surface/85 shadow-[0_12px_36px_rgba(9,40,25,.14)]"}`}>
        <div className="relative mx-auto flex h-16 max-w-360 items-center justify-between gap-4 px-4 sm:px-6">
          <button
            type="button"
            onClick={() => goTo("landing")}
            className="shrink-0"
            aria-label="الصفحة الرئيسية"
          >
            <NuwaLogo size="sm" />
          </button>
          <nav
            className="absolute left-1/2 top-1/2 hidden -translate-x-1/2 -translate-y-1/2 items-center justify-center gap-1 lg:flex"
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
                  className={`relative isolate rounded-xl px-4 py-2 text-sm font-semibold transition-colors ${
                    isActive
                      ? "text-nuwa-base"
                    : isOnLandingHero
                      ? "text-[#50665a] hover:text-nuwa-deep"
                      : "text-ink-muted hover:text-ink"
                  }`}
                >
                  {isActive && (
                    <motion.span
                      layoutId="public-navigation-active"
                      className="absolute inset-0 z-0 rounded-xl bg-nuwa-soft"
                      transition={{ type: "spring", stiffness: 420, damping: 34 }}
                    />
                  )}
                  <span className="relative z-10">{label}</span>
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
                      : isOnLandingHero
                        ? "text-[#50665a] hover:bg-[#edf5ef] hover:text-nuwa-deep"
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
            className={`grid size-10 place-items-center rounded-xl transition lg:hidden ${isOnLandingHero ? "border border-[#dce9de] bg-white text-ink-muted hover:bg-[#edf5ef]" : "border border-stroke bg-white text-ink-muted shadow-nuwa hover:bg-canvas hover:text-nuwa-base"}`}
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
          className="fixed inset-0 z-[110] bg-neutral-950/45 backdrop-blur-[2px]"
        />
      )}
      <aside
        id="public-sidebar"
        aria-label="القائمة الرئيسية"
        aria-hidden={!mobileOpen}
        inert={!mobileOpen}
        className={`fixed inset-y-0 right-0 z-[120] h-dvh w-[min(86vw,320px)] overflow-y-auto overscroll-contain border-l border-stroke bg-white p-4 shadow-2xl transition-transform duration-200 ${
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
    </>, document.body)
  )
}
