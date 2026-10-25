import {
  ArrowLeft,
  BookOpen,
  GraduationCap,
  House,
  MoveUpRight,
} from "lucide-react";

import { getAuthToken } from "../../api/client";

import type { NavigateFn } from "../../types";

import NuwaLogo from "../NuwaLogo";

export default function PlatformFooter({
  navigate,
  compact = false,
  dashboard = false,
}: {
  navigate: NavigateFn;
  compact?: boolean;
  dashboard?: boolean;
}) {
  const authenticated = Boolean(getAuthToken());

  if (compact) {
    return (
      <footer className="rounded-2xl border border-stroke bg-surface/80 px-5 sm:px-7">
        <div className="mx-auto flex w-full max-w-[1920px] flex-col gap-2 py-4 text-xs text-ink-muted sm:flex-row sm:items-center sm:justify-between">
          <span>© {new Date().getFullYear()} منصة وَعي التعليمية</span>
          <button
            type="button"
            onClick={() => navigate("landing")}
            className="w-fit font-semibold text-nuwa-base transition hover:text-nuwa-deep"
          >
            العودة إلى المنصة
          </button>
        </div>
      </footer>
    );
  }

  return (
    <footer
      className={
        dashboard
          ? "mt-7 overflow-hidden rounded-[32px] border border-[#d9e4dc] bg-[#f5f8f5]"
          : "border-t border-[#d9e4dc] bg-[#f5f8f5]"
      }
    >
      <div className="mx-auto grid max-w-7xl gap-10 px-5 py-10 sm:px-8 sm:py-12 lg:grid-cols-[1.5fr_1fr_1fr] lg:gap-16">
        <div>
          <button
            type="button"
            onClick={() => navigate("landing")}
            aria-label="العودة إلى الصفحة الرئيسية"
            className="inline-flex rounded-md bg-white p-2 shadow-sm ring-1 ring-stroke"
          >
            <NuwaLogo size="sm" />
          </button>
          <p className="mt-4 max-w-sm text-sm leading-7 text-ink-muted">
            مساحة تعليمية تجمع الطلاب والمعلمين، وتحوّل كل درس إلى خطوة أوضح نحو
            هدفك.
          </p>
          <button
            type="button"
            onClick={() => navigate(authenticated ? "dashboard" : "register")}
            className="mt-5 inline-flex h-10 items-center gap-2 rounded-lg bg-nuwa-base px-4 text-sm font-bold text-white transition hover:bg-nuwa-deep"
          >
            {authenticated ? "مساحة العمل" : "ابدأ التعلّم"}
            <MoveUpRight size={15} aria-hidden="true" />
          </button>
        </div>

        <div>
          <h2 className="text-sm font-bold text-ink">تصفّح المنصة</h2>
          <nav aria-label="روابط تذييل المنصة" className="mt-4 grid gap-3">
            <button
              type="button"
              onClick={() => navigate("landing")}
              className="inline-flex w-fit items-center gap-2 text-sm text-ink-muted transition hover:text-nuwa-base"
            >
              <House size={15} aria-hidden="true" />
              الرئيسية
            </button>
            <button
              type="button"
              onClick={() => navigate("public:courses")}
              className="inline-flex w-fit items-center gap-2 text-sm text-ink-muted transition hover:text-nuwa-base"
            >
              <BookOpen size={15} aria-hidden="true" />
              الدورات التعليمية
            </button>
            <button
              type="button"
              onClick={() => navigate("public:teachers")}
              className="inline-flex w-fit items-center gap-2 text-sm text-ink-muted transition hover:text-nuwa-base"
            >
              <GraduationCap size={15} aria-hidden="true" />
              المعلمون
            </button>
          </nav>
        </div>

        <div>
          <h2 className="text-sm font-bold text-ink">حسابك على وَعي</h2>
          <p className="mt-4 max-w-xs text-sm leading-6 text-ink-muted">
            احفظ تقدّمك، تابع دوراتك، وواصل التعلّم من حيث توقفت.
          </p>
          <button
            type="button"
            onClick={() => navigate(authenticated ? "dashboard" : "login")}
            className="mt-4 inline-flex items-center gap-2 text-sm font-bold text-nuwa-base transition hover:text-nuwa-deep"
          >
            {authenticated ? "افتح مساحة العمل" : "تسجيل الدخول"}
            <ArrowLeft size={15} aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className="border-t border-[#d9e4dc] bg-white/70">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-5 py-4 text-xs text-ink-muted sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <span>© {new Date().getFullYear()} منصة وَعي التعليمية</span>
          <span>نتعلّم اليوم لنصنع فرص الغد.</span>
        </div>
      </div>
    </footer>
  );
}
