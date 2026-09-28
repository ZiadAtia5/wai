import { useState, type FormEvent } from "react";
import { ApiError, setAuthToken } from "../api/client";
import { authApi, type ApiObject } from "../api/endpoints";
import type { NavigateFn } from "../types";

interface AuthPageProps {
  mode: "login" | "register";
  navigate: NavigateFn;
}

export default function AuthPage({ mode, navigate }: AuthPageProps) {
  const isLogin = mode === "login";
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");

    const formData = new FormData(event.currentTarget);
    const rawEntries = Object.fromEntries(formData.entries());

    let body: ApiObject = {};

    if (isLogin) {
      body = {
        email: String(rawEntries.email || "").trim(),
        password: String(rawEntries.password || ""),
      };
    } else {
      const password = String(rawEntries.password || "");
      const confirmPassword = String(rawEntries.confirmPassword || "");

      if (password !== confirmPassword) {
        setError("كلمتا المرور غير متطابقتين.");
        setBusy(false);
        return;
      }

      body = {
        firstName: String(rawEntries.firstName || "").trim(),
        secondName: String(rawEntries.secondName || "").trim(),
        thirdName: String(rawEntries.thirdName || "").trim(),
        lastName: String(rawEntries.lastName || "").trim(),
        email: String(rawEntries.email || "").trim(),
        password,
        confirmPassword,
        phoneNumber: String(rawEntries.phoneNumber || "").trim(),
        parentPhoneNumber: String(rawEntries.parentPhoneNumber || "").trim(),
        studentNumber: String(rawEntries.studentNumber || "").trim(),
        academicYear: Number(rawEntries.academicYear),
      };
    }

    try {
      const response = await (isLogin
        ? authApi.login(body)
        : authApi.registerStudent(body));

      const record =
        typeof response === "object" && response !== null
          ? (response as Record<string, unknown>)
          : {};

      const nested =
        typeof record.data === "object" && record.data !== null
          ? (record.data as Record<string, unknown>)
          : {};

      const token =
        record.token ??
        record.accessToken ??
        nested.token ??
        nested.accessToken;

      if (typeof token !== "string" || !token) {
        throw new ApiError("لم يرسل الخادم رمز جلسة صالحاً.");
      }

      const user =
        typeof record.user === "object" && record.user !== null
          ? (record.user as Record<string, unknown>)
          : {};

      const role = user.role ?? record.role ?? "Student";

      setAuthToken(token);
      window.sessionStorage.setItem(
        "eduhub.auth.role",
        String(role).toLowerCase(),
      );

      navigate("dashboard");
    } catch (cause) {
      if (cause instanceof ApiError) {
        setError(cause.message);
      } else if (cause instanceof Error) {
        setError(cause.message);
      } else {
        setError("تعذر إتمام الطلب، تحقق من البيانات المدخلة.");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page-ambient flex min-h-[calc(100dvh-10rem)] flex-1 items-center justify-center bg-canvas px-4 py-12 dir-rtl">
      <div className="w-full max-w-xl rounded-2xl border border-stroke bg-surface p-6 shadow-xl backdrop-blur-sm sm:p-10">
        {/* Header Section */}
        <div className="text-center">
          <span className="inline-block rounded-full bg-nuwa-base/10 px-3 py-1 text-xs font-bold text-nuwa-base">
            منصة وَعي التعليمية
          </span>
          <h1 className="mt-3 text-2xl font-bold tracking-tight text-ink sm:text-3xl">
            {isLogin ? "مرحباً بعودتك 👋" : "إنشاء حساب طالب جديد 🎓"}
          </h1>
          <p className="mt-1.5 text-sm text-ink-muted">
            {isLogin
              ? "سجل الدخول للمتابعة إلى حسابك التعليمي"
              : "أدخل بياناتك للانضمام إلى الرحلة التعليمية"}
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="mt-8 space-y-4">
          {!isLogin && (
            <>
              {/* Name Fields */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-ink">
                    الاسم الأول
                  </label>
                  <input
                    name="firstName"
                    required
                    autoComplete="given-name"
                    placeholder="أحمد"
                    className="h-11 rounded-lg border border-stroke bg-canvas/30 px-3.5 text-sm text-ink transition-all focus:border-nuwa-base focus:bg-surface focus:outline-none focus:ring-2 focus:ring-nuwa-base/20"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-ink">
                    الاسم الثاني
                  </label>
                  <input
                    name="secondName"
                    required
                    placeholder="محمد"
                    className="h-11 rounded-lg border border-stroke bg-canvas/30 px-3.5 text-sm text-ink transition-all focus:border-nuwa-base focus:bg-surface focus:outline-none focus:ring-2 focus:ring-nuwa-base/20"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-ink">
                    الاسم الثالث
                  </label>
                  <input
                    name="thirdName"
                    required
                    placeholder="محمود"
                    className="h-11 rounded-lg border border-stroke bg-canvas/30 px-3.5 text-sm text-ink transition-all focus:border-nuwa-base focus:bg-surface focus:outline-none focus:ring-2 focus:ring-nuwa-base/20"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-ink">
                    اسم العائلة (الرابع)
                  </label>
                  <input
                    name="lastName"
                    required
                    autoComplete="family-name"
                    placeholder="علي"
                    className="h-11 rounded-lg border border-stroke bg-canvas/30 px-3.5 text-sm text-ink transition-all focus:border-nuwa-base focus:bg-surface focus:outline-none focus:ring-2 focus:ring-nuwa-base/20"
                  />
                </div>
              </div>

              {/* Student ID */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-ink">
                  رقم الطالب / الكود
                </label>
                <input
                  name="studentNumber"
                  required
                  placeholder="مثال: STU-2026-001"
                  className="h-11 rounded-lg border border-stroke bg-canvas/30 px-3.5 text-sm text-ink transition-all focus:border-nuwa-base focus:bg-surface focus:outline-none focus:ring-2 focus:ring-nuwa-base/20"
                />
              </div>
            </>
          )}

          {/* Email Field */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-ink">
              البريد الإلكتروني
            </label>
            <input
              name="email"
              type="email"
              required
              autoComplete="email"
              placeholder="student@example.com"
              className="h-11 rounded-lg border border-stroke bg-canvas/30 px-3.5 text-sm text-ink transition-all focus:border-nuwa-base focus:bg-surface focus:outline-none focus:ring-2 focus:ring-nuwa-base/20"
            />
          </div>

          {/* Password Fields */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-ink">
              كلمة المرور
            </label>
            <div className="relative">
              <input
                name="password"
                type={showPassword ? "text" : "password"}
                required
                minLength={8}
                autoComplete={isLogin ? "current-password" : "new-password"}
                placeholder="••••••••"
                className="h-11 w-full rounded-lg border border-stroke bg-canvas/30 px-3.5 text-sm text-ink transition-all focus:border-nuwa-base focus:bg-surface focus:outline-none focus:ring-2 focus:ring-nuwa-base/20"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-medium text-ink-muted hover:text-ink focus:outline-none"
              >
                {showPassword ? "إخفاء" : "إظهار"}
              </button>
            </div>
          </div>

          {!isLogin && (
            <>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-ink">
                  تأكيد كلمة المرور
                </label>
                <input
                  name="confirmPassword"
                  type={showPassword ? "text" : "password"}
                  required
                  minLength={8}
                  autoComplete="new-password"
                  placeholder="••••••••"
                  className="h-11 rounded-lg border border-stroke bg-canvas/30 px-3.5 text-sm text-ink transition-all focus:border-nuwa-base focus:bg-surface focus:outline-none focus:ring-2 focus:ring-nuwa-base/20"
                />
              </div>

              {/* Phone Numbers */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-ink">
                    رقم الهاتف
                  </label>
                  <input
                    name="phoneNumber"
                    type="tel"
                    required
                    dir="ltr"
                    autoComplete="tel"
                    placeholder="01000000000"
                    className="h-11 rounded-lg border border-stroke bg-canvas/30 px-3.5 text-right text-sm text-ink transition-all focus:border-nuwa-base focus:bg-surface focus:outline-none focus:ring-2 focus:ring-nuwa-base/20"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-ink">
                    رقم هاتف ولي الأمر
                  </label>
                  <input
                    name="parentPhoneNumber"
                    type="tel"
                    required
                    dir="ltr"
                    placeholder="01000000000"
                    className="h-11 rounded-lg border border-stroke bg-canvas/30 px-3.5 text-right text-sm text-ink transition-all focus:border-nuwa-base focus:bg-surface focus:outline-none focus:ring-2 focus:ring-nuwa-base/20"
                  />
                </div>
              </div>

              {/* Academic Year */}
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-ink">
                  الصف الدراسي
                </label>
                <select
                  name="academicYear"
                  required
                  defaultValue="5"
                  className="h-11 rounded-lg border border-stroke bg-canvas/30 px-3.5 text-sm text-ink transition-all focus:border-nuwa-base focus:bg-surface focus:outline-none focus:ring-2 focus:ring-nuwa-base/20"
                >
                  <option value="1">أولى إعدادي</option>
                  <option value="2">تانية إعدادي</option>
                  <option value="3">تالتة إعدادي</option>
                  <option value="4">أولى ثانوي</option>
                  <option value="5">تانية ثانوي</option>
                  <option value="6">تالتة ثانوي</option>
                </select>
              </div>
            </>
          )}

          {/* Error Message */}
          {error && (
            <div
              role="alert"
              className="flex items-center gap-2 rounded-lg border border-danger/20 bg-danger/10 p-3.5 text-xs font-medium text-danger"
            >
              <svg
                className="h-4 w-4 shrink-0 fill-current"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                  clipRule="evenodd"
                />
              </svg>
              <span>{error}</span>
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={busy}
            className="mt-2 flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-nuwa-base px-5 text-sm font-bold text-white transition-all hover:bg-nuwa-deep focus:outline-none focus:ring-2 focus:ring-nuwa-base/40 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy ? (
              <>
                <svg
                  className="h-4 w-4 animate-spin text-white"
                  viewBox="0 0 24 24"
                  fill="none"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
                <span>جارٍ الاتصال...</span>
              </>
            ) : isLogin ? (
              "تسجيل الدخول"
            ) : (
              "إنشاء الحساب"
            )}
          </button>
        </form>

        {/* Navigation Links */}
        <div className="mt-6 flex items-center justify-between border-t border-stroke pt-4 text-xs">
          <button
            type="button"
            onClick={() => navigate(isLogin ? "register" : "login")}
            className="font-semibold text-nuwa-base hover:underline focus:outline-none"
          >
            {isLogin
              ? "ليس لديك حساب؟ تسجيل جديد"
              : "لديك حساب بالفعل؟ تسجيل الدخول"}
          </button>
          <button
            type="button"
            onClick={() => navigate("landing")}
            className="text-ink-muted transition-colors hover:text-ink focus:outline-none"
          >
            العودة للرئيسية ←
          </button>
        </div>
      </div>
    </div>
  );
}
