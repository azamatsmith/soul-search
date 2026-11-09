import { useEffect } from 'react'

export type TextSize = 'standard' | 'large'

export const useTextSize = (size: TextSize) => {
  useEffect(() => {
    const root = document.documentElement
    if (size === 'large') {
      root.dataset.text = 'large'
    } else {
      delete root.dataset.text
    }
  }, [size])
}
