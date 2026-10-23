import type { AcademicYearResponse } from "../../api/catalog"

export interface LandingCatalogSummary {
  courseCount: number
  teacherCount: number
  academicYears: AcademicYearResponse[]
  featured: unknown[]
}
