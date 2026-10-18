import type { ReactNode } from "react"

import { Check, Circle, Eye, EyeOff, X } from "lucide-react"

export const inputClass =
  "h-12 w-full rounded-xl border border-stroke bg-[#f8faf9] px-4 text-sm text-ink shadow-sm shadow-emerald-950/[.02] transition duration-200 placeholder:text-neutral-400 hover:border-stroke-strong focus:border-nuwa-base focus:bg-white focus:outline-none focus:ring-4 focus:ring-nuwa-base/10 disabled:cursor-not-allowed disabled:bg-neutral-100"

export const PASSWORD_POLICY_PATTERN =
  "(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[^A-Za-z0-9\\s]).{8,}"

export function passwordMeetsRequirements(password: string): boolean {
  return (
    password.length >= 8 &&
    /[A-Z]/.test(password) &&
    /[a-z]/.test(password) &&
    /[0-9]/.test(password) &&
    /[^A-Za-z0-9\s]/.test(password)
  )
}

export function passwordRequirementMessage(
  password: string,
  confirmation?: string,
): string | null {
  if (password.length < 8) return "أضف 8 أحرف على الأقل إلى كلمة المرور."
  if (!/[A-Z]/.test(password)) return "أضف حرفًا كبيرًا واحدًا على الأقل."
  if (!/[a-z]/.test(password)) return "أضف حرفًا صغيرًا واحدًا على الأقل."
  if (!/[0-9]/.test(password)) return "أضف رقمًا واحدًا على الأقل."
  if (!/[^A-Za-z0-9\s]/.test(password)) return "أضف رمزًا خاصًا واحدًا على الأقل."
  if (confirmation !== undefined && !confirmation) return "اكتب تأكيد كلمة المرور."
  if (confirmation !== undefined && confirmation !== password)
    return "تأكيد كلمة المرور غير مطابق."
  return null
}

export function PasswordRequirements({
  password,
  confirmation = "",
}: {
  password: string
  confirmation?: string
}) {
  const requirements = [
    { label: "8 أحرف على الأقل", valid: password.length >= 8, active: Boolean(password) },
    { label: "حرف كبير واحد على الأقل (A–Z)", valid: /[A-Z]/.test(password), active: Boolean(password) },
    { label: "حرف صغير واحد على الأقل (a–z)", valid: /[a-z]/.test(password), active: Boolean(password) },
    { label: "رقم واحد على الأقل (0–9)", valid: /[0-9]/.test(password), active: Boolean(password) },
    { label: "رمز خاص واحد على الأقل (!@#$…)", valid: /[^A-Za-z0-9\s]/.test(password), active: Boolean(password) },
    {
      label: "مطابقة كلمة المرور",
      valid: Boolean(confirmation) && confirmation === password,
      active: Boolean(confirmation),
    },
  ]
  const firstIncompleteIndex = requirements.findIndex(
    (requirement) => requirement.active && !requirement.valid,
  )

  return (
    <ul
      aria-live="polite"
      aria-label="شروط كلمة المرور"
      className="mt-3 grid gap-x-4 gap-y-2 rounded-xl bg-[#f7faf8] p-3 sm:grid-cols-2"
    >
      {requirements.map(({ label, valid }, index) => (
        <li
          key={label}
          className={`flex items-center gap-2 text-xs transition-colors ${valid ? "font-semibold text-emerald-700" : index === firstIncompleteIndex ? "font-semibold text-rose-600" : "text-ink-muted"}`}
        >
          <span className={`grid size-4 shrink-0 place-items-center rounded-full ${valid ? "bg-emerald-100" : index === firstIncompleteIndex ? "bg-rose-50" : "text-neutral-400"}`}>
            {valid ? <Check size={11} strokeWidth={3} /> : index === firstIncompleteIndex ? <X size={11} strokeWidth={2.5} /> : <Circle size={8} fill="currentColor" />}
          </span>
          {label}
        </li>
      ))}
    </ul>
  )
}

export function FieldGroup({
  title,

  children,
}: {
  title: string

  children: ReactNode
}) {
  return (
    <fieldset className="min-w-0 rounded-2xl border border-stroke/80 bg-white p-4 sm:p-5">
      <legend className="px-2 text-sm font-bold text-ink">{title}</legend>
      {children}
    </fieldset>
  )
}

export function TextField({
  label,

  name,

  type = "text",

  placeholder,

  autoComplete,

  dir,

  className = "",

  onChange,

  errorText,
}: {
  label: string

  name: string

  type?: string

  placeholder?: string

  autoComplete?: string

  dir?: "ltr" | "rtl"

  className?: string

  onChange?: (value: string) => void

  errorText?: string
}) {
  return (
    <label
      className={`grid min-w-0 gap-1.5 text-sm font-semibold text-ink ${className}`}
    >
      {label}
      <input
        ref={(element) => element?.setCustomValidity(errorText ?? "")}
        name={name}
        type={type}
        required
        autoComplete={autoComplete}
        placeholder={placeholder}
        dir={dir}
        onChange={(event) => onChange?.(event.currentTarget.value)}
        aria-invalid={Boolean(errorText)}
        aria-describedby={errorText ? `${name}-error` : undefined}
        className={`${inputClass} ${dir === "ltr" ? "text-left" : ""} ${errorText ? "border-rose-400 focus:border-rose-500 focus:ring-rose-500/10" : ""}`}
      />
      {errorText && (
        <span id={`${name}-error`} role="alert" className="text-xs font-medium text-rose-600">
          {errorText}
        </span>
      )}
    </label>
  )
}

export function PasswordField({
  label,

  name,

  visible,

  toggle,

  autoComplete,

  onChange,

  pattern,

  title,
}: {
  label: string

  name: string

  visible: boolean

  toggle: () => void

  autoComplete: string

  onChange?: (value: string) => void

  pattern?: string

  title?: string
}) {
  return (
    <label className="grid min-w-0 gap-1.5 text-sm font-semibold text-ink">
      {label}
      <span className="relative">
        <input
          name={name}
          type={visible ? "text" : "password"}
          required
          minLength={8}
          pattern={pattern}
          title={title}
          autoComplete={autoComplete}
          onChange={(event) => onChange?.(event.currentTarget.value)}
          className={`${inputClass} pe-11`}
        />
        <button
          type="button"
          onClick={toggle}
          aria-label={visible ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}
          className="absolute left-3 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-ink-muted transition hover:bg-nuwa-soft hover:text-nuwa-base focus-visible:outline focus-visible:outline-2 focus-visible:outline-nuwa-base"
        >
          {visible ? <EyeOff size={17} /> : <Eye size={17} />}
        </button>
      </span>
    </label>
  )
}
