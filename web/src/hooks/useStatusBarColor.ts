import { useEffect } from 'react'

export const useStatusBarColor = (token: string) => {
  useEffect(() => {
    const meta = document.querySelector('meta[name="theme-color"]')
    const color = getComputedStyle(document.documentElement)
      .getPropertyValue(token)
      .trim()
    if (!meta || !color) return

    const previous = meta.getAttribute('content')
    meta.setAttribute('content', color)
    return () => {
      if (previous) meta.setAttribute('content', previous)
    }
  }, [token])
}
