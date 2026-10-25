import {
  BookOpen,
  GraduationCap,
  House,
  LayoutDashboard,
  LogIn,
  Menu,
  UserPlus,
  X,
} from "lucide-react";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import {
  AnimatePresence,
  MotionConfig,
  motion,
  useReducedMotion,
  useScroll,
  useSpring,
  type Variants,
} from "framer-motion";

import { getAuthToken } from "../../api/client";

import type { NavigateFn, View } from "../../types";

import NuwaLogo from "../NuwaLogo";

interface PublicNavbarProps {
  currentView: View;
  navigate: NavigateFn;
}

interface PublicNavigationItem {
  label: string;
  view: View;
  icon: typeof House;
}

const publicNavigation: PublicNavigationItem[] = [
  { label: "الرئيسية", view: "landing", icon: House },
  { label: "الدورات", view: "public:courses", icon: BookOpen },
  { label: "المعلمون", view: "public:teachers", icon: GraduationCap },
];

const isViewActive = (currentView: View, view: View) =>
  currentView === view ||
  (view === "public:courses" && currentView === "public:course-detail");

/*
  مؤشر اللينك النشط: بنحرّك الحافتين (left / right) لوحدهم.
  الحافة الأمامية (ناحية الوجهة) بتسبق بسرعة = Stretch،
  وبعدها الحافة الخلفية بتلحقها = Contract، والنتيجة النهائية نفس مقاس الوجهة بالظبط.
*/
type IndicatorEdge = "left" | "right";

interface IndicatorState {
  left: number;
  right: number;
  /** الحافة اللي بتسبق. null = من غير حركة (أول ظهور أو resize) */
  lead: IndicatorEdge | null;
  visible: boolean;
}

const STRETCH_TRANSITION = {
  duration: 0.34,
  ease: [0.22, 1, 0.36, 1] as [number, number, number, number],
};

const CONTRACT_TRANSITION = {
  duration: 0.42,
  delay: 0.1,
  ease: [0.65, 0, 0.35, 1] as [number, number, number, number],
};

const sidebarListVariants: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06, delayChildren: 0.14 } },
};

const sidebarItemVariants: Variants = {
  hidden: { opacity: 0, x: 24 },
  show: {
    opacity: 1,
    x: 0,
    transition: { type: "spring", stiffness: 380, damping: 30 },
  },
};

export default function PublicNavbar({
  currentView,
  navigate,
}: PublicNavbarProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const navigationRef = useRef<HTMLElement | null>(null);
  const [indicator, setIndicator] = useState<IndicatorState | null>(null);
  const prefersReducedMotion = useReducedMotion();

  const isAuthenticated = Boolean(getAuthToken());
  const isOnLandingHero = currentView === "landing" && !scrolled;

  const measureIndicator = useCallback((animate: boolean) => {
    const navigation = navigationRef.current;
    if (!navigation) return;

    const navigationRect = navigation.getBoundingClientRect();
    // الناف مخفي (موبايل) → مفيش قياس
    if (navigationRect.width === 0) return;

    const activeLink = navigation.querySelector<HTMLElement>(
      '[data-nav-active="true"]',
    );

    if (!activeLink) {
      setIndicator((previous) =>
        previous ? { ...previous, lead: null, visible: false } : previous,
      );
      return;
    }

    const linkRect = activeLink.getBoundingClientRect();
    const left = linkRect.left - navigationRect.left;
    const right = navigationRect.right - linkRect.right;

    setIndicator((previous) => {
      if (!previous || !previous.visible || !animate) {
        return { left, right, lead: null, visible: true };
      }

      if (
        Math.abs(previous.left - left) < 0.5 &&
        Math.abs(previous.right - right) < 0.5
      ) {
        return previous;
      }

      // لو رايح يمين: الحافة اليمين هي اللي بتسبق، والعكس
      return {
        left,
        right,
        lead: left > previous.left ? "right" : "left",
        visible: true,
      };
    });
  }, []);

  useLayoutEffect(() => {
    measureIndicator(true);
  }, [currentView, measureIndicator]);

  useEffect(() => {
    const navigation = navigationRef.current;
    if (!navigation) return;

    // بيتنفذ عند تحميل الخطوط أو تغيّر المقاسات / الـ resize
    const observer = new ResizeObserver(() => measureIndicator(false));
    observer.observe(navigation);
    return () => observer.disconnect();
  }, [measureIndicator]);

  const indicatorTransition =
    !indicator || indicator.lead === null || prefersReducedMotion
      ? {
          left: { duration: 0 },
          right: { duration: 0 },
          opacity: { duration: 0.2 },
        }
      : {
          [indicator.lead]: STRETCH_TRANSITION,
          [indicator.lead === "left" ? "right" : "left"]: CONTRACT_TRANSITION,
          opacity: { duration: 0.2 },
        };

  /* شريط تقدّم القراءة أسفل الهيدر */
  const { scrollYProgress } = useScroll();
  const progress = useSpring(scrollYProgress, {
    stiffness: 120,
    damping: 28,
    mass: 0.3,
  });

  useEffect(() => {
    const updateScrollState = () => setScrolled(window.scrollY > 24);
    updateScrollState();
    window.addEventListener("scroll", updateScrollState, { passive: true });
    return () => window.removeEventListener("scroll", updateScrollState);
  }, []);

  useEffect(() => {
    if (!mobileOpen) return;

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileOpen(false);
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [mobileOpen]);

  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 1024px)");
    const closeOnDesktop = (event: MediaQueryListEvent) => {
      if (event.matches) setMobileOpen(false);
    };

    desktop.addEventListener("change", closeOnDesktop);
    return () => desktop.removeEventListener("change", closeOnDesktop);
  }, []);

  const goTo = (view: View) => {
    navigate(view);
    setMobileOpen(false);
  };

  return createPortal(
    <MotionConfig reducedMotion="user">
      <motion.header
        initial={{ y: -32, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 260, damping: 26 }}
        className={`fixed inset-x-3 top-4 z-[100] mx-auto max-w-7xl rounded-[1.75rem] border backdrop-blur-xl backdrop-saturate-150 transition-[background-color,border-color,box-shadow] duration-300 sm:inset-x-6 sm:top-5 ${
          isOnLandingHero
            ? "border-[#dce9de]/80 bg-white/80 shadow-[0_12px_36px_rgba(18,67,42,.10)]"
            : "border-white/70 bg-surface/85 shadow-[0_18px_48px_rgba(9,40,25,.16)]"
        }`}
      >
        <div
          className={`relative mx-auto flex max-w-360 items-center justify-between gap-4 px-4 transition-[height] duration-300 sm:px-7 ${
            scrolled ? "h-[60px]" : "h-[68px]"
          }`}
        >
          {/* اللوجو */}
          <motion.button
            type="button"
            onClick={() => goTo("landing")}
            className="shrink-0 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-nuwa-base/50"
            aria-label="الصفحة الرئيسية"
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.97 }}
            transition={{ type: "spring", stiffness: 400, damping: 22 }}
          >
            <NuwaLogo size="sm" />
          </motion.button>

          {/* لينكات النص */}
          <nav
            ref={navigationRef}
            className="absolute left-1/2 top-1/2 hidden -translate-x-1/2 -translate-y-1/2 items-center gap-1 rounded-2xl bg-black/[0.035] p-1 ring-1 ring-black/[0.04] lg:flex"
            aria-label="روابط المنصة"
          >
            {/* المؤشر: بيتمدّد ناحية الوجهة وبعدها بيتقلّص لمقاسه النهائي */}
            {indicator && (
              <motion.span
                aria-hidden="true"
                className="pointer-events-none absolute bottom-1 top-1 z-0 rounded-xl bg-gradient-to-l from-nuwa-deep to-nuwa-base shadow-md shadow-nuwa-base/30 ring-1 ring-inset ring-white/15"
                initial={false}
                animate={{
                  left: indicator.left,
                  right: indicator.right,
                  opacity: indicator.visible ? 1 : 0,
                }}
                transition={indicatorTransition}
              />
            )}

            {publicNavigation.map(({ label, view }) => {
              const isActive = isViewActive(currentView, view);

              return (
                <button
                  type="button"
                  key={view}
                  data-nav-active={isActive ? "true" : undefined}
                  onClick={() => goTo(view)}
                  aria-current={isActive ? "page" : undefined}
                  className={`relative z-10 inline-flex h-10 items-center rounded-xl px-5 text-sm font-semibold outline-none transition-colors duration-300 focus-visible:ring-2 focus-visible:ring-nuwa-base/50 ${
                    isActive
                      ? "text-white"
                      : isOnLandingHero
                        ? "text-[#52665a] hover:text-nuwa-deep"
                        : "text-ink-muted hover:text-nuwa-deep"
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </nav>

          {/* أزرار الحساب (ديسكتوب) */}
          <div className="hidden items-center gap-2 lg:flex">
            {isAuthenticated ? (
              <button
                type="button"
                onClick={() => goTo("dashboard")}
                className="group relative inline-flex h-10 items-center gap-2 overflow-hidden rounded-xl bg-gradient-to-l from-nuwa-deep to-nuwa-base px-5 text-sm font-semibold text-white shadow-md shadow-nuwa-base/25 outline-none transition duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-nuwa-base/35 focus-visible:ring-2 focus-visible:ring-nuwa-base/50 active:translate-y-0 active:scale-[0.97]"
              >
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/25 to-transparent transition-transform duration-700 group-hover:translate-x-full"
                />
                <LayoutDashboard size={17} className="relative" />
                <span className="relative">مساحة العمل</span>
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => goTo("login")}
                  className={`h-10 rounded-xl px-4 text-sm font-semibold outline-none transition duration-200 focus-visible:ring-2 focus-visible:ring-nuwa-base/50 active:scale-[0.97] ${
                    currentView === "login"
                      ? "bg-nuwa-soft text-nuwa-base"
                      : isOnLandingHero
                        ? "text-[#50665a] hover:bg-[#edf5ef] hover:text-nuwa-deep"
                        : "text-ink-muted hover:bg-canvas hover:text-ink"
                  }`}
                >
                  تسجيل الدخول
                </button>
                <button
                  type="button"
                  onClick={() => goTo("register")}
                  className="group relative h-10 overflow-hidden rounded-xl bg-gradient-to-l from-nuwa-deep to-nuwa-base px-5 text-sm font-semibold text-white shadow-md shadow-nuwa-base/25 outline-none transition duration-200 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-nuwa-base/35 focus-visible:ring-2 focus-visible:ring-nuwa-base/50 active:translate-y-0 active:scale-[0.97]"
                >
                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/25 to-transparent transition-transform duration-700 group-hover:translate-x-full"
                  />
                  <span className="relative">إنشاء حساب</span>
                </button>
              </>
            )}
          </div>

          {/* زرار الموبايل */}
          <motion.button
            type="button"
            className={`grid size-9 place-items-center rounded-xl outline-none transition focus-visible:ring-2 focus-visible:ring-nuwa-base/50 lg:hidden ${
              isOnLandingHero
                ? "border border-[#dce9de] bg-white text-ink-muted hover:bg-[#edf5ef]"
                : "border border-stroke bg-white text-ink-muted shadow-nuwa hover:bg-canvas hover:text-nuwa-base"
            }`}
            onClick={() => setMobileOpen((open) => !open)}
            aria-label={mobileOpen ? "إغلاق القائمة" : "فتح القائمة"}
            aria-expanded={mobileOpen}
            aria-controls="public-sidebar"
            whileTap={{ scale: 0.9 }}
          >
            <AnimatePresence mode="wait" initial={false}>
              <motion.span
                key={mobileOpen ? "close" : "open"}
                initial={{ rotate: -90, opacity: 0, scale: 0.6 }}
                animate={{ rotate: 0, opacity: 1, scale: 1 }}
                exit={{ rotate: 90, opacity: 0, scale: 0.6 }}
                transition={{ duration: 0.16 }}
                className="grid place-items-center"
              >
                {mobileOpen ? <X size={19} /> : <Menu size={19} />}
              </motion.span>
            </AnimatePresence>
          </motion.button>
        </div>

        {/* شريط تقدّم التمرير */}
        <motion.span
          aria-hidden="true"
          style={{ scaleX: progress, transformOrigin: "100% 50%" }}
          className={`pointer-events-none absolute inset-x-7 bottom-0 h-[2px] rounded-full bg-gradient-to-l from-nuwa-base to-nuwa-deep transition-opacity duration-300 ${
            scrolled ? "opacity-100" : "opacity-0"
          }`}
        />
      </motion.header>

      {/* القائمة الجانبية (موبايل) */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.button
              key="overlay"
              type="button"
              aria-label="إغلاق القائمة"
              onClick={() => setMobileOpen(false)}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-[110] bg-neutral-950/45 backdrop-blur-[3px]"
            />

            <motion.aside
              key="sidebar"
              id="public-sidebar"
              role="dialog"
              aria-modal="true"
              aria-label="القائمة الرئيسية"
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", stiffness: 320, damping: 34 }}
              className="fixed inset-y-0 right-0 z-[120] h-dvh w-[min(86vw,320px)] overflow-y-auto overscroll-contain border-l border-stroke bg-white p-4 shadow-2xl"
            >
              <div className="mb-6 flex items-center justify-between">
                <NuwaLogo size="sm" />
                <button
                  type="button"
                  onClick={() => setMobileOpen(false)}
                  className="grid size-9 place-items-center rounded-lg text-ink-muted transition hover:bg-canvas hover:text-ink"
                  aria-label="إغلاق القائمة"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="relative mb-5 overflow-hidden rounded-2xl bg-gradient-to-l from-nuwa-deep to-nuwa-base p-4 text-white">
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute -left-8 -top-10 size-28 rounded-full bg-white/10 blur-2xl"
                />
                <p className="relative text-xs font-semibold text-white/75">
                  {isAuthenticated ? "مرحباً بعودتك" : "ابدأ رحلتك التعليمية"}
                </p>
                <p className="relative mt-1 text-sm font-bold">
                  {isAuthenticated
                    ? "منصة وَعي"
                    : "كل ما تحتاجه للتعلّم في مكان واحد"}
                </p>
              </div>

              <p className="mb-2 px-3 text-[11px] font-bold text-neutral-400">
                القائمة الرئيسية
              </p>
              <motion.nav
                className="grid gap-1"
                aria-label="روابط المنصة"
                variants={sidebarListVariants}
                initial="hidden"
                animate="show"
              >
                {publicNavigation.map(({ label, view, icon: Icon }) => {
                  const isActive = isViewActive(currentView, view);

                  return (
                    <motion.button
                      type="button"
                      key={view}
                      variants={sidebarItemVariants}
                      whileTap={{ scale: 0.97 }}
                      onClick={() => goTo(view)}
                      aria-current={isActive ? "page" : undefined}
                      className={`relative flex w-full items-center gap-3 rounded-xl px-3 py-3 text-start text-sm font-semibold transition-colors ${
                        isActive
                          ? "bg-nuwa-soft text-nuwa-base"
                          : "text-neutral-600 hover:bg-neutral-50 hover:text-ink"
                      }`}
                    >
                      <Icon size={18} />
                      <span className="flex-1">{label}</span>
                      {isActive && (
                        <span className="absolute bottom-2 right-0 top-2 w-1 rounded-l-full bg-nuwa-base" />
                      )}
                    </motion.button>
                  );
                })}
              </motion.nav>

              <p className="mb-2 mt-6 px-3 text-[11px] font-bold text-neutral-400">
                حسابك
              </p>
              <motion.nav
                className="grid gap-1"
                aria-label="روابط الحساب"
                variants={sidebarListVariants}
                initial="hidden"
                animate="show"
              >
                {isAuthenticated ? (
                  <motion.button
                    type="button"
                    variants={sidebarItemVariants}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => goTo("dashboard")}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-start text-sm font-semibold text-neutral-600 transition-colors hover:bg-neutral-50 hover:text-nuwa-base"
                  >
                    <LayoutDashboard size={18} />
                    مساحة العمل
                  </motion.button>
                ) : (
                  <>
                    <motion.button
                      type="button"
                      variants={sidebarItemVariants}
                      whileTap={{ scale: 0.97 }}
                      onClick={() => goTo("login")}
                      className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-start text-sm font-semibold transition-colors ${
                        currentView === "login"
                          ? "bg-nuwa-soft text-nuwa-base"
                          : "text-neutral-600 hover:bg-neutral-50 hover:text-nuwa-base"
                      }`}
                    >
                      <LogIn size={18} />
                      تسجيل الدخول
                    </motion.button>
                    <motion.button
                      type="button"
                      variants={sidebarItemVariants}
                      whileTap={{ scale: 0.97 }}
                      onClick={() => goTo("register")}
                      className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-start text-sm font-semibold transition-colors ${
                        currentView === "register"
                          ? "bg-nuwa-soft text-nuwa-base"
                          : "text-neutral-600 hover:bg-neutral-50 hover:text-nuwa-base"
                      }`}
                    >
                      <UserPlus size={18} />
                      إنشاء حساب
                    </motion.button>
                  </>
                )}
              </motion.nav>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </MotionConfig>,
    document.body,
  );
}
