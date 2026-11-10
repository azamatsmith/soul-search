import { useEffect, useState } from 'react'

const MINUTE = 60_000

export const useNow = () => {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), MINUTE)
    return () => clearInterval(timer)
  }, [])

  return now
}
