import { lazy, Suspense, useEffect, useState } from "react"

import { getAuthToken } from "./api/client"

import type { NavigateFn, View } from "./types"

import PublicNavbar from "./components/layout/PublicNavbar"

const LandingPage = lazy(() => import("./pages/LandingPage"))

const AuthPage = lazy(() => import("./pages/AuthPage"))

const PublicCoursesPage = lazy(() => import("./pages/PublicCoursesPage"))

const PublicTeachersPage = lazy(() => import("./pages/PublicTeachersPage"))

const DashboardPage = lazy(() => import("./pages/DashboardPage"))

export default function App() {
  const [view, setView] = useState<View>(() => {
    const enrollmentPreview =
      import.meta.env.DEV &&
      new URLSearchParams(window.location.search).get(
        "teacherEnrollmentMock",
      ) === "1"

    return enrollmentPreview ? "dashboard" : "landing"
  })

  useEffect(() => {
    const handleExpiredSession = () => setView("login")

    window.addEventListener("eduhub:auth-expired", handleExpiredSession)

    return () =>
      window.removeEventListener("eduhub:auth-expired", handleExpiredSession)
  }, [])

  const navigate: NavigateFn = (nextView) => {
    setView(nextView === "dashboard" && !getAuthToken() ? "login" : nextView)

    window.scrollTo({ top: 0, behavior: "smooth" })
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
      <main>
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
