import { lazy, Suspense, useEffect, useLayoutEffect, useState } from "react"
import { motion } from "framer-motion"

import { getAuthToken } from "./api/client"

import type { NavigateFn, View } from "./types"

import PublicNavbar from "./components/layout/PublicNavbar"

const LandingPage = lazy(() => import("./pages/landing/LandingPage"))

const AuthPage = lazy(() => import("./pages/AuthPage"))

const PublicCoursesPage = lazy(() => import("./pages/PublicCoursesPage"))

const CourseDetailsPage = lazy(() => import("./pages/CourseDetailsPage"))

const PublicTeachersPage = lazy(() => import("./pages/PublicTeachersPage"))

const TeacherPlatformPage = lazy(() => import("./pages/TeacherPlatformPage"))

const DashboardPage = lazy(() => import("./pages/DashboardPage"))

interface TeacherRoute {
  teacherId: string
  courseId: string | null
}

function teacherRouteFromPath(pathname: string): TeacherRoute | null {
  const match = pathname.match(
    /^\/teacher\/([a-z0-9_-]+)(?:\/course\/([a-z0-9_-]+))?\/?$/i,
  )

  if (!match) return null

  return {
    teacherId: match[1],
    courseId: match[2] ?? null,
  }
}

export default function App() {
  const [teacherRoute, setTeacherRoute] = useState<TeacherRoute | null>(() =>
    teacherRouteFromPath(window.location.pathname),
  )
  const teacherId = teacherRoute?.teacherId ?? null
  const [view, setView] = useState<View>(() => {
    if (teacherRoute) {
      return teacherRoute.courseId
        ? "public:course-detail"
        : "teacher:platform"
    }

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
        "teacher:platform",
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
      teacherRoute?.courseId ??
      (window.history.state?.waiApp &&
      typeof window.history.state.selectedCourseId === "string"
        ? window.history.state.selectedCourseId
        : null),
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
      const currentRoute = teacherRouteFromPath(window.location.pathname)
      setTeacherRoute(currentRoute)

      if (currentRoute) {
        setView(
          currentRoute.courseId
            ? "public:course-detail"
            : "teacher:platform",
        )
        setSelectedCourseId(currentRoute.courseId)
        return
      }

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
    const targetTeacherId =
      targetView === "teacher:platform"
        ? params?.teacherId ?? teacherId
        : targetView === "public:course-detail"
          ? params?.teacherId ?? teacherId
          : null

    if (
      targetView === view &&
      targetCourseId === selectedCourseId &&
      targetTeacherId === teacherId
    ) {
      return
    }

    const targetPath = targetTeacherId
      ? targetView === "public:course-detail" && targetCourseId
        ? `/teacher/${encodeURIComponent(targetTeacherId)}/course/${encodeURIComponent(targetCourseId)}`
        : `/teacher/${encodeURIComponent(targetTeacherId)}`
      : teacherRoute
        ? "/"
        : window.location.pathname

    window.history.pushState(
      { waiApp: true, view: targetView, selectedCourseId: targetCourseId },
      "",
      `${targetPath}${window.location.search}${window.location.hash}`,
    )

    setSelectedCourseId(targetCourseId)
    setTeacherRoute(
      targetTeacherId
        ? { teacherId: targetTeacherId, courseId: targetCourseId }
        : null,
    )

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
      {view !== "dashboard" && view !== "landing" && (
        <PublicNavbar currentView={view} navigate={navigate} />
      )}
      <main
        className={
          view === "dashboard"
            ? undefined
            : view === "landing"
              ? "pt-0"
              : "pt-24"
        }
      >
        <motion.div
          key={`${view}:${selectedCourseId ?? ""}`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.16, ease: "easeOut" }}
        >
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
              onBack={
                teacherId
                  ? () =>
                      navigate("teacher:platform", {
                        teacherId,
                      })
                  : undefined
              }
            />
          )}
          {view === "public:course-detail" && !selectedCourseId && (
            <PublicCoursesPage navigate={navigate} />
          )}
          {view === "public:teachers" && (
            <PublicTeachersPage navigate={navigate} />
          )}
          {view === "teacher:platform" && teacherId && (
            <TeacherPlatformPage teacherId={teacherId} navigate={navigate} />
          )}
          {view === "dashboard" &&
            (getAuthToken() ? (
              <DashboardPage navigate={navigate} />
            ) : (
              <AuthPage mode="login" navigate={navigate} />
            ))}
          </Suspense>
        </motion.div>
      </main>
    </div>
  )
}
