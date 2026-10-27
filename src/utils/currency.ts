export function formatEgp(value: unknown): string {
  const amount = Number(value)

  if (!Number.isFinite(amount) || amount <= 0) return "مجانية"

  return new Intl.NumberFormat("ar-EG", {
    style: "currency",

    currency: "EGP",

    maximumFractionDigits: 2,
  }).format(amount)
}
