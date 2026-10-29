import { Star } from "lucide-react"

interface CourseMetadataBadgesProps {
  course: Record<string, unknown>
}

const metadataSources = (course: Record<string, unknown>) => [
  course,

  ...["metrics", "metadata", "statistics", "stats"]

    .map((key) => course[key])

    .filter(
      (value): value is Record<string, unknown> =>
        typeof value === "object" && value !== null && !Array.isArray(value),
    ),
]

function firstNumber(
  sources: Record<string, unknown>[],

  keys: string[],
): number | undefined {
  for (const source of sources) {
    for (const key of keys) {
      const value = source[key]

      const number =
        typeof value === "number"
          ? value
          : typeof value === "string" && value.trim()
            ? Number(value)
            : Number.NaN

      if (Number.isFinite(number) && number >= 0) return number
    }
  }

  return undefined
}

function isBestSeller(sources: Record<string, unknown>[]): boolean {
  const keys = [
    "isBestSeller",

    "bestSeller",

    "isBestseller",

    "bestSelling",

    "isBestSelling",

    "mostSold",

    "isMostSold",
  ]

  return sources.some((source) =>
    keys.some((key) => {
      const value = source[key]

      return (
        value === true ||
        value === 1 ||
        (typeof value === "string" &&
          ["true", "1", "yes", "best-seller", "bestseller"].includes(
            value.trim().toLowerCase(),
          ))
      )
    }),
  )
}

const ratingFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 1,
})

const countFormatter = new Intl.NumberFormat("ar-EG")

export default function CourseMetadataBadges({
  course,
}: CourseMetadataBadgesProps) {
  const sources = metadataSources(course)

  const rating = firstNumber(sources, [
    "averageRating",

    "ratingAverage",

    "courseRating",

    "rating",
  ])

  const reviewCount = firstNumber(sources, [
    "reviewsCount",

    "reviewCount",

    "ratingsCount",

    "ratingCount",

    "totalReviews",
  ])

  const bestSeller = isBestSeller(sources)

  if (rating === undefined && reviewCount === undefined && !bestSeller) {
    return null
  }

  return (
    <div className="mb-3 flex flex-wrap items-center gap-1.5">
      {bestSeller && (
        <span className="inline-flex min-h-7 items-center rounded-md bg-cyan-100 px-2 py-1 text-[11px] font-bold text-cyan-900">
          الأكثر مبيعًا
        </span>
      )}
      {rating !== undefined && rating <= 5 && (
        <span
          className="inline-flex min-h-7 items-center gap-1 rounded-md border border-stroke bg-white px-2 py-1 text-xs font-semibold text-ink"
          aria-label={`التقييم ${ratingFormatter.format(rating)} من 5`}
        >
          {ratingFormatter.format(rating)}
          <Star
            size={13}
            fill="currentColor"
            className="text-amber-500"
            aria-hidden="true"
          />
        </span>
      )}
      {reviewCount !== undefined && (
        <span className="inline-flex min-h-7 items-center rounded-md border border-stroke bg-white px-2 py-1 text-xs text-ink-muted">
          {countFormatter.format(reviewCount)} من التقييمات
        </span>
      )}
    </div>
  )
}
