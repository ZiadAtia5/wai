import { ArrowUp, BookOpen, GraduationCap, LayoutDashboard, UserRound, Users } from "lucide-react";

import type { NavigateFn } from "../../types";
import NuwaLogo from "../NuwaLogo";

export default function PublicFooter({ navigate }: { navigate: NavigateFn }) {
  function openAbout() {
    const about = document.getElementById("about-platform");
    if (about) {
      about.scrollIntoView({ behavior: "smooth" });
      return;
    }
    navigate("landing");
    window.setTimeout(() => {
      document.getElementById("about-platform")?.scrollIntoView({ behavior: "smooth" });
    }, 100);
  }

  function openWorkspace() {
    navigate(
      window.sessionStorage.getItem("eduhub.auth.token") ? "dashboard" : "login",
    );
  }

  return (
    <footer className="mt-auto border-t border-stroke bg-surface">
      <div className="mx-auto max-w-360 px-5 py-10 sm:px-6 md:px-10 md:py-12">
        <div className="grid gap-9 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr] lg:gap-12">
          <div className="flex flex-col items-start gap-3">
            <button
              type="button"
              onClick={() => navigate("landing")}
              aria-label="العودة إلى الصفحة الرئيسية"
              className="rounded-md"
            >
              <NuwaLogo size="sm" />
            </button>
            <p className="max-w-sm text-sm leading-7 text-ink-muted">
              وَعي، مساحة تعليمية تجمع الدورات والمعلمين لتساعدك على اختيار خطوتك التالية بثقة.
            </p>
            <button
              type="button"
              onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
              className="mt-1 inline-flex items-center gap-2 text-sm font-semibold text-nuwa-base transition-colors hover:text-nuwa-deep"
            >
              العودة إلى أعلى الصفحة <ArrowUp size={16} aria-hidden />
            </button>
          </div>

          <nav aria-label="استكشف المنصة" className="flex flex-col items-start gap-3 text-sm">
            <h2 className="mb-1 font-bold text-ink">استكشف المنصة</h2>
            <button onClick={() => navigate("landing")} className="text-ink-muted transition-colors hover:text-nuwa-base">الرئيسية</button>
            <button onClick={() => navigate("public:courses")} className="inline-flex items-center gap-2 text-ink-muted transition-colors hover:text-nuwa-base">
              <BookOpen size={15} aria-hidden /> الدورات التعليمية
            </button>
            <button onClick={() => navigate("public:teachers")} className="inline-flex items-center gap-2 text-ink-muted transition-colors hover:text-nuwa-base">
              <Users size={15} aria-hidden /> المعلمون
            </button>
            <button onClick={openAbout} className="text-ink-muted transition-colors hover:text-nuwa-base">عن وَعي</button>
          </nav>

          <nav aria-label="حسابك" className="flex flex-col items-start gap-3 text-sm">
            <h2 className="mb-1 font-bold text-ink">حسابك</h2>
            <button onClick={() => navigate("login")} className="inline-flex items-center gap-2 text-ink-muted transition-colors hover:text-nuwa-base">
              <UserRound size={15} aria-hidden /> تسجيل الدخول
            </button>
            <button onClick={() => navigate("register")} className="inline-flex items-center gap-2 text-ink-muted transition-colors hover:text-nuwa-base">
              <GraduationCap size={16} aria-hidden /> إنشاء حساب طالب
            </button>
            <button onClick={openWorkspace} className="inline-flex items-center gap-2 text-ink-muted transition-colors hover:text-nuwa-base">
              <LayoutDashboard size={15} aria-hidden /> مساحة العمل
            </button>
          </nav>
        </div>

        <div className="mt-9 flex flex-col gap-2 border-t border-stroke pt-5 text-xs text-ink-muted sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} وَعي. جميع الحقوق محفوظة.</p>
          <p>التعلّم يبدأ بخطوة واعية.</p>
        </div>
      </div>
    </footer>
  );
}
