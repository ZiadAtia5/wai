import { useEffect, useState, type FormEvent, type ReactNode } from "react"
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Eye,
  EyeOff,
  GraduationCap,
  ShieldCheck,
  Sparkles,
} from "lucide-react"

import { ApiError, setAuthToken } from "../api/client"
import { authApi, type ApiObject } from "../api/endpoints"
import { getAcademicYears, type AcademicYearResponse } from "../api/catalog"
import { notifyError, notifySuccess } from "../utils/notifications"
import type { NavigateFn } from "../types"

interface AuthPageProps {
  mode: "login" | "register"
  navigate: NavigateFn
}

export default function AuthPage({ mode, navigate }: AuthPageProps) {
  const isLogin = mode === "login"
  const [busy, setBusy] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [academicYears, setAcademicYears] = useState<AcademicYearResponse[]>([])
  const [success, setSuccess] = useState("")

  useEffect(() => {
    if (isLogin) return
    let active = true
    getAcademicYears()
      .then((years) => {
        if (active) setAcademicYears(years)
      })
      .catch((error: unknown) =>
        notifyError(error, "تعذر تحميل الصفوف الدراسية."),
      )
    return () => {
      active = false
    }
  }, [isLogin])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!event.currentTarget.checkValidity()) {
      event.currentTarget.querySelector<HTMLElement>(":invalid")?.focus()
      notifyError(
        new Error("تحقق من الحقول المطلوبة وتنسيق البريد وكلمة المرور."),
      )
      return
    }
    setBusy(true)
    setSuccess("")
    const formData = new FormData(event.currentTarget)
    const values = Object.fromEntries(formData.entries())
    let body: ApiObject

    if (isLogin) {
      body = {
        email: String(values.email ?? "").trim(),
        password: String(values.password ?? ""),
      }
    } else {
      const password = String(values.password ?? "")
      const confirmPassword = String(values.confirmPassword ?? "")
      if (password !== confirmPassword) {
        notifyError(new Error("كلمتا المرور غير متطابقتين."))
        setBusy(false)
        return
      }
      body = {
        firstName: String(values.firstName ?? "").trim(),
        secondName: String(values.secondName ?? "").trim(),
        thirdName: String(values.thirdName ?? "").trim(),
        email: String(values.email ?? "").trim(),
        password,
        confirmPassword,
        phoneNumber: String(values.phoneNumber ?? "").trim(),
        parentPhoneNumber: String(values.parentPhoneNumber ?? "").trim(),
        studentNumber: String(values.studentNumber ?? "").trim(),
        academicYear: Number(values.academicYear),
      }
    }

    try {
      const response = await (isLogin
        ? authApi.login(body)
        : authApi.registerStudent(body))
      const record =
        typeof response === "object" && response !== null
          ? response as Record<string, unknown>
          : {}
      const nested =
        typeof record.data === "object" && record.data !== null
          ? record.data as Record<string, unknown>
          : {}
      if ((record.pendingApproval ?? nested.pendingApproval) === true) {
        const message = record.message ?? nested.message
        const notice =
          typeof message === "string" && /[\u0600-\u06ff]/.test(message)
            ? message
            : "تم استلام طلبك بنجاح. سيصبح بإمكانك تسجيل الدخول بعد اعتماد الحساب."
        setSuccess(notice)
        notifySuccess(notice)
        return
      }
      const token =
        record.token ?? record.accessToken ?? nested.token ?? nested.accessToken
      if (typeof token !== "string" || !token)
        throw new ApiError("لم يرسل الخادم رمز جلسة صالحاً.")
      const user =
        typeof record.user === "object" && record.user !== null
          ? record.user as Record<string, unknown>
          : {}
      setAuthToken(token)
      window.sessionStorage.setItem(
        "eduhub.auth.role",
        String(user.role ?? record.role ?? "Student").toLowerCase(),
      )
      notifySuccess(
        isLogin ? "تم تسجيل الدخول بنجاح." : "تم إنشاء الحساب بنجاح.",
      )
      navigate("dashboard")
    } catch (error) {
      notifyError(
        error,
        isLogin
          ? "تعذر تسجيل الدخول. تحقق من بياناتك وحاول مجدداً."
          : "تعذر إنشاء الحساب. راجع البيانات وحاول مجدداً.",
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="min-h-[calc(100vh-64px)] bg-[#f3f7fb] px-4 py-8 sm:px-6 sm:py-12">
      <div className="mx-auto grid min-h-[680px] max-w-6xl overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-[0_24px_80px_-32px_rgba(18,59,102,.28)] lg:grid-cols-[.85fr_1.15fr]">
        <aside className="relative hidden overflow-hidden bg-[#0b2742] p-10 text-white lg:flex lg:flex-col lg:justify-between xl:p-14">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_20%_15%,rgba(56,189,248,.28),transparent_38%),radial-gradient(ellipse_at_90%_90%,rgba(37,99,235,.26),transparent_42%)]" />
          <div className="relative">
            <button
              onClick={() => navigate("landing")}
              className="inline-flex items-center gap-2 text-xl font-bold"
            >
              <span className="grid size-10 place-items-center rounded-xl bg-white/10">
                <GraduationCap size={23} />
              </span>
              وَعي
            </button>
            <p className="mt-20 text-sm font-semibold text-sky-200">
              رحلتك التعليمية تبدأ هنا
            </p>
            <h1 className="mt-4 text-4xl font-bold leading-[1.5]">
              تعلّم بثقة،
              <br />
              وتقدّم كل يوم.
            </h1>
            <p className="mt-5 max-w-sm leading-8 text-slate-300">
              مكان واحد يجمع الدورات، الدروس، والمعلمين لمساعدتك على الوصول
              لهدفك.
            </p>
          </div>
          <div className="relative grid gap-3">
            {[
              [BookOpen, "دورات ومحتوى منظم"],
              [ShieldCheck, "حساب تعليمي آمن"],
              [Sparkles, "متابعة لتقدمك"],
            ].map(([Icon, label]) => {
              const ItemIcon = Icon as typeof BookOpen
              return (
                <div
                  key={String(label)}
                  className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[.06] p-3 text-sm text-slate-200"
                >
                  <ItemIcon size={18} className="text-sky-300" />
                  {String(label)}
                </div>
              )
            })}
          </div>
        </aside>

        <section className="flex items-center justify-center p-5 sm:p-9 lg:p-12 xl:p-16">
          <div className="w-full max-w-xl">
            <button
              onClick={() => navigate("landing")}
              className="mb-8 inline-flex items-center gap-2 text-sm font-semibold text-ink-muted transition hover:text-nuwa-base lg:hidden"
            >
              <ArrowRight size={17} /> العودة للرئيسية
            </button>
            <div className="mb-7">
              <span className="inline-flex items-center gap-2 rounded-full bg-nuwa-soft px-3 py-1.5 text-xs font-bold text-nuwa-base">
                <GraduationCap size={15} /> منصة وَعي التعليمية
              </span>
              <h2 className="mt-5 text-3xl font-bold tracking-tight text-ink">
                {isLogin ? "أهلاً بعودتك" : "أنشئ حسابك الجديد"}
              </h2>
              <p className="mt-2 text-sm leading-6 text-ink-muted">
                {isLogin
                  ? "سجّل الدخول لمتابعة رحلتك التعليمية."
                  : "أكمل بياناتك للانضمام إلى مجتمع وَعي التعليمي."}
              </p>
            </div>
            {success ? (
              <div className="rounded-2xl border border-success/20 bg-success-light p-5 text-success">
                <div className="flex items-center gap-2 font-bold">
                  <CheckCircle2 size={20} /> تم استلام طلبك
                </div>
                <p className="mt-3 leading-7">{success}</p>
                <button
                  onClick={() => navigate("login")}
                  className="mt-5 rounded-xl bg-success px-4 py-2.5 text-sm font-bold text-white"
                >
                  الانتقال لتسجيل الدخول
                </button>
              </div>
            ) : (
              <form noValidate onSubmit={handleSubmit} className="space-y-5">
                {!isLogin && (
                  <>
                    <FieldGroup title="بيانات الطالب">
                      <div className="grid gap-4 sm:grid-cols-2">
                        <TextField
                          label="الاسم الأول"
                          name="firstName"
                          placeholder="أحمد"
                          autoComplete="given-name"
                        />
                        <TextField
                          label="الاسم الثاني"
                          name="secondName"
                          placeholder="محمد"
                        />
                        <TextField
                          label="الاسم الثالث"
                          name="thirdName"
                          placeholder="محمود"
                        />
                        <TextField
                          label="رقم الطالب"
                          name="studentNumber"
                          placeholder="مثال: STU-2026-001"
                        />
                      </div>
                    </FieldGroup>
                  </>
                )}
                <FieldGroup
                  title={isLogin ? "بيانات الدخول" : "معلومات التواصل"}
                >
                  <div className="grid gap-4 sm:grid-cols-2">
                    <TextField
                      label="البريد الإلكتروني"
                      name="email"
                      type="email"
                      placeholder="name@example.com"
                      autoComplete="email"
                      className="sm:col-span-2"
                    />
                    {!isLogin && (
                      <>
                        <TextField
                          label="رقم هاتف الطالب"
                          name="phoneNumber"
                          type="tel"
                          placeholder="01000000000"
                          dir="ltr"
                        />
                        <TextField
                          label="رقم ولي الأمر"
                          name="parentPhoneNumber"
                          type="tel"
                          placeholder="01000000000"
                          dir="ltr"
                        />
                      </>
                    )}
                  </div>
                </FieldGroup>
                {!isLogin && (
                  <FieldGroup title="المرحلة الدراسية">
                    <label className="grid gap-1.5 text-sm font-semibold text-ink">
                      الصف الدراسي
                      <select
                        name="academicYear"
                        required
                        defaultValue=""
                        disabled={!academicYears.length}
                        className={inputClass}
                      >
                        <option value="" disabled>
                          {academicYears.length
                            ? "اختر الصف الدراسي"
                            : "جارٍ تحميل الصفوف..."}
                        </option>
                        {academicYears.map((year) => (
                          <option key={year.id} value={year.value}>
                            {year.arabicName}
                          </option>
                        ))}
                      </select>
                    </label>
                  </FieldGroup>
                )}
                <FieldGroup title={isLogin ? "كلمة المرور" : "تأمين الحساب"}>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <PasswordField
                      label="كلمة المرور"
                      name="password"
                      visible={showPassword}
                      toggle={() => setShowPassword((value) => !value)}
                      autoComplete={
                        isLogin ? "current-password" : "new-password"
                      }
                    />
                    <>
                      {!isLogin && (
                        <PasswordField
                          label="تأكيد كلمة المرور"
                          name="confirmPassword"
                          visible={showPassword}
                          toggle={() => setShowPassword((value) => !value)}
                          autoComplete="new-password"
                        />
                      )}
                    </>
                  </div>
                  <p className="mt-2 text-xs text-ink-muted">
                    يجب ألا تقل كلمة المرور عن 8 أحرف.
                  </p>
                </FieldGroup>
                <button
                  type="submit"
                  disabled={busy || (!isLogin && !academicYears.length)}
                  className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-nuwa-base px-5 text-sm font-bold text-white shadow-lg shadow-nuwa-base/20 transition hover:bg-nuwa-deep disabled:cursor-wait disabled:opacity-60"
                >
                  {busy ? (
                    <>
                      <span className="size-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />{" "}
                      جارٍ الإرسال...
                    </>
                  ) : isLogin ? (
                    "تسجيل الدخول"
                  ) : (
                    "إنشاء الحساب"
                  )}
                </button>
              </form>
            )}
            <div className="mt-6 border-t border-stroke pt-5 text-center text-sm">
              <span className="text-ink-muted">
                {isLogin ? "ليس لديك حساب؟" : "لديك حساب بالفعل؟"}{" "}
              </span>
              <button
                type="button"
                onClick={() => navigate(isLogin ? "register" : "login")}
                className="font-bold text-nuwa-base hover:underline"
              >
                {isLogin ? "إنشاء حساب" : "تسجيل الدخول"}
              </button>
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}

const inputClass =
  "h-11 w-full rounded-xl border border-stroke bg-white px-3.5 text-sm text-ink transition placeholder:text-slate-400 focus:border-nuwa-base focus:outline-none focus:ring-4 focus:ring-nuwa-base/10 disabled:bg-slate-50"

function FieldGroup({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) {
  return (
    <fieldset className="rounded-2xl border border-slate-200 p-4 sm:p-5">
      <legend className="px-2 text-sm font-bold text-ink">{title}</legend>
      {children}
    </fieldset>
  )
}

function TextField({
  label,
  name,
  type = "text",
  placeholder,
  autoComplete,
  dir,
  className = "",
}: {
  label: string
  name: string
  type?: string
  placeholder?: string
  autoComplete?: string
  dir?: "ltr" | "rtl"
  className?: string
}) {
  return (
    <label
      className={`grid min-w-0 gap-1.5 text-sm font-semibold text-ink ${className}`}
    >
      {label}
      <input
        name={name}
        type={type}
        required
        autoComplete={autoComplete}
        placeholder={placeholder}
        dir={dir}
        className={`${inputClass} ${dir === "ltr" ? "text-left" : ""}`}
      />
    </label>
  )
}

function PasswordField({
  label,
  name,
  visible,
  toggle,
  autoComplete,
}: {
  label: string
  name: string
  visible: boolean
  toggle: () => void
  autoComplete: string
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
          autoComplete={autoComplete}
          className={`${inputClass} pe-11`}
        />
        <button
          type="button"
          onClick={toggle}
          aria-label={visible ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted hover:text-nuwa-base"
        >
          {visible ? <EyeOff size={17} /> : <Eye size={17} />}
        </button>
      </span>
    </label>
  )
}
