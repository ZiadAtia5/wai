import { lazy, Suspense, useEffect, useRef, useState } from "react"

import { AnimatePresence, MotionConfig } from "framer-motion"

import { getAuthToken } from "./api/client"
import AuthPage from "./pages/AuthPage"

import type { NavigateFn, View } from "./types"

import PublicNavbar from "./components/layout/PublicNavbar"

import PlatformFooter from "./components/layout/PlatformFooter"
import PageTransition from "./components/motion/PageTransition"
import { PublicCatalogPageSkeleton } from "./components/loading/SkeletonLayouts"
import { LandingPageSkeleton } from "./pages/landing/components/LandingSkeletons"

const LandingPage = lazy(() => import("./pages/landing/LandingPage"))

const PublicCoursesPage = lazy(() => import("./pages/PublicCoursesPage"))

const CourseDetailsPage = lazy(() => import("./pages/CourseDetailsPage"))

const PublicTeachersPage = lazy(() => import("./pages/PublicTeachersPage"))

const TeacherPlatformPage = lazy(() => import("./pages/TeacherPlatformPage"))

const DashboardPage = lazy(() => import("./pages/DashboardPage"))

function PublicPageFallback({
  kind = "course",
  catalog = false,
  landing = false,
}: {
  kind?: "course" | "person"
  catalog?: boolean
  landing?: boolean
}) {
  if (landing) {
    return <LandingPageSkeleton />
  }

  if (catalog) {
    return <PublicCatalogPageSkeleton kind={kind} />
  }

  return null
}

function pageDirection(from: View, to: View): -1 | 0 | 1 {
  if (from === "public:courses" && to === "public:course-detail") return 1
  if (from === "public:course-detail" && to === "public:courses") return -1
  return 0
}

interface TeacherRoute {
  teacherId: string

  courseId: string | null
}

function teacherRouteFromPath(pathname: string): TeacherRoute | null {
  const match = pathname.match(
    /(?:^|\/)teacher\/([^/]+)(?:\/course\/([^/]+))?\/?$/i,
  )

  if (!match) return null

  const decodeSegment = (value: string) => {
    try {
      return decodeURIComponent(value)
    } catch {
      return value
    }
  }

  return {
    teacherId: decodeSegment(match[1]),

    courseId: match[2] ? decodeSegment(match[2]) : null,
  }
}

function appBasePath(): string {
  return new URL(
    import.meta.env.BASE_URL,

    window.location.origin,
  ).pathname.replace(/\/+$/, "")
}

export default function App() {
  const [teacherRoute, setTeacherRoute] = useState<TeacherRoute | null>(() =>
    teacherRouteFromPath(window.location.pathname),
  )

  const teacherId = teacherRoute?.teacherId ?? null

  const [view, setView] = useState<View>(() => {
    if (teacherRoute) {
      return teacherRoute.courseId ? "public:course-detail" : "teacher:platform"
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

  const currentViewRef = useRef(view)
  currentViewRef.current = view
  const [transitionDirection, setTransitionDirection] = useState<-1 | 0 | 1>(0)

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
      const nextView = currentRoute
        ? currentRoute.courseId
          ? "public:course-detail"
          : "teacher:platform"
        : typeof state?.view === "string"
          ? state.view as View
          : null

      if (nextView) {
        setTransitionDirection(pageDirection(currentViewRef.current, nextView))
        currentViewRef.current = nextView
      }

      setTeacherRoute(currentRoute)

      if (currentRoute) {
        setView(
          currentRoute.courseId ? "public:course-detail" : "teacher:platform",
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

  const navigate: NavigateFn = (nextView, params) => {
    const targetView =
      nextView === "dashboard" && !getAuthToken() ? "login" : nextView

    const targetCourseId =
      targetView === "public:course-detail" ? (params?.courseId ?? null) : null

    const targetTeacherId =
      targetView === "teacher:platform"
        ? (params?.teacherId ?? teacherId)
        : targetView === "public:course-detail"
          ? (params?.teacherId ?? teacherId)
          : null

    const targetSearchParams = new URLSearchParams(window.location.search)

    if (
      (targetView === "public:courses" || targetView === "public:teachers") &&
      params?.search !== undefined
    ) {
      const search = params.search.trim()

      if (search) targetSearchParams.set("search", search)
      else targetSearchParams.delete("search")
    }

    const targetUrlSuffix = `${
      targetSearchParams.size ? `?${targetSearchParams}` : ""
    }${window.location.hash}`

    if (
      targetView === view &&
      targetCourseId === selectedCourseId &&
      targetTeacherId === teacherId &&
      targetUrlSuffix === `${window.location.search}${window.location.hash}`
    ) {
      return
    }

    setTransitionDirection(pageDirection(view, targetView))
    currentViewRef.current = targetView

    const basePath = appBasePath()

    const targetPath = targetTeacherId
      ? targetView === "public:course-detail" && targetCourseId
        ? `${basePath}/teacher/${encodeURIComponent(targetTeacherId)}/course/${encodeURIComponent(targetCourseId)}`
        : `${basePath}/teacher/${encodeURIComponent(targetTeacherId)}`
      : teacherRoute
        ? `${basePath}/`
        : window.location.pathname

    window.history.pushState(
      { waiApp: true, view: targetView, selectedCourseId: targetCourseId },

      "",

      `${targetPath}${targetUrlSuffix}`,
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
      {view !== "dashboard" && (
        <PublicNavbar currentView={view} navigate={navigate} />
      )}
      <MotionConfig reducedMotion="user">
        <div className={view === "dashboard" ? undefined : "pt-24"}>
          <AnimatePresence
            mode="wait"
            initial={false}
            onExitComplete={() =>
              window.scrollTo({
                top: 0,
                behavior:
                  view === "public:courses" ||
                  view === "public:teachers" ||
                  view === "public:course-detail"
                    ? "auto"
                    : "smooth",
              })
            }
          >
            <PageTransition
              key={`${view}:${
                view === "public:course-detail" ? (selectedCourseId ?? "") : ""
              }`}
              direction={transitionDirection}
              animatePage={
                view !== "public:courses" &&
                view !== "public:teachers" &&
                view !== "public:course-detail"
              }
            >
              <div className={view === "landing" ? "-mt-24" : undefined}>
                <Suspense
                  fallback={
                    <PublicPageFallback
                      kind={view === "public:teachers" ? "person" : "course"}
                      catalog={
                        view === "public:courses" || view === "public:teachers"
                      }
                      landing={view === "landing"}
                    />
                  }
                >
                  {view === "landing" && <LandingPage navigate={navigate} />}
                  {view === "login" && (
                    <AuthPage mode="login" navigate={navigate} />
                  )}
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
                    <TeacherPlatformPage
                      teacherId={teacherId}
                      navigate={navigate}
                    />
                  )}
                  {view === "dashboard" &&
                    (getAuthToken() ? (
                      <DashboardPage navigate={navigate} />
                    ) : (
                      <AuthPage mode="login" navigate={navigate} />
                    ))}
                </Suspense>
                {view !== "dashboard" && <PlatformFooter navigate={navigate} />}
              </div>
            </PageTransition>
          </AnimatePresence>
        </div>
      </MotionConfig>
    </div>
  )
}
