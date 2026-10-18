import React from "react"

import ReactDOM from "react-dom/client"

import App from "./App"

import "./index.css"

import { Toaster } from "react-hot-toast"

import { ConfirmationProvider } from "./components/ConfirmationProvider"

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
      />
    </ConfirmationProvider>
  </React.StrictMode>,
)
