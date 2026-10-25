import {
  Skeleton,
  SkeletonAvatar,
  SkeletonButton,
  SkeletonIcon,
  SkeletonImage,
  SkeletonText,
} from "../Skeleton"

type CatalogSkeletonKind = "course" | "person" | "record"

function CatalogCardSkeleton({ kind }: { kind: CatalogSkeletonKind }) {
  if (kind === "person") {
    return (
      <article
        aria-hidden="true"
        className="flex min-h-72 flex-col items-center rounded-[24px] border border-stroke bg-surface p-5 text-center shadow-sm"
      >
        <SkeletonAvatar className="size-20" />
        <Skeleton className="mt-3 h-7 w-2/3" />
        <div className="mt-2 grid w-full gap-3">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-4/5 justify-self-center" />
        </div>
        <div className="mt-auto w-full pt-4">
          <Skeleton className="h-5 w-40" />
        </div>
      </article>
    )
  }

  if (kind === "course") {
    return (
      <article
        aria-hidden="true"
        className="flex min-h-80 flex-col overflow-hidden rounded-[24px] border border-stroke bg-surface p-5 shadow-sm"
      >
        <SkeletonImage className="mb-5 h-40 rounded-2xl" />
        <Skeleton className="h-7 w-3/4" />
        <Skeleton className="mt-1 h-4 w-1/2" />
        <div className="mt-2 grid gap-3">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-4/5" />
        </div>
        <div className="mt-4 flex flex-wrap gap-4">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-24" />
        </div>
        <div className="mt-auto flex items-center justify-between border-t border-stroke pt-4">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-4 w-20" />
        </div>
        <Skeleton className="mt-4 h-5 w-24" />
      </article>
    )
  }

  return (
    <article
      aria-hidden="true"
      className="flex min-h-56 flex-col overflow-hidden rounded-[24px] border border-stroke bg-surface p-5 shadow-sm"
    >
      <Skeleton className="h-6 w-3/4" />
      <Skeleton className="mt-3 h-4 w-1/2" />
      <SkeletonText className="mt-4 w-full" lines={3} />
      <div className="mt-auto flex items-center justify-between gap-3 pt-5">
        <Skeleton className="h-4 w-24" />
        <SkeletonButton className="h-8 w-24" />
      </div>
    </article>
  )
}

export function PublicCatalogPageSkeleton({
  kind,
}: {
  kind: "course" | "person"
}) {
  return (
    <div className="min-h-screen bg-canvas pb-16">
      <header className="px-4 pt-5 sm:px-6 lg:px-8">
        <div
          aria-hidden="true"
          className="relative isolate mx-auto flex min-h-[164px] max-w-7xl items-center justify-between gap-4 overflow-hidden rounded-[32px] border border-emerald-800/20 bg-gradient-to-l from-[#0b3b25] via-emerald-900 to-[#176b43] px-5 py-6 text-white shadow-xl shadow-emerald-950/10 sm:gap-6 sm:px-8 sm:py-7 md:min-h-[176px] md:px-10 md:py-8"
        >
          <span className="pointer-events-none absolute -bottom-20 left-8 -z-10 size-48 rounded-full border border-white/10 sm:left-16" />
          <div className="w-full max-w-2xl">
            <Skeleton className="mb-3 h-6 w-36 bg-white/20" />
            <Skeleton className="h-8 w-2/3 bg-white/25" />
            <Skeleton className="mt-2 h-5 w-full max-w-xl bg-white/20" />
          </div>
          <div className="inline-flex shrink-0 items-center gap-3 rounded-xl border border-white/15 bg-white/10 px-3 py-2 sm:px-4 sm:py-2.5">
            <Skeleton className="h-7 w-14 bg-white/25" />
            <Skeleton className="h-3 w-20 bg-white/20" />
          </div>
        </div>
      </header>

      <main className="mx-auto min-w-0 max-w-7xl px-4 py-6 sm:px-6 sm:py-8 md:px-10">
        <div aria-hidden="true" className="mb-7 border-y border-stroke/40 py-3">
          <div className="flex items-center gap-3">
            <Skeleton className="h-[52px] min-w-0 flex-1 rounded-2xl bg-white" />
            <Skeleton className="h-5 w-16 shrink-0" />
          </div>
          <div className="mt-3 flex gap-2 overflow-hidden">
            {[0, 1, 2, 3].map((item) => (
              <Skeleton key={item} className="h-10 w-20 shrink-0 rounded-full" />
            ))}
          </div>
        </div>
        <CatalogGridSkeleton kind={kind} count={12} />
      </main>
    </div>
  )
}

export function CatalogGridSkeleton({
  kind,
  layout = "public",
  count = 3,
}: {
  kind: CatalogSkeletonKind
  layout?: "public" | "dashboard"
  count?: number
}) {
  const gridColumns =
    layout === "dashboard"
      ? "grid gap-5 sm:grid-cols-2 xl:grid-cols-3"
      : `grid gap-5 md:grid-cols-2 ${
          kind === "course" ? "xl:grid-cols-3" : "lg:grid-cols-3"
        }`
  const secondColumn = layout === "dashboard" ? "sm:block" : "md:block"
  const thirdColumn =
    layout === "dashboard"
      ? "xl:block"
      : kind === "course"
        ? "xl:block"
        : "lg:block"

  return (
    <div
      aria-busy="true"
      aria-label="جارٍ تحميل النتائج"
      className={gridColumns}
    >
      {Array.from({ length: Math.max(1, count) }, (_, index) => {
        const visibility =
          count <= 3 && index === 1
            ? `hidden ${secondColumn}`
            : count <= 3 && index === 2
              ? `hidden ${thirdColumn}`
              : ""
        return (
          <div key={index} className={visibility}>
            <CatalogCardSkeleton kind={kind} />
          </div>
        )
      })}
    </div>
  )
}

export function TeacherCoursesSkeleton({
  dashboard = false,
}: {
  dashboard?: boolean
}) {
  const thirdColumn = dashboard ? "2xl:block" : "xl:block"
  return (
    <div
      aria-busy="true"
      aria-label="جارٍ تحميل دورات المعلم"
      className={`grid gap-5 md:grid-cols-2 ${
        dashboard ? "2xl:grid-cols-3" : "xl:grid-cols-3"
      }`}
    >
      <CourseGridCardSkeleton />
      <div className="hidden md:block">
        <CourseGridCardSkeleton />
      </div>
      <div className={`hidden ${thirdColumn}`}>
        <CourseGridCardSkeleton />
      </div>
    </div>
  )
}

function CourseGridCardSkeleton() {
  return (
    <article
      aria-hidden="true"
      className="flex min-h-80 flex-col overflow-hidden rounded-[24px] border border-stroke bg-white shadow-sm"
    >
      <SkeletonImage className="h-44 rounded-none" />
      <div className="flex flex-1 flex-col p-5">
        <Skeleton className="h-6 w-3/4" />
        <SkeletonText className="mt-3 w-full" lines={3} />
        <div className="mt-auto flex items-center justify-between border-t border-stroke pt-4">
          <Skeleton className="h-4 w-24" />
          <SkeletonButton className="h-8 w-24" />
        </div>
      </div>
    </article>
  )
}

export function RecordGridSkeleton({ compact = false }: { compact?: boolean }) {
  const card = (
    <article
      aria-hidden="true"
      className={`rounded-2xl border border-stroke bg-white p-4 shadow-sm sm:p-5 ${
        compact ? "min-h-24" : "min-h-48"
      }`}
    >
      <div className="flex items-start gap-3">
        {compact ? <SkeletonAvatar className="size-10" /> : <SkeletonIcon />}
        <div className="min-w-0 flex-1">
          <Skeleton className="h-5 w-2/3" />
          <Skeleton className="mt-2 h-4 w-1/2" />
          {!compact && <SkeletonText className="mt-4 w-full" lines={2} />}
        </div>
      </div>
      {!compact && (
        <div className="mt-5 flex gap-3 border-t border-stroke pt-4">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-20" />
        </div>
      )}
    </article>
  )

  return (
    <div
      aria-busy="true"
      aria-label="جارٍ تحميل البيانات"
      className={compact ? "grid gap-3" : "grid gap-4 md:grid-cols-2"}
    >
      {compact ? (
        <>
          {card}
          {card}
        </>
      ) : (
        <>
          {card}
          <div className="hidden md:block">{card}</div>
        </>
      )}
    </div>
  )
}

export function StatGridSkeleton({ count = 3 }: { count?: number }) {
  const slots = Math.max(1, Math.min(count, 6))
  return (
    <div
      aria-busy="true"
      aria-label="جارٍ تحميل الإحصائيات"
      className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3"
    >
      {Array.from({ length: slots }, (_, index) => (
        <div
          key={index}
          aria-hidden="true"
          className="flex items-center gap-4 rounded-[22px] border border-stroke bg-canvas/70 p-4"
        >
          <SkeletonIcon className="size-11" />
          <div className="min-w-0 flex-1">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="mt-2 h-7 w-1/3" />
          </div>
        </div>
      ))}
    </div>
  )
}

export function ProgressCardSkeleton() {
  return (
    <article
      aria-hidden="true"
      className="flex min-h-72 flex-col items-center gap-4 rounded-[24px] border border-stroke bg-white p-5 text-center shadow-nuwa"
    >
      <SkeletonAvatar className="size-24" />
      <div className="w-full">
        <Skeleton className="mx-auto h-5 w-2/3" />
        <Skeleton className="mx-auto mt-2 h-4 w-1/2" />
      </div>
      <div className="grid w-full grid-cols-2 gap-3">
        <Skeleton className="h-16 rounded-xl" />
        <Skeleton className="h-16 rounded-xl" />
      </div>
    </article>
  )
}

export function ProgressGridSkeleton() {
  return (
    <div
      aria-busy="true"
      aria-label="جارٍ تحميل تقدم الطلاب"
      className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3"
    >
      <ProgressCardSkeleton />
      <div className="hidden md:block">
        <ProgressCardSkeleton />
      </div>
      <div className="hidden 2xl:block">
        <ProgressCardSkeleton />
      </div>
    </div>
  )
}

export function EnrollmentGridSkeleton() {
  return (
    <div
      aria-busy="true"
      aria-label="جارٍ تحميل الدورات المسجل بها"
      className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3"
    >
      {[0, 1, 2].map((item) => (
        <article
          key={item}
          aria-hidden="true"
          className={`min-h-64 rounded-2xl border border-stroke bg-white p-5 shadow-nuwa ${
            item > 0 ? "hidden sm:flex" : "flex"
          } ${item > 1 ? "xl:flex" : ""} flex-col`}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1">
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="mt-2 h-4 w-1/2" />
            </div>
            <Skeleton className="h-6 w-20 rounded-full" />
          </div>
          <Skeleton className="mt-4 h-10 w-full rounded-lg" />
          <div className="mt-5">
            <div className="flex justify-between">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-4 w-10" />
            </div>
            <Skeleton className="mt-2 h-2 w-full rounded-full" />
          </div>
          <SkeletonButton className="mt-auto h-10 w-full" />
        </article>
      ))}
    </div>
  )
}

export function ProfileSkeleton({ admin = false }: { admin?: boolean }) {
  return (
    <div aria-busy="true" aria-label="جارٍ تحميل الملف الشخصي">
      <section className="mb-5 overflow-hidden rounded-3xl border border-stroke bg-white shadow-sm">
        <div
          className={`flex flex-wrap items-center gap-3 px-4 py-6 sm:gap-5 sm:px-9 sm:py-8 ${
            admin ? "bg-gradient-to-l from-[#0b3b25] to-[#25845a]" : "bg-white"
          }`}
        >
          <SkeletonAvatar
            className={`size-20 sm:size-24 ${admin ? "bg-white/20" : ""}`}
          />
          <div className="min-w-0 flex-1">
            <Skeleton className={`h-4 w-28 ${admin ? "bg-white/20" : ""}`} />
            <Skeleton
              className={`mt-2 h-8 w-48 ${admin ? "bg-white/25" : ""}`}
            />
            <Skeleton
              className={`mt-3 h-6 w-24 rounded-full ${
                admin ? "bg-white/20" : ""
              }`}
            />
          </div>
          <SkeletonButton className={`w-40 ${admin ? "bg-white/20" : ""}`} />
        </div>
        <div className="grid min-w-0 gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4 sm:p-7">
          {[0, 1, 2, 3].map((item) => (
            <div key={item} className="rounded-2xl bg-[#f3f8f5] p-4">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="mt-2 h-5 w-3/4" />
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
