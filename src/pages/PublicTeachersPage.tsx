import { getPublicTeachers } from "../api/catalog"

import { teachersApi } from "../api/endpoints"

import PublicCatalogPage from "./PublicCatalogPage"

import type { NavigateFn } from "../types"

export default function PublicTeachersPage({
  navigate,
}: {
  navigate: NavigateFn
}) {
  return (
    <PublicCatalogPage
      title="المعلمون"
      description="تعرّف على معلمي منصة وَعي واستكشف دوراتهم التعليمية."
      emptyMessage="لا توجد ملفات معلمين متاحة حالياً."
      load={getPublicTeachers}
      loadRelated={(id) => teachersApi.courses(id)}
      personCards
      navigate={navigate}
    />
  )
}
