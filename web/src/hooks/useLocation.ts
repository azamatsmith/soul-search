import { useEffect, useState } from 'react'

export interface Location {
  latitude: number
  longitude: number
}

export const useLocation = (active: boolean): Location | null => {
  const [location, setLocation] = useState<Location | null>(null)
  const [asked, setAsked] = useState(false)

  if (active && !asked) setAsked(true)

  useEffect(() => {
    if (!asked || !navigator.geolocation) return
    let current = true
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        if (current) {
          setLocation({
            latitude: coords.latitude,
            longitude: coords.longitude,
          })
        }
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 60_000, timeout: 5_000 },
    )
    return () => {
      current = false
    }
  }, [asked])

  return location
}
