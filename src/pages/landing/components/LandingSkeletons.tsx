import { Skeleton } from "../../../components/Skeleton"

export const SkeletonBlock = Skeleton

export function CourseCardSkeleton() {
  return (
    <article
      aria-hidden="true"
      className="overflow-hidden rounded-2xl border border-[#deebe1] bg-white shadow-[0_8px_24px_-16px_rgba(23,53,42,.28)]"
    >
      <div className="relative flex h-44 items-end bg-[#edf4ef] p-5">
        <SkeletonBlock className="h-6 w-24 rounded-lg bg-[#dce9df]" />
      </div>
      <div className="p-5">
        <SkeletonBlock className="h-6 w-3/4" />
        <SkeletonBlock className="mt-3 h-4 w-full" />
        <SkeletonBlock className="mt-2 h-4 w-5/6" />
        <div className="mt-4 flex items-center justify-between gap-3 border-t border-[#edf1ed] pt-4">
          <SkeletonBlock className="h-4 w-24" />
          <SkeletonBlock className="h-7 w-16 rounded-lg" />
        </div>
        <SkeletonBlock className="mt-4 h-4 w-20" />
      </div>
    </article>
  )
}

export function CourseGridSkeleton() {
  return (
    <div
      aria-busy="true"
      aria-label="جارٍ تحميل الدورات"
      className="mt-9 grid gap-5 md:grid-cols-3"
    >
      <CourseCardSkeleton />
      <div className="hidden md:block">
        <CourseCardSkeleton />
      </div>
      <div className="hidden md:block">
        <CourseCardSkeleton />
      </div>
    </div>
  )
}

export function AcademicYearCardSkeleton() {
  return (
    <div
      aria-hidden="true"
      className="flex items-center gap-4 rounded-2xl border border-[#deebe1] bg-white p-5 shadow-[0_8px_24px_-16px_rgba(23,53,42,.28)]"
    >
      <SkeletonBlock className="size-12 shrink-0 rounded-xl" />
      <div className="min-w-0 flex-1">
        <SkeletonBlock className="h-5 w-2/3" />
        <SkeletonBlock className="mt-2 h-4 w-5/6" />
      </div>
      <SkeletonBlock className="size-9 shrink-0 rounded-full" />
    </div>
  )
}

export function AcademicYearsGridSkeleton() {
  return (
    <div
      aria-busy="true"
      aria-label="جارٍ تحميل الصفوف الدراسية"
      className="mt-9 grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
    >
      <AcademicYearCardSkeleton />
      <div className="hidden sm:block">
        <AcademicYearCardSkeleton />
      </div>
      <div className="hidden lg:block">
        <AcademicYearCardSkeleton />
      </div>
    </div>
  )
}
