import { apiRequest } from "./client"

export interface AcademicYearResponse {
  value: number

  id: number

  name: string

  arabicName: string
}

export interface PagedResult<T> {
  items: T[]

  page: number

  pageSize: number

  totalCount: number

  totalPages: number
}

export type ApiRecord = unknown

export async function getAcademicYears(): Promise<AcademicYearResponse[]> {
  const payload = await apiRequest<unknown>("/academic-years")

  if (
    !Array.isArray(payload) ||
    !payload.every(
      (year) =>
        typeof year === "object" &&
        year !== null &&
        "value" in year &&
        typeof year.value === "number" &&
        "id" in year &&
        typeof year.id === "number" &&
        "name" in year &&
        typeof year.name === "string" &&
        "arabicName" in year &&
        typeof year.arabicName === "string",
    )
  ) {
    throw new Error("Unexpected academic-year response")
  }

  return payload
}

export function getPublicCourses(
  page = 1,

  pageSize = 20,
): Promise<PagedResult<ApiRecord>> {
  const query = new URLSearchParams({
    page: String(page),

    pageSize: String(pageSize),
  })

  return getPagedResult(`/courses?${query.toString()}`)
}

export function getPublicTeachers(
  page = 1,

  pageSize = 20,
): Promise<PagedResult<ApiRecord>> {
  const query = new URLSearchParams({
    page: String(page),

    pageSize: String(pageSize),
  })

  return getPagedResult(`/teachers?${query.toString()}`)
}

async function getPagedResult(path: string): Promise<PagedResult<ApiRecord>> {
  const payload = await apiRequest<unknown>(path)

  if (
    typeof payload !== "object" ||
    payload === null ||
    !("items" in payload) ||
    !Array.isArray(payload.items) ||
    !("page" in payload) ||
    typeof payload.page !== "number" ||
    !("pageSize" in payload) ||
    typeof payload.pageSize !== "number" ||
    !("totalCount" in payload) ||
    typeof payload.totalCount !== "number" ||
    !("totalPages" in payload) ||
    typeof payload.totalPages !== "number"
  ) {
    throw new Error("Unexpected paged API response")
  }

  return payload as PagedResult<ApiRecord>
}
