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
      className="mt-9 grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
    >
      {[0, 1, 2, 3].map((item) => (
        <CourseCardSkeleton key={item} />
      ))}
    </div>
  )
}

export function TeacherCardSkeleton() {
  return (
    <article
      aria-hidden="true"
      className="overflow-hidden rounded-xl border border-stroke bg-white"
    >
      <div className="relative aspect-[4/3] bg-[#e5eee7] p-3">
        <SkeletonBlock className="h-7 w-24 rounded-lg" />
        <SkeletonBlock className="absolute bottom-3 right-3 h-4 w-28 bg-white/60" />
      </div>
      <div className="p-4 sm:p-5">
        <SkeletonBlock className="h-6 w-2/3" />
        <div className="mt-2 grid min-h-12 gap-2">
          <SkeletonBlock className="h-4 w-full" />
          <SkeletonBlock className="h-4 w-4/5" />
        </div>
        <div className="mt-4 flex items-center justify-between border-t border-stroke pt-3">
          <SkeletonBlock className="h-5 w-32" />
          <SkeletonBlock className="size-8 rounded-full" />
        </div>
      </div>
    </article>
  )
}

export function LandingPageSkeleton() {
  return (
    <div className="overflow-hidden bg-[#f4f8f5] text-[#15352a]">
      <section
        aria-hidden="true"
        className="bg-[linear-gradient(125deg,#fff_0%,#f8fbf7_55%,#edf5ef_100%)]"
      >
        <div className="mx-auto grid min-h-[620px] max-w-7xl grid-cols-1 items-center gap-5 px-5 pb-12 pt-28 sm:px-8 sm:pt-32 lg:min-h-[680px] lg:grid-cols-2 lg:gap-10 lg:pb-16">
          <div className="max-w-2xl">
            <SkeletonBlock className="h-7 w-48 rounded-full" />
            <SkeletonBlock className="mt-5 h-12 w-4/5 sm:h-16" />
            <SkeletonBlock className="mt-3 h-12 w-3/5 sm:h-16" />
            <SkeletonBlock className="mt-5 h-5 w-full max-w-xl" />
            <SkeletonBlock className="mt-2 h-5 w-4/5 max-w-lg" />
            <div className="mt-7 flex h-[60px] max-w-xl items-center gap-3 rounded-xl border border-stroke bg-white p-2 shadow-nuwa-md">
              <SkeletonBlock className="h-10 min-w-0 flex-1 rounded-lg" />
              <SkeletonBlock className="h-11 w-24 rounded-lg" />
            </div>
            <div className="mt-5 flex gap-5">
              <SkeletonBlock className="h-4 w-32" />
              <SkeletonBlock className="h-4 w-28" />
            </div>
          </div>
          <div className="relative mx-auto w-full max-w-[560px] py-5 sm:py-8">
            <SkeletonBlock className="mx-auto aspect-[1.13/1] w-[88%] rounded-[46%_46%_24px_24px]" />
            <SkeletonBlock className="absolute bottom-4 left-0 h-16 w-48 rounded-xl sm:bottom-8 sm:left-2" />
            <SkeletonBlock className="absolute right-0 top-5 h-16 w-40 rounded-xl sm:right-1 sm:top-9" />
          </div>
        </div>
      </section>

      <section aria-hidden="true" className="border-y border-stroke bg-white">
        <div className="mx-auto grid max-w-7xl grid-cols-2 gap-x-5 gap-y-6 px-5 py-6 sm:px-8 md:grid-cols-4 md:py-7">
          {[0, 1, 2, 3].map((item) => (
            <div key={item} className="flex items-center gap-3">
              <SkeletonBlock className="size-10 shrink-0 rounded-lg" />
              <div className="min-w-0 flex-1">
                <SkeletonBlock className="h-4 w-2/3" />
                <SkeletonBlock className="mt-2 h-3 w-5/6" />
              </div>
            </div>
          ))}
        </div>
      </section>

      <section aria-hidden="true" className="bg-white py-16 sm:py-20">
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <div className="flex items-end justify-between gap-5">
            <div>
              <SkeletonBlock className="h-8 w-44" />
              <SkeletonBlock className="mt-4 h-9 w-72 max-w-full" />
            </div>
            <SkeletonBlock className="h-11 w-32 rounded-xl" />
          </div>
          <CourseGridSkeleton />
        </div>
      </section>

      <section aria-hidden="true" className="bg-white py-14 sm:py-16">
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <SkeletonBlock className="h-8 w-40" />
          <SkeletonBlock className="mt-3 h-9 w-64 max-w-full" />
          <div className="mt-7 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {[0, 1, 2, 3, 4, 5].map((item) => (
              <div
                key={item}
                className="flex min-h-36 flex-col items-start justify-between rounded-xl border border-stroke bg-surface p-4"
              >
                <SkeletonBlock className="size-10 rounded-lg" />
                <div className="w-full">
                  <SkeletonBlock className="h-4 w-3/4" />
                  <SkeletonBlock className="mt-2 h-3 w-full" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section aria-hidden="true" className="border-y border-stroke bg-[#f5f8f5] py-14 sm:py-16">
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <div className="flex items-end justify-between gap-4">
            <div>
              <SkeletonBlock className="h-4 w-36" />
              <SkeletonBlock className="mt-3 h-9 w-64 max-w-full" />
            </div>
            <SkeletonBlock className="h-5 w-28" />
          </div>
          <div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[0, 1, 2, 3].map((item) => (
              <TeacherCardSkeleton key={item} />
            ))}
          </div>
        </div>
      </section>

      <section aria-hidden="true" className="bg-nuwa-deep py-12 sm:py-16">
        <div className="mx-auto grid max-w-7xl gap-8 px-5 sm:px-8 lg:grid-cols-[.9fr_1.35fr_auto] lg:items-center">
          <div>
            <SkeletonBlock className="h-5 w-32 bg-white/20" />
            <SkeletonBlock className="mt-4 h-10 w-64 max-w-full bg-white/25" />
            <SkeletonBlock className="mt-3 h-4 w-full bg-white/20" />
          </div>
          <div className="grid grid-cols-2 gap-5 border-y border-white/15 py-5 sm:grid-cols-4 sm:border-y-0 sm:border-x sm:px-6">
            {[0, 1, 2, 3].map((item) => (
              <div key={item}>
                <SkeletonBlock className="h-7 w-20 bg-white/20" />
                <SkeletonBlock className="mt-3 h-4 w-24 bg-white/15" />
              </div>
            ))}
          </div>
          <SkeletonBlock className="h-12 w-36 rounded-lg bg-white/80" />
        </div>
      </section>
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
