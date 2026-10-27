import { useEffect, useState } from "react"

import { ApiError } from "../api/client"

interface QueryState<T> {
  data: T | null

  error: string | null

  loading: boolean

  cacheKey?: string
}

const queryCache = new Map<string, unknown>()

export function useApiQuery<T>(
  load: () => Promise<T>,

  reloadKey = 0,

  keepPreviousData = false,

  cacheKey?: string,
) {
  const [state, setState] = useState<QueryState<T>>({
    data:
      cacheKey && queryCache.has(cacheKey)
        ? queryCache.get(cacheKey) as T
        : null,

    error: null,

    loading: !cacheKey || !queryCache.has(cacheKey),

    cacheKey,
  })

  useEffect(() => {
    let active = true
    const hasCachedData = Boolean(cacheKey && queryCache.has(cacheKey))
    const cachedData =
      hasCachedData && cacheKey ? queryCache.get(cacheKey) as T : null

    setState((current) => ({
      data: hasCachedData
        ? cachedData
        : keepPreviousData
          ? current.cacheKey === cacheKey
            ? current.data
            : null
          : null,

      error: null,

      loading: !hasCachedData,

      cacheKey,
    }))

    load()

      .then((data) => {
        if (cacheKey) queryCache.set(cacheKey, data)
        if (active) setState({ data, error: null, loading: false, cacheKey })
      })

      .catch((error: unknown) => {
        if (!active) return

        const message =
          error instanceof ApiError
            ? error.message
            : "تعذر تحميل البيانات حاول مرة آخري."

        setState((current) => ({
          data: hasCachedData
            ? cachedData
            : keepPreviousData && current.cacheKey === cacheKey
              ? current.data
              : null,

          error: message,

          loading: false,

          cacheKey,
        }))
      })

    return () => {
      active = false
    }
  }, [cacheKey, load, reloadKey])

  if (state.cacheKey !== cacheKey) {
    const hasCachedData = Boolean(cacheKey && queryCache.has(cacheKey))
    return {
      data: hasCachedData && cacheKey ? queryCache.get(cacheKey) as T : null,
      error: null,
      loading: !hasCachedData,
    }
  }

  return state
}
