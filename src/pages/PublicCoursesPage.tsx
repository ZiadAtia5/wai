import { getPublicCourses } from "../api/catalog"

import PublicCatalogPage from "./PublicCatalogPage"

export default function PublicCoursesPage() {
  return (
    <PublicCatalogPage
      title="الدورات التعليمية"
      description="الدورات المنشورة المتاحة من منصة وَعي"
      emptyMessage="لا توجد دورات منشورة متاحة حالياً."
      load={getPublicCourses}
    />
  )
}
