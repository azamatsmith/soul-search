import { useEffect, useRef } from 'react'

export const useAutoRefresh = (refresh: () => void, intervalMs = 30_000) => {
  const latest = useRef(refresh)

  useEffect(() => {
    latest.current = refresh
  })

  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | undefined

    const start = () => {
      clearInterval(timer)
      timer = setInterval(() => latest.current(), intervalMs)
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        latest.current()
        start()
      } else {
        clearInterval(timer)
      }
    }

    if (document.visibilityState === 'visible') start()
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [intervalMs])
}
