import type { NavigateFn } from "../types"

import NuwaLogo from "../components/NuwaLogo"

interface AuthPageProps {
  mode: "login" | "register"

  navigate: NavigateFn
}

export default function AuthPage({ mode, navigate }: AuthPageProps) {
  const isLogin = mode === "login"

  return (
    <div className="min-h-[70vh] bg-canvas px-6 py-16">
      <section className="mx-auto max-w-xl border border-stroke bg-surface p-8">
        <NuwaLogo size="sm" />
        <h1 className="mt-8 text-2xl font-bold text-ink">
          {isLogin ? "تسجيل الدخول" : "إنشاء حساب طالب"}
        </h1>
        <div
          className="mt-5 border-s-4 border-danger bg-danger-light p-4"
          role="alert"
        >
          <p className="font-semibold text-danger">
            تسجيل الدخول متوقف مؤقتاً لحماية بياناتك
          </p>
          <p className="mt-2 text-sm leading-relaxed text-ink">
            الخادم المتاح يقدّم الاتصال عبر HTTP فقط، ومحاولة HTTPS تفشل أثناء
            تفاوض TLS. لن نرسل كلمة مرور عبر اتصال غير مشفر.
          </p>
          <p className="mt-2 text-sm leading-relaxed text-ink">
            يلزم تفعيل HTTPS على الخادم قبل إتمام تسجيل الدخول أو إنشاء الحساب.
          </p>
        </div>
        <button
          type="button"
          onClick={() => navigate("landing")}
          className="mt-6 h-10 rounded-lg border border-stroke px-4 text-sm font-medium text-ink hover:bg-canvas"
        >
          العودة للرئيسية
        </button>
      </section>
    </div>
  )
}
