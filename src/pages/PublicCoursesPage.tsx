import { getPublicCourses } from "../api/catalog"

import { coursesApi } from "../api/endpoints"

import PublicCatalogPage from "./PublicCatalogPage"

import type { NavigateFn } from "../types"

export default function PublicCoursesPage({
  navigate,
}: {
  navigate: NavigateFn
}) {
  return (
    <PublicCatalogPage
      title="الدورات التعليمية"
      description="الدورات المنشورة المتاحة من منصة وَعي"
      emptyMessage="لا توجد دورات منشورة متاحة حالياً."
      load={getPublicCourses}
      loadDetail={coursesApi.publicDetail}
      action={coursesApi.enroll}
      actionLabel="طلب الالتحاق بالدورة"
      courseCatalog
      navigate={navigate}
    />
  )
}
