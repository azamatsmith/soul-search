import { useEffect, useState } from 'react'
import type { ApiErrorCode, ApiResult } from '../lib/api'

export interface ApiResource<T> {
  status: 'loading' | 'ready' | 'error'
  data: T | null
  error: ApiErrorCode | null
  retry: () => void
}

interface Loaded<T> {
  attempt: number
  result: ApiResult<T>
}

export const useApiResource = <T>(
  load: () => Promise<ApiResult<T>>,
): ApiResource<T> => {
  const [attempt, setAttempt] = useState(0)
  const [loaded, setLoaded] = useState<Loaded<T> | null>(null)

  useEffect(() => {
    let active = true
    load().then((result) => {
      if (active) setLoaded({ attempt, result })
    })
    return () => {
      active = false
    }
  }, [load, attempt])

  const retry = () => setAttempt((count) => count + 1)
  const result = loaded?.attempt === attempt ? loaded.result : null

  if (!result) return { status: 'loading', data: null, error: null, retry }
  if (!result.ok) {
    return { status: 'error', data: null, error: result.error, retry }
  }
  return { status: 'ready', data: result.data, error: null, retry }
}
