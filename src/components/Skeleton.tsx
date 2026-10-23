interface SkeletonProps {
  className?: string
}

export function Skeleton({ className = "" }: SkeletonProps) {
  return (
    <span
      aria-hidden="true"
      className={`block animate-pulse rounded-md bg-[#e4ece6] motion-reduce:animate-none ${className}`}
    />
  )
}

export function SkeletonText({
  lines = 1,
  className = "",
}: SkeletonProps & { lines?: number }) {
  return (
    <span aria-hidden="true" className={`grid gap-2 ${className}`}>
      {Array.from({ length: Math.max(1, Math.min(lines, 4)) }, (_, index) => (
        <Skeleton
          key={index}
          className={`h-4 ${index === lines - 1 ? "w-4/5" : "w-full"}`}
        />
      ))}
    </span>
  )
}

export function SkeletonAvatar({ className = "" }: SkeletonProps) {
  return (
    <Skeleton className={`size-12 shrink-0 rounded-full ${className}`} />
  )
}

export function SkeletonImage({ className = "" }: SkeletonProps) {
  return <Skeleton className={`w-full rounded-2xl ${className}`} />
}

export function SkeletonButton({ className = "" }: SkeletonProps) {
  return <Skeleton className={`h-10 w-28 rounded-xl ${className}`} />
}

export function SkeletonIcon({ className = "" }: SkeletonProps) {
  return <Skeleton className={`size-10 shrink-0 rounded-xl ${className}`} />
}
