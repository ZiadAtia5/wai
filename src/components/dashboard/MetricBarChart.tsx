import { AnimatedBar, AnimatedNumber } from "./DashboardMotion"

interface MetricBar {
  key: string
  label: string
  value: number
}

interface MetricBarChartProps {
  title: string
  description: string
  metrics: MetricBar[]
}

export default function MetricBarChart({
  title,
  description,
  metrics,
}: MetricBarChartProps) {
  if (!metrics.length) return null

  const maxValue = Math.max(...metrics.map(({ value }) => value), 1)

  return (
    <section
      dir="rtl"
      className="mt-5 min-w-0 rounded-2xl border border-stroke bg-surface p-4 shadow-nuwa sm:rounded-[28px] sm:p-6"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="break-words text-base font-bold leading-7 text-ink sm:text-lg">
            {title}
          </h3>
          <p className="mt-1 text-xs leading-5 text-ink-muted sm:text-sm sm:leading-6">
            {description}
          </p>
        </div>
        <span
          aria-hidden="true"
          className="mt-2 size-2.5 shrink-0 rounded-full bg-nuwa-bright shadow-[0_0_0_5px_var(--color-nuwa-soft)]"
        />
      </div>
      <div className="mt-5 space-y-4" aria-label={title}>
        {metrics.map(({ key, label, value }) => (
          <div key={key} className="min-w-0">
            <div className="mb-2 flex items-start justify-between gap-3">
              <span className="min-w-0 break-words text-sm font-medium leading-6 text-ink-muted">
                {label}
              </span>
              <span className="shrink-0 text-sm font-bold tabular-nums text-ink">
                <AnimatedNumber value={value} />
              </span>
            </div>
            <div
              className="h-2.5 overflow-hidden rounded-full bg-nuwa-soft"
              role="meter"
              aria-label={label}
              aria-valuemin={0}
              aria-valuemax={maxValue}
              aria-valuenow={value}
            >
              <AnimatedBar
                className="h-full rounded-full bg-gradient-to-l from-nuwa-deep to-nuwa-bright"
                value={Math.max((value / maxValue) * 100, value > 0 ? 3 : 0)}
              />
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
