import { useEffect, useState } from 'react'
import {
  deviceQueue,
  type QueuedSighting,
  type QueueStore,
  UPLOADS_FLUSHED,
} from '../lib/uploadQueue'

export const useQueuedSightings = (
  playerId: string,
  store: QueueStore = deviceQueue,
) => {
  const [items, setItems] = useState<QueuedSighting[]>([])
  const [version, setVersion] = useState(0)

  useEffect(() => {
    let active = true
    store
      .all()
      .then((all) => all.filter((item) => item.playerId === playerId))
      .catch(() => [])
      .then((mine) => {
        if (active) setItems(mine)
      })
    return () => {
      active = false
    }
  }, [playerId, store, version])

  useEffect(() => {
    const handleFlushed = () => setVersion((v) => v + 1)
    window.addEventListener(UPLOADS_FLUSHED, handleFlushed)
    return () => window.removeEventListener(UPLOADS_FLUSHED, handleFlushed)
  }, [])

  const reload = () => setVersion((v) => v + 1)

  return { items, reload }
}
