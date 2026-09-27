import { ArrowLeft, BookOpen, Users } from "lucide-react"

import {
  getAcademicYears,
  getPublicCourses,
  getPublicTeachers,
} from "../api/catalog"
import { useState } from "react"

import ApiQueryState from "../components/ApiQueryState"

import { useApiQuery } from "../hooks/useApiQuery"

import type { NavigateFn } from "../types"

async function loadCatalogSummary() {
  const [courses, teachers, academicYears] = await Promise.all([
    getPublicCourses(1, 1),

    getPublicTeachers(1, 1),

    getAcademicYears(),
  ])

  return {
    courseCount: courses.totalCount,

    teacherCount: teachers.totalCount,

    academicYears,
  }
}

export default function LandingPage({ navigate }: { navigate: NavigateFn }) {
  const [reloadKey, setReloadKey] = useState(0)
  const { data, error, loading } = useApiQuery(loadCatalogSummary, reloadKey)

  return (
    <div className="min-h-screen bg-canvas">
      <section className="border-b border-stroke bg-surface">
        <div className="mx-auto grid max-w-360 gap-10 px-6 py-16 md:grid-cols-2 md:px-10 md:py-24">
          <div>
            <p className="mb-4 text-sm font-semibold text-nuwa-base">
              منصة وَعي التعليمية
            </p>
            <h1 className="mb-5 text-4xl font-bold leading-tight text-nuwa-deep">
              المعرفة تبدأ من وَعي
            </h1>
            <p className="mb-8 max-w-xl leading-relaxed text-ink-muted">
              تصفح الدورات والمعلمين المتاحين مباشرة من المنصة.
            </p>
            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => navigate("public:courses")}
                className="inline-flex h-11 items-center gap-2 rounded-lg bg-nuwa-base px-5 font-medium text-white hover:bg-nuwa-deep"
              >
                <BookOpen size={17} />
                تصفح الدورات
                <ArrowLeft size={16} />
              </button>
              <button
                onClick={() => navigate("public:teachers")}
                className="inline-flex h-11 items-center gap-2 rounded-lg border border-stroke bg-white px-5 font-medium text-ink hover:border-nuwa-base"
              >
                <Users size={17} />
                المعلمون
              </button>
            </div>
          </div>

          <div className="border-s border-stroke ps-0 md:ps-8">
            <h2 className="mb-3 text-lg font-semibold text-ink">
              حالة محتوى المنصة
            </h2>
            <ApiQueryState
              loading={loading}
              error={error}
              isEmpty={false}
              emptyMessage=""
              onRetry={() => setReloadKey((key) => key + 1)}
            >
              <div className="grid grid-cols-2 gap-4">
                <SummaryValue
                  label="الدورات المنشورة"
                  value={data?.courseCount ?? 0}
                />
                <SummaryValue
                  label="المعلمون"
                  value={data?.teacherCount ?? 0}
                />
              </div>
              {data && (
                <div className="mt-6 border-t border-stroke pt-4">
                  <h3 className="mb-3 text-sm font-semibold text-ink">
                    الصفوف المتاحة
                  </h3>
                  <ul className="flex flex-wrap gap-2">
                    {data.academicYears.map((year) => (
                      <li
                        key={year.id}
                        className="border border-stroke bg-canvas px-3 py-1.5 text-xs text-ink-muted"
                      >
                        {year.arabicName}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </ApiQueryState>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-360 px-6 py-10 md:px-10">
        <p className="text-sm text-ink-muted">
          الأعداد المعروضة تُقرأ من واجهة المنصة مباشرة ولا تُستخدم بيانات
          احتياطية.
        </p>
      </section>
    </div>
  )
}

interface SummaryValueProps {
  label: string
  value: number
}

function SummaryValue({ label, value }: SummaryValueProps) {
  return (
    <div className="border-t-2 border-nuwa-base py-4">
      <div className="text-3xl font-bold text-ink">{value}</div>
      <div className="mt-1 text-sm text-ink-muted">{label}</div>
    </div>
  )
}
