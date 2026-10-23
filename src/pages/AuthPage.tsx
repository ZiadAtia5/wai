import { useEffect, useState, type FormEvent } from "react";

import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  GraduationCap,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

import { ApiError, setAuthToken } from "../api/client";

import { authApi, type ApiObject } from "../api/endpoints";

import { getAcademicYears, type AcademicYearResponse } from "../api/catalog";

import { notifyError, notifySuccess } from "../utils/notifications";

import {
  FieldGroup,
  inputClass,
  PASSWORD_POLICY_PATTERN,
  passwordRequirementMessage,
  PasswordField,
  PasswordRequirements,
  TextField,
} from "../components/auth/AuthFields";

import type { NavigateFn } from "../types";

interface AuthPageProps {
  mode: "login" | "register";

  navigate: NavigateFn;
}

function comparablePhone(value: string): string {
  let digits = value
    .replace(/[٠-٩۰-۹]/g, (digit) =>
      String("٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹".indexOf(digit) % 10),
    )
    .replace(/\D/g, "");

  if (digits.startsWith("0020")) digits = digits.slice(4);
  else if (digits.startsWith("20") && digits.length >= 12)
    digits = digits.slice(2);

  return digits.startsWith("0") ? digits.slice(1) : digits;
}

export default function AuthPage({ mode, navigate }: AuthPageProps) {
  const isLogin = mode === "login";

  const [busy, setBusy] = useState(false);

  const [showPassword, setShowPassword] = useState(false);

  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [passwordValue, setPasswordValue] = useState("");

  const [confirmPasswordValue, setConfirmPasswordValue] = useState("");

  const [studentPhoneValue, setStudentPhoneValue] = useState("");

  const [parentPhoneValue, setParentPhoneValue] = useState("");

  const [academicYears, setAcademicYears] = useState<AcademicYearResponse[]>(
    [],
  );
  const [academicYearsLoading, setAcademicYearsLoading] = useState(!isLogin);

  const [success, setSuccess] = useState("");

  useEffect(() => {
    if (isLogin) {
      setAcademicYearsLoading(false);
      return;
    }

    let active = true;
    setAcademicYearsLoading(true);

    getAcademicYears()
      .then((years) => {
        if (active) setAcademicYears(years);
      })

      .catch((error: unknown) =>
        notifyError(error, "تعذر تحميل الصفوف الدراسية."),
      )
      .finally(() => {
        if (active) setAcademicYearsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [isLogin]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const form = event.currentTarget;
    const firstInvalidField = form.querySelector<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >(":invalid");

    if (
      !isLogin &&
      (!firstInvalidField ||
        firstInvalidField.name === "password" ||
        firstInvalidField.name === "confirmPassword")
    ) {
      const passwordMessage = passwordRequirementMessage(
        passwordValue,
        confirmPasswordValue,
      );
      if (passwordMessage) {
        const fieldName = passwordMessage.includes("تأكيد")
          ? "confirmPassword"
          : "password";
        const field = form.elements.namedItem(fieldName);
        if (field instanceof HTMLInputElement) field.focus();
        notifyError(new Error(passwordMessage));
        return;
      }
    }

    if (!form.checkValidity()) {
      firstInvalidField?.focus();

      if (firstInvalidField) {
        let validationMessage = "تحقق من الحقل المحدد ثم حاول مرة أخرى.";
        if (firstInvalidField.validity.customError) {
          validationMessage = firstInvalidField.validationMessage;
        } else if (firstInvalidField.validity.valueMissing) {
          const fieldLabel = firstInvalidField.labels?.[0]?.textContent
            ?.replace(/\s+/g, " ")
            .trim();
          validationMessage = fieldLabel
            ? `أكمل حقل ${fieldLabel}.`
            : "أكمل الحقل المطلوب.";
        } else if (firstInvalidField.validity.typeMismatch) {
          validationMessage = "أدخل البريد الإلكتروني بالتنسيق الصحيح.";
        } else if (firstInvalidField.validity.tooShort) {
          validationMessage = "كلمة المرور يجب ألا تقل عن 8 أحرف.";
        }
        notifyError(new Error(validationMessage));
        return;
      }

      notifyError(
        new Error("تحقق من الحقول المطلوبة وتنسيق البريد وكلمة المرور."),
      );

      return;
    }

    if (
      !isLogin &&
      comparablePhone(studentPhoneValue) &&
      comparablePhone(studentPhoneValue) === comparablePhone(parentPhoneValue)
    ) {
      const parentPhoneField = form.elements.namedItem("parentPhoneNumber");
      if (parentPhoneField instanceof HTMLInputElement)
        parentPhoneField.focus();
      notifyError(
        new Error("رقم هاتف الطالب ورقم ولي الأمر لازم يكونوا مختلفين."),
      );
      return;
    }

    setBusy(true);

    setSuccess("");

    const formData = new FormData(event.currentTarget);

    const values = Object.fromEntries(formData.entries());

    let body: ApiObject;

    if (isLogin) {
      body = {
        email: String(values.email ?? "").trim(),

        password: String(values.password ?? ""),
      };
    } else {
      const password = String(values.password ?? "");

      const confirmPassword = String(values.confirmPassword ?? "");

      if (password !== confirmPassword) {
        notifyError(new Error("كلمتا المرور غير متطابقتين."));

        setBusy(false);

        return;
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

      if ((record.pendingApproval ?? nested.pendingApproval) === true) {
        const message = record.message ?? nested.message;

        const notice =
          typeof message === "string" && /[\u0600-\u06ff]/.test(message)
            ? message
            : "تم استلام طلبك بنجاح. سيصبح بإمكانك تسجيل الدخول بعد اعتماد الحساب.";

        setSuccess(notice);

        notifySuccess(notice);

        return;
      }

      const token =
        record.token ??
        record.accessToken ??
        nested.token ??
        nested.accessToken;

      if (typeof token !== "string" || !token)
        throw new ApiError("لم يرسل الخادم رمز جلسة صالحاً.");

      const userSource = record.user ?? nested.user;
      const user =
        typeof userSource === "object" && userSource !== null
          ? (userSource as Record<string, unknown>)
          : record;

      setAuthToken(token);

      window.sessionStorage.setItem(
        "eduhub.auth.role",

        String(
          user.role ?? record.role ?? nested.role ?? "Student",
        ).toLowerCase(),
      );

      const displayName = [
        user.firstName ?? nested.firstName ?? record.firstName,
        user.secondName ?? nested.secondName ?? record.secondName,
        user.thirdName ?? nested.thirdName ?? record.thirdName,
        user.lastName ?? nested.lastName ?? record.lastName,
      ]
        .filter(
          (part): part is string =>
            typeof part === "string" && part.trim().length > 0,
        )
        .join(" ");
      const accountName =
        user.fullName ??
        user.displayName ??
        user.name ??
        nested.fullName ??
        nested.name ??
        displayName;
      if (typeof accountName === "string" && accountName.trim()) {
        window.sessionStorage.setItem("eduhub.auth.name", accountName.trim());
      }

      const profileImage =
        user.avatarUrl ??
        user.avatar_url ??
        user.profileImageUrl ??
        user.profile_image_url ??
        user.profileImage ??
        user.profile_image ??
        user.profilePictureUrl ??
        user.imageUrl ??
        nested.avatarUrl ??
        nested.avatar_url ??
        nested.profileImageUrl ??
        nested.profile_image_url ??
        nested.profileImage ??
        nested.profile_image ??
        nested.profilePictureUrl ??
        nested.imageUrl;
      if (typeof profileImage === "string" && profileImage.trim()) {
        window.sessionStorage.setItem("eduhub.auth.image", profileImage.trim());
      }

      notifySuccess(
        isLogin ? "تم تسجيل الدخول بنجاح." : "تم إنشاء الحساب بنجاح.",
      );

      navigate("dashboard");
    } catch (error) {
      const loginErrorMessage =
        error instanceof ApiError ? error.message.toLowerCase() : "";
      const accountNeedsActivation =
        isLogin &&
        (error instanceof ApiError && error.status === 403 ||
          /pending|not active|inactive|not approved|unapproved|activation|awaiting approval|غير مفعل|غير مفعّل|بانتظار التفعيل|قيد الموافقة|لم يتم تفعيل|لم يعتمد/.test(
            loginErrorMessage,
          ));

      if (accountNeedsActivation) {
        notifyError(
          new Error("حسابك قيد المراجعة ولم يتم تفعيله بعد. يُرجى المحاولة بعد اعتماد الحساب من الإدارة."),
        );
        return;
      }

      notifyError(
        error,

        isLogin
          ? "تعذر تسجيل الدخول. تحقق من بياناتك وحاول مجدداً."
          : "تعذر إنشاء الحساب. راجع البيانات وحاول مجدداً.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="relative isolate min-h-[calc(100vh-64px)] overflow-hidden bg-[#edf2ef] px-3 py-5 sm:px-6 sm:py-9 lg:px-8 lg:py-12">
      <div className="pointer-events-none absolute -right-28 top-10 size-80 rounded-full bg-emerald-200/40 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 left-0 size-96 rounded-full bg-teal-100/70 blur-3xl" />
      <div className="relative mx-auto grid min-h-[min(780px,calc(100svh-6rem))] max-w-6xl overflow-hidden rounded-[1.75rem] border border-white/80 bg-white shadow-[0_30px_100px_-42px_rgba(11,59,37,.35)] sm:rounded-[2rem] lg:grid-cols-[.92fr_1.08fr]">
        <aside className="relative hidden overflow-hidden bg-gradient-to-br from-[#0b3b25] via-[#105b3a] to-[#0a3020] p-10 text-white lg:flex lg:flex-col lg:justify-between xl:p-14">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_20%_15%,rgba(66,168,121,.35),transparent_38%),radial-gradient(ellipse_at_90%_90%,rgba(23,107,67,.38),transparent_42%)]" />
          <div className="pointer-events-none absolute -left-24 top-1/3 size-72 rounded-full border border-white/10" />
          <div className="pointer-events-none absolute -left-12 top-[38%] size-48 rounded-full border border-white/10" />
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
            <p className="mt-16 text-sm font-semibold tracking-wide text-emerald-200 xl:mt-24">
              رحلتك التعليمية تبدأ هنا
            </p>
            <h1 className="mt-4 text-4xl font-bold leading-[1.5]">
              تعلّم بثقة،
              <br />
              وتقدّم كل يوم.
            </h1>
            <p className="mt-5 max-w-sm text-[15px] leading-8 text-emerald-50/75">
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
              const ItemIcon = Icon as typeof BookOpen;

              return (
                <div
                  key={String(label)}
                  className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[.07] p-3.5 text-sm text-emerald-50/90 shadow-lg shadow-black/5 backdrop-blur-sm"
                >
                  <ItemIcon size={18} className="text-emerald-300" />
                  {String(label)}
                </div>
              );
            })}
          </div>
        </aside>

        <section className="flex items-center justify-center p-5 sm:p-9 lg:p-12 xl:p-16">
          <div className="w-full max-w-[540px]">
            <button
              onClick={() => navigate("landing")}
              className="mb-8 inline-flex items-center gap-2 text-sm font-semibold text-ink-muted transition hover:text-nuwa-base lg:hidden"
            >
              <ArrowRight size={17} /> العودة للرئيسية
            </button>
            <div className="mb-7 sm:mb-9">
              <span className="inline-flex items-center gap-2 rounded-full bg-nuwa-soft px-3 py-1.5 text-xs font-bold text-nuwa-base">
                <GraduationCap size={15} /> منصة وَعي التعليمية
              </span>
              <h2 className="mt-5 text-3xl font-bold tracking-tight text-ink sm:text-[2.15rem]">
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
              <form
                noValidate
                onSubmit={handleSubmit}
                className="space-y-4 sm:space-y-5"
              >
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

                    {isLogin && (
                      <PasswordField
                        label="كلمة المرور"
                        name="password"
                        visible={showPassword}
                        toggle={() => setShowPassword((value) => !value)}
                        onChange={setPasswordValue}
                        autoComplete="current-password"
                      />
                    )}

                    {!isLogin && (
                      <>
                        <TextField
                          label="رقم هاتف الطالب"
                          name="phoneNumber"
                          type="tel"
                          placeholder="01000000000"
                          dir="ltr"
                          autoComplete="tel"
                          onChange={setStudentPhoneValue}
                        />
                        <TextField
                          label="رقم ولي الأمر"
                          name="parentPhoneNumber"
                          type="tel"
                          placeholder="01000000000"
                          dir="ltr"
                          onChange={setParentPhoneValue}
                          errorText={
                            comparablePhone(studentPhoneValue) &&
                            comparablePhone(studentPhoneValue) ===
                              comparablePhone(parentPhoneValue)
                              ? "رقم ولي الأمر يجب أن يختلف عن رقم الطالب."
                              : undefined
                          }
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
                        disabled={academicYearsLoading || !academicYears.length}
                        className={inputClass}
                      >
                        <option value="" disabled>
                          {academicYearsLoading
                            ? "جارٍ تحميل الصفوف..."
                            : academicYears.length
                              ? "اختر الصف الدراسي"
                              : "لا توجد صفوف متاحة"}
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
                {!isLogin && (
                  <FieldGroup title={isLogin ? "كلمة المرور" : "تأمين الحساب"}>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <PasswordField
                        label="كلمة المرور"
                        name="password"
                        visible={showPassword}
                        toggle={() => setShowPassword((value) => !value)}
                        onChange={setPasswordValue}
                        pattern={!isLogin ? PASSWORD_POLICY_PATTERN : undefined}
                        title={
                          !isLogin
                            ? "كلمة المرور تتطلب حرفًا كبيرًا وصغيرًا ورقمًا ورمزًا، وبطول 8 أحرف على الأقل."
                            : undefined
                        }
                        autoComplete={
                          isLogin ? "current-password" : "new-password"
                        }
                      />
                      <>
                        {!isLogin && (
                          <PasswordField
                            label="تأكيد كلمة المرور"
                            name="confirmPassword"
                            visible={showConfirmPassword}
                            toggle={() =>
                              setShowConfirmPassword((value) => !value)
                            }
                            onChange={setConfirmPasswordValue}
                            autoComplete="new-password"
                          />
                        )}
                      </>
                    </div>
                    {isLogin ? null : (
                      <PasswordRequirements
                        password={passwordValue}
                        confirmation={confirmPasswordValue}
                      />
                    )}
                    {isLogin && (
                      <p className="mt-2 text-xs text-ink-muted">
                        يجب ألا تقل كلمة المرور عن 8 أحرف.
                      </p>
                    )}
                  </FieldGroup>
                )}
                <button
                  type="submit"
                  disabled={busy || (!isLogin && !academicYears.length)}
                  className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-l from-[#176b43] to-[#0b3b25] px-5 text-sm font-bold text-white shadow-lg shadow-nuwa-base/20 transition duration-200 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-nuwa-base/20 active:translate-y-0 disabled:cursor-wait disabled:opacity-60"
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
  );
}
