import { useState } from "react"
import {
  getAcademicYears,
  getPublicCourses,
  getPublicTeachers,
} from "../../api/catalog"
import { useApiQuery } from "../../hooks/useApiQuery"
import type { NavigateFn } from "../../types"
import type { LandingCatalogSummary } from "./types"
import AcademicYearsSection from "./components/AcademicYearsSection"
import AudienceSection from "./components/AudienceSection"
import CallToActionSection from "./components/CallToActionSection"
import FeaturedCoursesSection from "./components/FeaturedCoursesSection"
import HeroSection from "./components/HeroSection"
import LandingFooter from "./components/LandingFooter"

async function loadCatalogSummary(): Promise<LandingCatalogSummary> {
  const [courses, teachers, academicYears] = await Promise.all([
    getPublicCourses(1, 3),
    getPublicTeachers(1, 1),
    getAcademicYears(),
  ])

  return {
    courseCount: courses.totalCount,
    teacherCount: teachers.totalCount,
    academicYears,
    featured: courses.items,
  }
}

export default function LandingPage({ navigate }: { navigate: NavigateFn }) {
  const [reloadKey, setReloadKey] = useState(0)
  const { data, error, loading } = useApiQuery(loadCatalogSummary, reloadKey)
  const retry = () => setReloadKey((key) => key + 1)

  return (
    <div className="overflow-hidden bg-[#f4f8f5] text-[#15352a]">
      <HeroSection
        navigate={navigate}
        data={data ?? undefined}
        loading={loading}
        error={error}
        onRetry={retry}
      />
      <AcademicYearsSection
        navigate={navigate}
        data={data ?? undefined}
        loading={loading}
        error={error}
        onRetry={retry}
      />
      <FeaturedCoursesSection
        navigate={navigate}
        data={data ?? undefined}
        loading={loading}
        error={error}
        onRetry={retry}
      />
      <AudienceSection navigate={navigate} />
      <CallToActionSection navigate={navigate} />
      <LandingFooter />
    </div>
  )
}
