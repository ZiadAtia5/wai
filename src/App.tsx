import { lazy, Suspense, useState } from "react";

import type { NavigateFn, View } from "./types";

import PublicFooter from "./components/layout/PublicFooter";
import PublicNavbar from "./components/layout/PublicNavbar";

const LandingPage = lazy(() => import("./pages/Landing/Landing"));

const AuthPage = lazy(() => import("./pages/AuthPage"));

const PublicCoursesPage = lazy(() => import("./pages/PublicCoursesPage"));

const PublicTeachersPage = lazy(() => import("./pages/PublicTeachersPage"));

const PublicCourseDetailPage = lazy(
  () => import("./pages/PublicCourseDetailPage"),
);

const DashboardPage = lazy(() => import("./pages/DashboardPage"));

export default function App() {
  const [view, setView] = useState<View>("landing");

  const navigate: NavigateFn = (nextView) => {
    setView(nextView);

    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div
      className="flex min-h-dvh flex-col bg-canvas text-ink"
      style={{
        fontFamily:
          "'IBM Plex Sans Arabic', 'IBM Plex Sans', system-ui, sans-serif",
      }}
    >
      <PublicNavbar currentView={view} navigate={navigate} />
      <main className="flex flex-1 flex-col">
        <Suspense
          fallback={<div className="min-h-[60vh] flex-1 bg-canvas" aria-busy="true" />}
        >
          {view === "landing" && <LandingPage navigate={navigate} />}
          {view === "login" && <AuthPage mode="login" navigate={navigate} />}
          {view === "register" && (
            <AuthPage mode="register" navigate={navigate} />
          )}
          {view === "public:courses" && <PublicCoursesPage />}
          {view === "public:teachers" && <PublicTeachersPage />}
          {view.startsWith("public:course:") && (
            <PublicCourseDetailPage
              courseId={decodeURIComponent(view.slice("public:course:".length))}
              navigate={navigate}
            />
          )}
          {view === "dashboard" && <DashboardPage navigate={navigate} />}
        </Suspense>
      </main>
      <PublicFooter navigate={navigate} />
    </div>
  );
}
