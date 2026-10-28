import { useState } from "react"

import { getPublicCourses, getPublicTeachers } from "../../api/catalog"

import { useApiQuery } from "../../hooks/useApiQuery"

import type { NavigateFn } from "../../types"

import type { LandingCatalogSummary } from "./types"

import CategoriesSection from "./components/CategoriesSection"

import CallToActionSection from "./components/CallToActionSection"

import FeaturedCoursesSection from "./components/FeaturedCoursesSection"

import FeaturedTeachersSection from "./components/FeaturedTeachersSection"

import LandingHeroSection from "./components/LandingHeroSection"

import PlatformBenefitsSection from "./components/PlatformBenefitsSection"

async function loadCatalogSummary(): Promise<LandingCatalogSummary> {
  const [courses, teachers] = await Promise.all([
    getPublicCourses(1, 24),

    getPublicTeachers(1, 4),
  ])

  return {
    courseCount: courses.totalCount,

    teacherCount: teachers.totalCount,

    featured: courses.items,

    featuredTeachers: teachers.items,
  }
}

export default function LandingPage({ navigate }: { navigate: NavigateFn }) {
  const [reloadKey, setReloadKey] = useState(0)

  const { data, error, loading } = useApiQuery(loadCatalogSummary, reloadKey)

  const retry = () => setReloadKey((key) => key + 1)

  return (
    <div className="overflow-hidden bg-[#f4f8f5] text-[#15352a]">
      <LandingHeroSection
        navigate={navigate}
        data={data ?? undefined}
        loading={loading}
      />
      <PlatformBenefitsSection />
      <FeaturedCoursesSection
        navigate={navigate}
        data={data ?? undefined}
        loading={loading}
        error={error}
        onRetry={retry}
      />
      <CategoriesSection navigate={navigate} />
      <FeaturedTeachersSection
        navigate={navigate}
        teachers={data?.featuredTeachers ?? []}
        loading={loading}
      />
      <CallToActionSection
        navigate={navigate}
        data={data ?? undefined}
        loading={loading}
      />
    </div>
  )
}
