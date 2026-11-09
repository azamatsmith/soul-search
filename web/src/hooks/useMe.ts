import { useEffect, useState } from 'react'
import { getMe, type ApiErrorCode, type Me } from '../lib/api'

export interface MeState {
  status: 'loading' | 'ready' | 'error'
  me: Me | null
  error: ApiErrorCode | null
  setMe: (me: Me) => void
  retry: () => void
}

interface Loaded {
  key: string
  me: Me | null
  error: ApiErrorCode | null
}

export const useMe = (userId: string | null): MeState => {
  const [attempt, setAttempt] = useState(0)
  const [loaded, setLoaded] = useState<Loaded | null>(null)
  const key = `${userId}:${attempt}`

  useEffect(() => {
    if (!userId) return
    let active = true
    getMe().then((result) => {
      if (!active) return
      setLoaded(
        result.ok
          ? { key, me: result.data, error: null }
          : { key, me: null, error: result.error },
      )
    })
    return () => {
      active = false
    }
  }, [userId, key])

  const current = loaded?.key === key ? loaded : null
  const setMe = (me: Me) => setLoaded({ key, me, error: null })
  const retry = () => setAttempt((count) => count + 1)

  if (!userId || !current) {
    return { status: 'loading', me: null, error: null, setMe, retry }
  }
  if (current.error) {
    return { status: 'error', me: null, error: current.error, setMe, retry }
  }
  return { status: 'ready', me: current.me, error: null, setMe, retry }
}
