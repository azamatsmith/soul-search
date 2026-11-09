import { useEffect, useState } from 'react'

const secondsUntil = (until: string, now: number) =>
  Math.max(0, Math.ceil((new Date(until).getTime() - now) / 1000))

export const formatCountdown = (seconds: number): string => {
  const minutes = Math.floor(seconds / 60)
  const rest = String(seconds % 60).padStart(2, '0')
  return `${minutes}:${rest}`
}

export const useCountdown = (until: string): number => {
  const [now, setNow] = useState(() => Date.now())
  const secondsLeft = secondsUntil(until, now)

  useEffect(() => {
    if (secondsUntil(until, Date.now()) === 0) return
    const timer = setInterval(() => {
      const current = Date.now()
      setNow(current)
      if (secondsUntil(until, current) === 0) clearInterval(timer)
    }, 1000)
    return () => clearInterval(timer)
  }, [until])

  return secondsLeft
}
