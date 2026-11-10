import { type RefObject, useEffect, useRef } from 'react'

export const useModalLayer = (
  focusRef: RefObject<HTMLElement | null>,
  onClose: () => void,
) => {
  const onCloseRef = useRef(onClose)
  useEffect(() => {
    onCloseRef.current = onClose
  })

  useEffect(() => {
    const opener =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null
    const overflow = document.body.style.overflow
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCloseRef.current()
    }

    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', handleKeyDown)
    focusRef.current?.focus()
    return () => {
      document.body.style.overflow = overflow
      document.removeEventListener('keydown', handleKeyDown)
      opener?.focus()
    }
  }, [focusRef])
}
