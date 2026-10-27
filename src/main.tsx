import React from "react"

import ReactDOM from "react-dom/client"

import App from "./App"

import "./index.css"

import { Toaster } from "react-hot-toast"
import { ToastBar, toast, type Toast } from "react-hot-toast"
import { motion, useAnimationControls, type PanInfo } from "framer-motion"

import { ConfirmationProvider } from "./components/ConfirmationProvider"

function SwipeableToast({ item }: { item: Toast }) {
  const controls = useAnimationControls()

  async function handleDragEnd(
    _: MouseEvent | TouchEvent | PointerEvent,
    info: PanInfo,
  ) {
    if (info.offset.y < -45 || info.velocity.y < -450) {
      await controls.start({
        y: -120,
        opacity: 0,
        transition: { duration: 0.2, ease: [0.4, 0, 1, 1] },
      })
      toast.dismiss(item.id)
      return
    }

    void controls.start({
      y: 0,
      opacity: 1,
      transition: { type: "spring", stiffness: 500, damping: 35 },
    })
  }

  return (
    <motion.div
      drag="y"
      dragConstraints={{ top: -90, bottom: 0 }}
      dragElastic={{ top: 0.12, bottom: 0 }}
      dragMomentum={false}
      animate={controls}
      onDragEnd={handleDragEnd}
      className="w-full touch-pan-x"
    >
      <ToastBar toast={item} position="top-center" />
    </motion.div>
  )
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ConfirmationProvider>
      <App />
      <Toaster
        position="top-center"
        gutter={10}
        containerStyle={{
          top: 16,
          bottom: "auto",
          left: "50%",
          right: "auto",
          width: "min(480px, calc(100vw - 64px))",
          transform: "translateX(-50%)",
        }}
        toastOptions={{
          duration: 3500,
          className: "app-toast",
          style: {
            border: "1px solid rgb(66 168 121 / 35%)",
            borderRadius: 9999,
            background: "#0b3b25",
            boxShadow: "0 16px 45px rgb(11 59 37 / 24%)",
            color: "#ffffff",
            fontFamily: "var(--font-sans)",
            fontWeight: 600,
            lineHeight: 1.7,
            direction: "rtl",
            textAlign: "center",
          },
        }}
        children={(item) => <SwipeableToast item={item} />}
      />
    </ConfirmationProvider>
  </React.StrictMode>,
)
