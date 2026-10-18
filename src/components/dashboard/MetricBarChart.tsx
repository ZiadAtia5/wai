import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

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

const barColors = ["#176b43", "#42a879", "#0b3b25"]

export default function MetricBarChart({
  title,
  description,
  metrics,
}: MetricBarChartProps) {
  if (!metrics.length) return null

  return (
    <section className="rounded-[28px] border border-stroke bg-surface p-5 shadow-nuwa sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h3 className="text-base font-bold text-ink sm:text-lg">{title}</h3>
          <p className="mt-1 text-xs text-ink-muted sm:text-sm">
            {description}
          </p>
        </div>
        <span className="size-2.5 rounded-full bg-nuwa-bright shadow-[0_0_0_5px_var(--color-nuwa-soft)]" />
      </div>
      <div className="mt-5 h-56 w-full" role="img" aria-label={title}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={metrics}
            margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
            barCategoryGap="28%"
          >
            <CartesianGrid
              vertical={false}
              stroke="#e0e6e2"
              strokeDasharray="4 4"
            />
            <XAxis
              dataKey="label"
              axisLine={false}
              tickLine={false}
              tick={{ fill: "#64746b", fontSize: 12 }}
              tickMargin={10}
              interval={0}
            />
            <YAxis
              allowDecimals={false}
              axisLine={false}
              tickLine={false}
              tick={{ fill: "#64746b", fontSize: 11 }}
              width={32}
            />
            <Tooltip
              cursor={{ fill: "#176b43", fillOpacity: 0.07 }}
              formatter={(value) => [value, title]}
              labelFormatter={(label) => String(label)}
              contentStyle={{
                border: "1px solid #e0e6e2",
                borderRadius: 12,
                boxShadow: "0 8px 24px rgb(11 59 37 / 10%)",
              }}
            />
            <Bar
              dataKey="value"
              name={title}
              radius={[10, 10, 0, 0]}
              maxBarSize={52}
              isAnimationActive
              animationDuration={800}
            >
              {metrics.map((metric, index) => (
                <Cell
                  key={metric.key}
                  fill={barColors[index % barColors.length]}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </section>
  )
}
