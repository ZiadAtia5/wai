import { lazy, Suspense, useEffect, useLayoutEffect, useState } from "react"

import { getAuthToken } from "./api/client"

import type { NavigateFn, View } from "./types"

import PublicNavbar from "./components/layout/PublicNavbar"

const LandingPage = lazy(() => import("./pages/LandingPage"))

const AuthPage = lazy(() => import("./pages/AuthPage"))

const PublicCoursesPage = lazy(() => import("./pages/PublicCoursesPage"))

const CourseDetailsPage = lazy(() => import("./pages/CourseDetailsPage"))

const PublicTeachersPage = lazy(() => import("./pages/PublicTeachersPage"))

const DashboardPage = lazy(() => import("./pages/DashboardPage"))

export default function App() {
  const [view, setView] = useState<View>(() => {
    const savedView = window.history.state?.waiApp
      ? window.history.state.view as View | undefined
      : undefined
    if (
      savedView &&
      [
        "landing",
        "login",
        "register",
        "public:courses",
        "public:course-detail",
        "public:teachers",
        "dashboard",
      ].includes(savedView)
    ) {
      return savedView
    }

    const enrollmentPreview =
      import.meta.env.DEV &&
      new URLSearchParams(window.location.search).get(
        "teacherEnrollmentMock",
      ) === "1"

    return enrollmentPreview ? "dashboard" : "landing"
  })

  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(
    () =>
      window.history.state?.waiApp &&
      typeof window.history.state.selectedCourseId === "string"
        ? window.history.state.selectedCourseId
        : null,
  )

  useEffect(() => {
    const handleExpiredSession = () => setView("login")

    window.addEventListener("eduhub:auth-expired", handleExpiredSession)

    return () =>
      window.removeEventListener("eduhub:auth-expired", handleExpiredSession)
  }, [])

  useEffect(() => {
    const current = window.history.state
    if (!current?.waiApp) {
      window.history.replaceState(
        { waiApp: true, view, selectedCourseId },
        "",
        window.location.href,
      )
    }

    const restoreAppView = (event: PopStateEvent) => {
      const state = event.state
      if (!state?.waiApp || typeof state.view !== "string") return

      setView(state.view as View)
      setSelectedCourseId(
        typeof state.selectedCourseId === "string"
          ? state.selectedCourseId
          : null,
      )
    }

    window.addEventListener("popstate", restoreAppView)
    return () => window.removeEventListener("popstate", restoreAppView)
  }, [])

  useLayoutEffect(() => {
    window.scrollTo(0, 0)
    document.documentElement.scrollTop = 0
    document.body.scrollTop = 0
  }, [view])

  const navigate: NavigateFn = (nextView, params) => {
    const targetView =
      nextView === "dashboard" && !getAuthToken() ? "login" : nextView
    const targetCourseId =
      targetView === "public:course-detail"
        ? params?.courseId ?? null
        : null

    if (targetView === view && targetCourseId === selectedCourseId) return

    window.history.pushState(
      { waiApp: true, view: targetView, selectedCourseId: targetCourseId },
      "",
      window.location.href,
    )

    setSelectedCourseId(targetCourseId)

    setView(targetView)

  }

  return (
    <div
      className="min-h-screen bg-canvas text-ink"
      style={{
        fontFamily:
          "'IBM Plex Sans Arabic', 'IBM Plex Sans', system-ui, sans-serif",
      }}
    >
      {view !== "dashboard" && (
        <PublicNavbar currentView={view} navigate={navigate} />
      )}
      <main className={view === "dashboard" ? undefined : "pt-16"}>
        <Suspense
          fallback={<div className="min-h-[60vh] bg-canvas" aria-busy="true" />}
        >
          {view === "landing" && <LandingPage navigate={navigate} />}
          {view === "login" && <AuthPage mode="login" navigate={navigate} />}
          {view === "register" && (
            <AuthPage mode="register" navigate={navigate} />
          )}
          {view === "public:courses" && (
            <PublicCoursesPage navigate={navigate} />
          )}
          {view === "public:course-detail" && selectedCourseId && (
            <CourseDetailsPage
              courseId={selectedCourseId}
              navigate={navigate}
            />
          )}
          {view === "public:course-detail" && !selectedCourseId && (
            <PublicCoursesPage navigate={navigate} />
          )}
          {view === "public:teachers" && <PublicTeachersPage />}
          {view === "dashboard" &&
            (getAuthToken() ? (
              <DashboardPage navigate={navigate} />
            ) : (
              <AuthPage mode="login" navigate={navigate} />
            ))}
        </Suspense>
      </main>
    </div>
  )
}
