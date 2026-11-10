import { useEffect, useState } from 'react'
import type { ApiErrorCode, ApiResult } from '../lib/api'

export interface ApiResource<T> {
  status: 'loading' | 'ready' | 'error'
  data: T | null
  error: ApiErrorCode | null
  refresh: () => void
  retry: () => void
}

interface Attempt {
  count: number
  quiet: boolean
}

interface Loaded<T> {
  attempt: number
  result: ApiResult<T>
}

interface Good<T> {
  data: T
}

export const useApiResource = <T>(
  load: () => Promise<ApiResult<T>>,
): ApiResource<T> => {
  const [attempt, setAttempt] = useState<Attempt>({ count: 0, quiet: false })
  const [loaded, setLoaded] = useState<Loaded<T> | null>(null)
  const [lastGood, setLastGood] = useState<Good<T> | null>(null)

  useEffect(() => {
    let active = true
    load().then((result) => {
      if (!active) return
      setLoaded({ attempt: attempt.count, result })
      if (result.ok) setLastGood({ data: result.data })
    })
    return () => {
      active = false
    }
  }, [load, attempt])

  const retry = () =>
    setAttempt((current) => ({ count: current.count + 1, quiet: false }))
  const refresh = () => {
    if (loaded === null) return
    setAttempt((current) => ({ count: current.count + 1, quiet: true }))
  }
  const controls = { refresh, retry }

  if (attempt.quiet && lastGood) {
    return { status: 'ready', data: lastGood.data, error: null, ...controls }
  }
  const current = loaded?.attempt === attempt.count || attempt.quiet
  const result = loaded && current ? loaded.result : null
  if (!result)
    return { status: 'loading', data: null, error: null, ...controls }
  if (!result.ok) {
    return { status: 'error', data: null, error: result.error, ...controls }
  }
  return { status: 'ready', data: result.data, error: null, ...controls }
}
