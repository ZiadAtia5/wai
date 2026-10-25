import { useEffect, useRef } from "react"

import { Search, X } from "lucide-react"

import { AnimatePresence, motion } from "framer-motion"

export default function SearchBar({
  value,

  onChange,

  onSubmit,

  placeholder,

  label,
}: {
  value: string

  onChange: (value: string) => void

  onSubmit: () => void

  placeholder: string

  label: string
}) {
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if (
        event.key === "/" &&
        !event.ctrlKey &&
        !event.metaKey &&
        !event.altKey &&
        !(event.target instanceof HTMLInputElement) &&
        !(event.target instanceof HTMLTextAreaElement) &&
        !(event.target instanceof HTMLElement && event.target.isContentEditable)
      ) {
        event.preventDefault()

        inputRef.current?.focus()
      }
    }

    window.addEventListener("keydown", handleShortcut)

    return () => window.removeEventListener("keydown", handleShortcut)
  }, [])

  return (
    <form
      role="search"
      onSubmit={(event) => {
        event.preventDefault()
        onSubmit()
      }}
      className="flex min-h-[52px] min-w-0 items-center gap-3 rounded-2xl border border-stroke bg-white px-4 shadow-sm transition-colors duration-200 focus-within:border-nuwa-base"
    >
      <Search
        size={19}
        aria-hidden="true"
        className="shrink-0 text-ink-muted"
      />
      <input
        ref={inputRef}
        type="search"
        inputMode="search"
        enterKeyHint="search"
        aria-label={label}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Escape" && value) {
            event.preventDefault()

            onChange("")
          }
        }}
        placeholder={placeholder}
        className="search-focus-input min-h-[52px] min-w-0 flex-1 bg-transparent py-2 text-base text-ink outline-none placeholder:text-ink-muted/75 [&::-webkit-search-cancel-button]:hidden"
      />
      <motion.button
        type="submit"
        whileTap={{ scale: 0.97 }}
        className="min-h-10 shrink-0 rounded-xl bg-nuwa-base px-4 text-sm font-semibold text-white transition-colors hover:bg-nuwa-deep focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-nuwa-base"
      >
        بحث
      </motion.button>
      <AnimatePresence mode="wait" initial={false}>
        {value ? (
          <motion.button
            key="clear"
            type="button"
            aria-label="مسح البحث"
            onClick={() => onChange("")}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            whileTap={{ scale: 0.92 }}
            transition={{ duration: 0.16 }}
            className="grid size-9 shrink-0 place-items-center rounded-full text-ink-muted transition hover:bg-canvas hover:text-nuwa-base focus-visible:outline focus-visible:outline-2 focus-visible:outline-nuwa-base"
          >
            <X size={17} aria-hidden="true" />
          </motion.button>
        ) : (
          <motion.kbd
            key="shortcut"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.16 }}
            className="hidden rounded-lg border border-stroke bg-canvas/70 px-2 py-1 text-xs text-ink-muted lg:inline-flex"
          >
            /
          </motion.kbd>
        )}
      </AnimatePresence>
    </form>
  )
}
