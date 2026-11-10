import { useEffect, useRef } from 'react'
import { UPLOADS_FLUSHED } from '../lib/uploadQueue'

export const useUploadsFlushed = (callback: () => void) => {
  const latest = useRef(callback)

  useEffect(() => {
    latest.current = callback
  })

  useEffect(() => {
    const handleFlushed = () => latest.current()
    window.addEventListener(UPLOADS_FLUSHED, handleFlushed)
    return () => window.removeEventListener(UPLOADS_FLUSHED, handleFlushed)
  }, [])
}
