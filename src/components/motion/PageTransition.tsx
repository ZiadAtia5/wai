import { useEffect, useRef, type ReactNode } from "react"

import { motion, useReducedMotion } from "framer-motion"

export const staggerContainerVariants = {
  hidden: {},

  visible: {
    transition: {
      delayChildren: 0.1,

      staggerChildren: 0.06,
    },
  },
}

export const staggerItemVariants = {
  hidden: { opacity: 0, y: 24 },

  visible: {
    opacity: 1,

    y: 0,

    transition: {
      type: "spring" as const,

      stiffness: 260,

      damping: 26,
    },
  },
}

export default function PageTransition({
  children,

  direction = 0,
  animatePage = true,
}: {
  children: ReactNode

  direction?: -1 | 0 | 1
  animatePage?: boolean
}) {
  const pageRef = useRef<HTMLDivElement>(null)

  const reduceMotion = useReducedMotion()

  useEffect(() => {
    const page = pageRef.current

    if (!page) return

    const focusHeading = () => {
      const heading = page.querySelector<HTMLElement>("h1")

      if (!heading) return false

      heading.tabIndex = -1

      heading.focus({ preventScroll: true })

      return true
    }

    if (!focusHeading()) {
      page.tabIndex = -1

      page.focus({ preventScroll: true })

      const observer = new MutationObserver(() => {
        if (focusHeading()) observer.disconnect()
      })

      observer.observe(page, { childList: true, subtree: true })

      return () => observer.disconnect()
    }
  }, [])

  const horizontalOffset = reduceMotion ? 0 : direction * 8

  const enterDuration = reduceMotion ? 0.16 : 0.45

  const exitDuration = reduceMotion ? 0.16 : 0.2

  const ease = [0.22, 1, 0.36, 1] as const

  return (
    <motion.div
      ref={pageRef}
      initial={
        animatePage
          ? {
              opacity: 0,
              y: reduceMotion ? 0 : 10,
              x: horizontalOffset,
              transition: {
                type: "tween",
                duration: enterDuration,
                ease,
              },
            }
          : false
      }
      animate={
        animatePage
          ? {
              opacity: 1,
              y: 0,
              x: 0,
              transition: {
                type: "tween",
                duration: enterDuration,
                ease,
              },
            }
          : undefined
      }
      exit={
        animatePage
          ? {
              opacity: 0,
              y: reduceMotion ? 0 : -8,
              x: 0,
              transition: {
                type: "tween",
                duration: exitDuration,
                ease,
              },
            }
          : undefined
      }
      onAnimationStart={() =>
        pageRef.current?.classList.add("will-change-[opacity,transform]")
      }
      onAnimationComplete={() => {
        pageRef.current?.classList.remove("will-change-[opacity,transform]")
      }}
    >
      {children}
    </motion.div>
  )
}
