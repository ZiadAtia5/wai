import { lazy, Suspense, useState } from "react"

import type { NavigateFn, View } from "./types"

import PublicNavbar from "./components/layout/PublicNavbar"

const LandingPage = lazy(() => import("./pages/LandingPage"))

const AuthPage = lazy(() => import("./pages/AuthPage"))

const PublicCoursesPage = lazy(() => import("./pages/PublicCoursesPage"))

const PublicTeachersPage = lazy(() => import("./pages/PublicTeachersPage"))

export default function App() {
  const [view, setView] = useState<View>("landing")

  const navigate: NavigateFn = (nextView) => {
    setView(nextView)

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
      <PublicNavbar currentView={view} navigate={navigate} />
      <main>
        <Suspense
          fallback={<div className="min-h-[60vh] bg-canvas" aria-busy="true" />}
        >
          {view === "landing" && <LandingPage navigate={navigate} />}
          {view === "login" && <AuthPage mode="login" navigate={navigate} />}
          {view === "register" && (
            <AuthPage mode="register" navigate={navigate} />
          )}
          {view === "public:courses" && <PublicCoursesPage />}
          {view === "public:teachers" && <PublicTeachersPage />}
        </Suspense>
      </main>
    </div>
  )
}
