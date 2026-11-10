import { useEffect, useState } from 'react'
import {
  deviceQueue,
  type QueuedSighting,
  type QueueStore,
} from '../lib/uploadQueue'
import { useUploadsFlushed } from './useUploadsFlushed'

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

  const reload = () => setVersion((v) => v + 1)
  useUploadsFlushed(reload)

  return { items, reload }
}
