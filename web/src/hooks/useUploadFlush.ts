import { useEffect } from 'react'
import { flushUploads } from '../lib/uploadQueue'

export const useUploadFlush = (playerId: string) => {
  useEffect(() => {
    const flush = () => void flushUploads(playerId)
    flush()
    window.addEventListener('online', flush)
    return () => window.removeEventListener('online', flush)
  }, [playerId])
}
