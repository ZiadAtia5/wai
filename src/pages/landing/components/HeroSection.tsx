import { useEffect, useRef, type CSSProperties, type ReactNode } from "react"
import {
  animate,
  motion,
  useMotionValue,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
  type MotionValue,
} from "framer-motion"
import {
  ArrowLeft,
  Atom,
  Brain,
  BookOpen,
  Calculator,
  ClipboardCheck,
  Clock,
  Code2,
  FlaskConical,
  LayoutList,
  Languages,
  Landmark,
  TrendingUp,
  Users,
} from "lucide-react"
import ApiQueryState from "../../../components/ApiQueryState"
import PublicNavbar from "../../../components/layout/PublicNavbar"
import type { LandingCatalogSummary } from "../types"
import type { NavigateFn } from "../../../types"
import studentHeroImage from "../../../assets/student-hero.jpg"
import { SkeletonBlock } from "./LandingSkeletons"

/* -------------------------------------------------------------------------- */
/*  Assets                                                                     */
/* -------------------------------------------------------------------------- */

/** Student photo shown in the centre of the orbit. Set to null to use the illustration. */
const STUDENT_IMAGE: string | null = studentHeroImage

/* -------------------------------------------------------------------------- */
/*  Background: floating academic glyphs + knowledge graph reacting to cursor */
/* -------------------------------------------------------------------------- */

const GLYPHS = [
  "∑",
  "π",
  "√",
  "∫",
  "Δ",
  "∞",
  "x²",
  "H₂O",
  "%",
  "θ",
  "أ",
  "ب",
  "ج",
  "٣",
  "+",
  "÷",
  "≈",
  "α",
  "E=mc²",
  "ن",
]

/*
 * The copy column sits on the right (RTL), so the field is softened there to keep
 * the headline crisp, and reaches full strength behind the photo on the left.
 * If the layout is ever switched to LTR, change "to left" to "to right".
 */
const FIELD_MASK =
  "linear-gradient(to left, rgba(0,0,0,.35) 0%, rgba(0,0,0,.35) 34%, #000 72%)"

function KnowledgeField({ reduce }: { reduce: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current
    const host = canvas?.parentElement
    const ctx = canvas?.getContext("2d")
    if (!canvas || !host || !ctx) return

    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const fontFamily = getComputedStyle(canvas).fontFamily
    const mouse = { x: -9999, y: -9999 }
    const REACH = 170
    const LINK = 150
    let w = 0
    let h = 0
    let raf = 0
    let visible = true

    type P = {
      x: number
      y: number
      vx: number
      vy: number
      bvx: number
      bvy: number
      g: string
      size: number
      rot: number
      vr: number
      a: number
    }
    let ps: P[] = []
    const rand = (a: number, b: number) => a + Math.random() * (b - a)

    const build = () => {
      const r = host.getBoundingClientRect()
      w = r.width
      h = r.height
      canvas.width = Math.round(w * dpr)
      canvas.height = Math.round(h * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      const n = Math.max(14, Math.min(38, Math.round((w * h) / 30000)))
      ps = Array.from({ length: n }, (_, i) => {
        const bvx = rand(-0.18, 0.18)
        const bvy = rand(-0.14, 0.14)
        return {
          x: rand(0, w),
          y: rand(0, h),
          vx: bvx,
          vy: bvy,
          bvx,
          bvy,
          g: GLYPHS[i % GLYPHS.length],
          size: rand(16, 38),
          rot: rand(-0.5, 0.5),
          vr: rand(-0.002, 0.002),
          a: rand(0.3, 0.5),
        }
      })
    }

    const frame = () => {
      ctx.clearRect(0, 0, w, h)

      for (const p of ps) {
        if (!reduce) {
          p.vx += (p.bvx - p.vx) * 0.02
          p.vy += (p.bvy - p.vy) * 0.02
          const dx = p.x - mouse.x
          const dy = p.y - mouse.y
          const d = Math.hypot(dx, dy)
          if (d < REACH && d > 0.01) {
            const f = (1 - d / REACH) * 0.55
            p.vx += (dx / d) * f
            p.vy += (dy / d) * f
          }
          p.x += p.vx
          p.y += p.vy
          p.rot += p.vr
          if (p.x < -60) p.x = w + 60
          if (p.x > w + 60) p.x = -60
          if (p.y < -60) p.y = h + 60
          if (p.y > h + 60) p.y = -60
        }
      }

      // links between neighbours + from cursor
      ctx.lineWidth = 1.2
      for (let i = 0; i < ps.length; i++) {
        const a = ps[i]
        for (let j = i + 1; j < ps.length; j++) {
          const b = ps[j]
          const d = Math.hypot(a.x - b.x, a.y - b.y)
          if (d < LINK) {
            ctx.strokeStyle = `rgba(20,112,53,${0.08 + (1 - d / LINK) * 0.28})`
            ctx.beginPath()
            ctx.moveTo(a.x, a.y)
            ctx.lineTo(b.x, b.y)
            ctx.stroke()
          }
        }
        const dm = Math.hypot(a.x - mouse.x, a.y - mouse.y)
        if (dm < REACH * 1.25) {
          ctx.strokeStyle = `rgba(20,112,53,${0.25 + (1 - dm / (REACH * 1.25)) * 0.45})`
          ctx.beginPath()
          ctx.moveTo(mouse.x, mouse.y)
          ctx.lineTo(a.x, a.y)
          ctx.stroke()
        }
      }

      ctx.textAlign = "center"
      ctx.textBaseline = "middle"
      for (const p of ps) {
        const dm = Math.hypot(p.x - mouse.x, p.y - mouse.y)
        const near = dm < REACH * 1.25 ? 1 - dm / (REACH * 1.25) : 0
        ctx.save()
        ctx.translate(p.x, p.y)
        ctx.rotate(p.rot)
        ctx.font = `600 ${p.size}px ${fontFamily}`
        ctx.fillStyle = `rgba(18,98,47,${Math.min(0.9, p.a + near * 0.4)})`
        ctx.fillText(p.g, 0, 0)
        ctx.restore()
      }

      if (!reduce && visible) raf = requestAnimationFrame(frame)
    }

    const start = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(frame)
    }

    const onMove = (e: PointerEvent) => {
      const r = host.getBoundingClientRect()
      mouse.x = e.clientX - r.left
      mouse.y = e.clientY - r.top
    }
    const onLeave = () => {
      mouse.x = -9999
      mouse.y = -9999
    }

    build()
    start()
    host.addEventListener("pointermove", onMove)
    host.addEventListener("pointerleave", onLeave)

    const ro = new ResizeObserver(() => {
      build()
      if (reduce) start()
    })
    ro.observe(host)

    const io = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting
      if (visible && !reduce) start()
    })
    io.observe(host)

    return () => {
      cancelAnimationFrame(raf)
      host.removeEventListener("pointermove", onMove)
      host.removeEventListener("pointerleave", onLeave)
      ro.disconnect()
      io.disconnect()
    }
  }, [reduce])

  return (
    <canvas
      ref={ref}
      aria-hidden
      className="pointer-events-none absolute inset-0 size-full"
      style={{ WebkitMaskImage: FIELD_MASK, maskImage: FIELD_MASK }}
    />
  )
}

/* -------------------------------------------------------------------------- */
/*  Student (photo or illustration)                                            */
/* -------------------------------------------------------------------------- */

function StudentIllustration() {
  return (
    <svg
      viewBox="0 0 120 120"
      role="img"
      aria-label="طالب"
      className="size-full"
    >
      <rect width="120" height="120" fill="#6ee7b7" />
      <circle cx="98" cy="22" r="15" fill="#a7f3d0" opacity=".7" />
      <circle cx="16" cy="96" r="22" fill="#34d399" opacity=".45" />
      <path d="M12 120C12 93 33 83 60 83s48 10 48 37Z" fill="#0f4a30" />
      <path d="M38 87 34 120h11l5-31Z" fill="#34d399" />
      <path d="M82 87l4 33H75l-5-31Z" fill="#34d399" />
      <path d="M50 83l10 13 10-13Z" fill="#f8fafc" />
      <rect x="53" y="68" width="14" height="19" rx="6" fill="#e3ad81" />
      <circle cx="41" cy="54" r="4.5" fill="#e3ad81" />
      <circle cx="79" cy="54" r="4.5" fill="#e3ad81" />
      <ellipse cx="60" cy="52" rx="19" ry="21" fill="#f1c9a0" />
      <path
        d="M41 51C39 31 51 23 62 23c15 0 21 11 18 28-3-9-9-13-20-13s-17 4-19 13Z"
        fill="#1f2937"
      />
      <circle cx="53" cy="55" r="2.1" fill="#1f2937" />
      <circle cx="67" cy="55" r="2.1" fill="#1f2937" />
      <path
        d="M53 64q7 6 14 0"
        fill="none"
        stroke="#9a5b3a"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  )
}

/* -------------------------------------------------------------------------- */
/*  Orbit of subjects                                                          */
/*                                                                             */
/*  One shared phase drives every node along a rounded-rectangle path that     */
/*  hugs the photo. Equal spacing + equal speed means nodes never overlap.     */
/* -------------------------------------------------------------------------- */

const ORBIT_A = 282 // half-width of the path
const ORBIT_B = 238 // half-height of the path
const ORBIT_SECONDS = 110 // one full revolution
const SUPER_EXP = 0.78 // < 1 squares the ellipse so it follows the photo's corners

type OrbitNodeDef = {
  icon: typeof Calculator,
  label: string,
}

const orbitNodes: OrbitNodeDef[] = [
  { icon: Calculator, label: "رياضيات" },
  { icon: FlaskConical, label: "كيمياء" },
  { icon: Languages, label: "لغات" },
  { icon: Atom, label: "فيزياء" },
  { icon: Code2, label: "برمجة" },
  { icon: BookOpen, label: "أدب" },
  { icon: Landmark, label: "تاريخ" },
]

function pathPoint(deg: number, a: number, b: number) {
  const t = (deg * Math.PI) / 180
  const c = Math.cos(t)
  const s = Math.sin(t)
  return {
    x: a * Math.sign(c) * Math.abs(c) ** SUPER_EXP,
    y: b * Math.sign(s) * Math.abs(s) ** SUPER_EXP,
  }
}

function ringPath(a: number, b: number) {
  const steps = 160
  const d = Array.from({ length: steps }, (_, i) => {
    const { x, y } = pathPoint((i * 360) / steps, a, b)
    return `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`
  }).join(" ")
  return `${d}Z`
}

const RING_INNER = ringPath(ORBIT_A, ORBIT_B)
const RING_OUTER = ringPath(ORBIT_A + 22, ORBIT_B + 22)

function OrbitNode({
  icon: Icon,
  label,
  offset,
  phase,
}: OrbitNodeDef & {
  offset: number,
  phase: MotionValue<number>,
}) {
  const x = useTransform(
    phase,
    (p) => pathPoint(p + offset, ORBIT_A, ORBIT_B).x,
  )
  const y = useTransform(
    phase,
    (p) => pathPoint(p + offset, ORBIT_A, ORBIT_B).y,
  )
  // nodes on the lower edge read slightly larger, which adds depth
  const scale = useTransform(
    phase,
    (p) => 0.9 + 0.1 * ((Math.sin(((p + offset) * Math.PI) / 180) + 1) / 2),
  )

  return (
    <motion.div
      aria-hidden
      className="absolute left-1/2 top-1/2"
      style={{ x, y, scale }}
    >
      <div className="flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1.5">
        <span className="grid size-12 place-items-center rounded-xl border border-[#deebe1] bg-white text-nuwa-base shadow-[0_10px_26px_-14px_rgba(23,53,42,.55)]">
          <Icon size={22} />
        </span>
        <span className="text-[11px] font-semibold text-[#456650]">
          {label}
        </span>
      </div>
    </motion.div>
  )
}

function Orbit({ reduce }: { reduce: boolean }) {
  const phase = useMotionValue(0)

  useEffect(() => {
    if (reduce) return
    const controls = animate(phase, 360, {
      duration: ORBIT_SECONDS,
      ease: "linear",
      repeat: Infinity,
    })
    return () => controls.stop()
  }, [phase, reduce])

  return (
    <div className="absolute left-1/2 top-1/2 h-[580px] w-[620px] -translate-x-1/2 -translate-y-1/2 scale-[.51] min-[360px]:scale-[.58] min-[400px]:scale-[.6] sm:scale-[.9]">
      {/* guide rings */}
      <svg
        aria-hidden
        viewBox="-310 -290 620 580"
        fill="none"
        className="absolute inset-0 size-full text-nuwa-base"
      >
        <path
          d={RING_OUTER}
          stroke="currentColor"
          strokeOpacity=".1"
          strokeWidth="1"
        />
        <path
          d={RING_INNER}
          stroke="currentColor"
          strokeOpacity=".22"
          strokeWidth="1"
          strokeDasharray="3 7"
          strokeLinecap="round"
        />
      </svg>

      {orbitNodes.map((node, i) => (
        <OrbitNode
          key={node.label}
          {...node}
          offset={(i * 360) / orbitNodes.length - 90}
          phase={phase}
        />
      ))}

      {/* core: the student */}
      <div className="absolute left-1/2 top-1/2 h-[240px] w-[320px] -translate-x-1/2 -translate-y-1/2 sm:h-[315px] sm:w-[420px]">
        {!reduce &&
          [0, 1.3].map((d) => (
            <motion.span
              key={d}
              aria-hidden
              className="absolute inset-0 rounded-[28px] border border-nuwa-base/25"
              animate={{ scale: [1, 1.1], opacity: [0.5, 0] }}
              transition={{
                duration: 2.8,
                delay: d,
                repeat: Infinity,
                ease: "easeOut",
              }}
            />
          ))}
        <div className="relative size-full overflow-hidden rounded-[24px] border-[6px] border-white bg-white shadow-[0_30px_60px_-26px_rgba(23,53,42,.6)] ring-1 ring-[#deebe1] sm:rounded-[30px]">
          {STUDENT_IMAGE ? (
            <img
              src={STUDENT_IMAGE}
              alt="طالب يتعلم باستخدام الحاسوب"
              width={420}
              height={315}
              decoding="async"
              className="size-full rounded-[18px] object-cover object-center sm:rounded-[24px]"
              draggable={false}
            />
          ) : (
            <StudentIllustration />
          )}
          {/* soft bottom shade for depth */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-gradient-to-t from-nuwa-deep/20 via-transparent to-transparent"
          />
        </div>
      </div>
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/*  Scroll-driven marquee (bottom band)                                        */
/* -------------------------------------------------------------------------- */

const MARQUEE_COPIES = 6
const MARQUEE_SPEED = 0.24 // slower travel keeps the moving course strip easy to read

function ScrollMarquee({
  reduce,
  children,
}: {
  reduce: boolean
  children: ReactNode
}) {
  const { scrollY } = useScroll()
  const smooth = useSpring(scrollY, {
    stiffness: 75,
    damping: 32,
    mass: 0.45,
  })
  const setWidth = useMotionValue(0)
  const firstSet = useRef<HTMLDivElement>(null)

  // one set's width is the loop length; the wrap below makes the loop seamless
  const x = useTransform([smooth, setWidth], ([y, w]: number[]) => {
    if (!w) return 0
    const travelled = y * MARQUEE_SPEED
    return -(((travelled % w) + w) % w)
  })

  useEffect(() => {
    const el = firstSet.current
    if (!el) return
    const measure = () => setWidth.set(el.offsetWidth)
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [setWidth])

  return (
    <div
      dir="ltr"
      className="overflow-hidden [mask-image:linear-gradient(to_right,transparent,#000_6%,#000_94%,transparent)]"
    >
      <motion.div
        style={reduce ? undefined : { x }}
        className="flex w-max will-change-transform"
      >
        {Array.from({ length: MARQUEE_COPIES }, (_, i) => (
          <div
            key={i}
            ref={i === 0 ? firstSet : undefined}
            aria-hidden={i > 0}
            className="flex shrink-0"
          >
            {children}
          </div>
        ))}
      </motion.div>
    </div>
  )
}

function MarqueeItem({
  icon,
  title,
  hint,
}: {
  icon: ReactNode
  title: ReactNode
  hint: string
}) {
  return (
    <div dir="rtl" className="flex shrink-0 items-center gap-4 py-6 ps-10">
      <span className="grid size-11 shrink-0 place-items-center rounded-full border border-[#deebe1] bg-white text-nuwa-base shadow-sm">
        {icon}
      </span>
      <div className="whitespace-nowrap">
        <div className="text-lg font-bold leading-none tabular-nums">
          {title}
        </div>
        <div className="mt-1.5 text-sm text-[#74857a]">{hint}</div>
      </div>
      <span aria-hidden className="ms-10 h-9 w-px bg-[#d9e6dc]" />
    </div>
  )
}

/* -------------------------------------------------------------------------- */
/*  Small building blocks                                                      */
/* -------------------------------------------------------------------------- */

function Magnetic({
  children,
  strength = 0.25,
}: {
  children: ReactNode
  strength?: number
}) {
  const ref = useRef<HTMLDivElement>(null)
  const x = useSpring(0, { stiffness: 220, damping: 16, mass: 0.4 })
  const y = useSpring(0, { stiffness: 220, damping: 16, mass: 0.4 })
  return (
    <motion.div
      ref={ref}
      style={{ x, y }}
      className="inline-block"
      onPointerMove={(e) => {
        const r = ref.current?.getBoundingClientRect()
        if (!r) return
        x.set((e.clientX - (r.left + r.width / 2)) * strength)
        y.set((e.clientY - (r.top + r.height / 2)) * strength)
      }}
      onPointerLeave={() => {
        x.set(0)
        y.set(0)
      }}
    >
      {children}
    </motion.div>
  )
}

function RevealLine({
  children,
  delay,
  reduce,
}: {
  children: ReactNode
  delay: number
  reduce: boolean
}) {
  return (
    <span className="-mb-3 block overflow-hidden pb-3">
      <motion.span
        className="block"
        initial={reduce ? false : { y: "110%" }}
        animate={{ y: 0 }}
        transition={{ duration: 0.85, delay, ease: [0.2, 0.7, 0.2, 1] }}
      >
        {children}
      </motion.span>
    </span>
  )
}

/* -------------------------------------------------------------------------- */
/*  Hero                                                                       */
/* -------------------------------------------------------------------------- */

const GRID =
  "linear-gradient(to right,rgba(36,108,66,.12) 1px,transparent 1px),linear-gradient(to bottom,rgba(36,108,66,.12) 1px,transparent 1px)"

export default function HeroSection({
  navigate,
  data,
  loading,
  error,
  onRetry,
}: {
  navigate: NavigateFn
  data?: LandingCatalogSummary
  loading: boolean
  error: string | null
  onRetry: () => void
}) {
  const reduce = !!useReducedMotion()
  const sectionRef = useRef<HTMLElement>(null)

  // cursor position, normalised to -0.5..0.5 for a gentle parallax tilt
  const px = useMotionValue(0)
  const py = useMotionValue(0)
  const sx = useSpring(px, { stiffness: 70, damping: 18 })
  const sy = useSpring(py, { stiffness: 70, damping: 18 })
  const rotateY = useTransform(sx, [-0.5, 0.5], [-6, 6])
  const rotateX = useTransform(sy, [-0.5, 0.5], [5, -5])

  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start start", "end start"],
  })
  const copyY = useTransform(scrollYProgress, [0, 1], [0, 80])
  const copyOpacity = useTransform(scrollYProgress, [0, 0.75], [1, 0.2])

  const onMove = (e: React.PointerEvent<HTMLElement>) => {
    const el = sectionRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const x = e.clientX - r.left
    const y = e.clientY - r.top
    el.style.setProperty("--mx", `${x}px`)
    el.style.setProperty("--my", `${y}px`)
    px.set(x / r.width - 0.5)
    py.set(y / r.height - 0.5)
  }

  const up = (delay: number) =>
    reduce
      ? {}
      : {
          initial: { opacity: 0, y: 20 },
          animate: { opacity: 1, y: 0 },
          transition: {
            duration: 0.7,
            delay,
            ease: [0.2, 0.7, 0.2, 1] as const,
          },
        }

  const marqueeContent = (stats: ReactNode) => (
    <ScrollMarquee reduce={reduce}>
      {stats}
      <MarqueeItem
        icon={<ClipboardCheck size={20} />}
        title="اختبارات دورية"
        hint="بعد كل وحدة"
      />
      <MarqueeItem
        icon={<TrendingUp size={20} />}
        title="متابعة التقدم"
        hint="مستواك في أي وقت"
      />
      <MarqueeItem
        icon={<LayoutList size={20} />}
        title="محتوى منظم"
        hint="دروس مرتبة خطوة بخطوة"
      />
      <MarqueeItem
        icon={<Clock size={20} />}
        title="تعلّم بوتيرتك"
        hint="في الوقت الذي يناسبك"
      />
    </ScrollMarquee>
  )

  return (
    <section
      ref={sectionRef}
      onPointerMove={onMove}
      onPointerLeave={() => {
        px.set(0)
        py.set(0)
      }}
      style={{ "--mx": "72%", "--my": "32%" } as CSSProperties}
      className="relative isolate overflow-hidden bg-[radial-gradient(ellipse_at_18%_18%,rgba(118,171,132,.16),transparent_36%),radial-gradient(ellipse_at_86%_76%,rgba(171,205,178,.12),transparent_32%),linear-gradient(135deg,#fffefa_0%,#fbfcf9_52%,#f4f7f3_100%)] text-[#17352a]"
    >
      <PublicNavbar currentView="landing" navigate={navigate} />
      {/* base grid */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[.055] [mask-image:linear-gradient(to_bottom,black,transparent_90%)]"
        style={{ backgroundImage: GRID, backgroundSize: "64px 64px" }}
      />
      {/* grid that lights up under the cursor */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-30"
        style={{
          backgroundImage: GRID,
          backgroundSize: "64px 64px",
          WebkitMaskImage:
            "radial-gradient(260px circle at var(--mx) var(--my), #000, transparent 100%)",
          maskImage:
            "radial-gradient(260px circle at var(--mx) var(--my), #000, transparent 100%)",
        }}
      />
      {/* soft spotlight */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(560px circle at var(--mx) var(--my), rgba(52,145,88,.08), transparent 65%)",
        }}
      />

      <KnowledgeField reduce={reduce} />

      <div className="relative z-10 mx-auto grid max-w-7xl items-center gap-8 px-5 pb-12 pt-24 sm:px-8 md:grid-cols-12 md:pt-28">
        {/* Copy */}
        <motion.div
          style={reduce ? undefined : { y: copyY, opacity: copyOpacity }}
          className="relative z-30 md:col-span-7"
        >
          <motion.div
            {...up(0.05)}
            className="inline-flex items-center gap-3 text-sm font-semibold text-nuwa-base"
          >
            <span className="grid size-9 place-items-center rounded-xl bg-nuwa-base/10">
              <Brain size={19} aria-hidden="true" />
            </span>
            منصة تعليمية متكاملة
          </motion.div>

          <h1 className="mt-6 text-[2.6rem] font-extrabold leading-[1.3] tracking-tight sm:text-6xl lg:text-[4.25rem]">
            <RevealLine delay={0.1} reduce={reduce}>
              تعلّم بوعي،
            </RevealLine>
            <RevealLine delay={0.22} reduce={reduce}>
              <span className="text-nuwa-base">وابنِ مستقبلك بثقة</span>
            </RevealLine>
          </h1>

          <motion.p
            {...up(0.45)}
            className="mt-7 max-w-xl text-lg leading-9 text-[#5e7065]"
          >
            دورات مرتبة يقدّمها معلمون متخصصون، مع اختبارات بعد كل وحدة ومتابعة
            دقيقة لتقدمك من أول درس لآخر درس.
          </motion.p>

          <motion.div
            {...up(0.6)}
            className="mt-10 flex flex-wrap items-center gap-4"
          >
            <Magnetic>
              <button
                onClick={() => navigate("public:courses")}
                className="group inline-flex h-14 items-center gap-3 rounded-xl bg-nuwa-base px-7 text-base font-bold text-white shadow-[0_10px_30px_-10px_rgba(52,121,75,.38)] transition-colors hover:bg-nuwa-deep focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-200 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
              >
                استكشف الدورات
                <ArrowLeft
                  size={18}
                  className="transition-transform group-hover:-translate-x-1"
                />
              </button>
            </Magnetic>
            <Magnetic>
              <button
                onClick={() => navigate("public:teachers")}
                className="inline-flex h-14 items-center gap-2.5 rounded-xl border border-[#cddbd0] bg-white/60 px-6 text-base font-semibold text-[#234736] transition-colors hover:border-[#9fbea7] hover:bg-[#edf5ef] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-200 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
              >
                <Users size={18} className="text-nuwa-base" />
                تعرّف على المعلمين
              </button>
            </Magnetic>
          </motion.div>
        </motion.div>

        {/* Orbit */}
        <div
          className="relative z-10 md:col-span-5"
          style={{ perspective: 1000 }}
        >
          <motion.div
            style={reduce ? undefined : { rotateX, rotateY }}
            initial={reduce ? false : { opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.9, delay: 0.3, ease: [0.2, 0.7, 0.2, 1] }}
            className="relative mx-auto size-[320px] min-[360px]:size-[360px] min-[400px]:size-[380px] sm:size-[560px]"
          >
            <Orbit reduce={reduce} />
          </motion.div>
        </div>
      </div>

      {/* Scroll-linked band: slides sideways as the page scrolls, reverses on scroll up */}
      <div className="relative z-10 border-t border-[#deebe1] bg-white/75 backdrop-blur-sm">
        <ApiQueryState
          loading={loading}
          loadingContent={
            <div aria-busy="true" aria-label="جارٍ تحميل إحصائيات المنصة">
              {marqueeContent(
                <>
                  <MarqueeItem
                    icon={<BookOpen size={20} />}
                    title={<SkeletonBlock className="h-5 w-14 bg-[#dce9df]" />}
                    hint="دورة متاحة"
                  />
                  <MarqueeItem
                    icon={<Users size={20} />}
                    title={<SkeletonBlock className="h-5 w-14 bg-[#dce9df]" />}
                    hint="معلم متخصص"
                  />
                </>,
              )}
            </div>
          }
          error={error}
          isEmpty={false}
          emptyMessage=""
          onRetry={onRetry}
        >
          {data &&
            marqueeContent(
              <>
                <MarqueeItem
                  icon={<BookOpen size={20} />}
                  title={data.courseCount.toLocaleString("ar-EG")}
                  hint="دورة متاحة"
                />
                <MarqueeItem
                  icon={<Users size={20} />}
                  title={data.teacherCount.toLocaleString("ar-EG")}
                  hint="معلم متخصص"
                />
              </>,
            )}
        </ApiQueryState>
      </div>
    </section>
  )
}
