import { useEffect, useState } from "react"

import { ApiError } from "../api/client"

interface QueryState<T> {
  data: T | null

  error: string | null

  loading: boolean
}

export function useApiQuery<T>(load: () => Promise<T>, reloadKey = 0) {
  const [state, setState] = useState<QueryState<T>>({
    data: null,

    error: null,

    loading: true,
  })

  useEffect(() => {
    let active = true

    setState({ data: null, error: null, loading: true })

    load()

      .then((data) => {
        if (active) setState({ data, error: null, loading: false })
      })

      .catch((error: unknown) => {
        if (!active) return

        const message =
          error instanceof ApiError
            ? error.message
            : "تعذر تحميل البيانات من الخادم."

        setState({ data: null, error: message, loading: false })
      })

    return () => {
      active = false
    }
  }, [load, reloadKey])

  return state
}
