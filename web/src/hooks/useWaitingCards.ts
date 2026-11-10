import { useEffect } from 'react'
import { holdObjectUrl, objectUrlFor } from '../lib/objectUrls'
import type { LogCard } from '../lib/sightingsCopy'
import type { QueuedSighting } from '../lib/uploadQueue'

export const useWaitingCards = (
  items: QueuedSighting[],
  name: string,
): LogCard[] => {
  useEffect(() => {
    const releases = items.map((item) => holdObjectUrl(item.photo))
    return () => releases.forEach((release) => release())
  }, [items])

  return items.map((item) => ({
    categories: item.categories,
    checkNote: null,
    claimType: item.claimType,
    id: item.id,
    kind: 'waiting',
    name,
    photoUrl: objectUrlFor(item.photo),
    points: 0,
    takenAt: item.takenAt,
  }))
}
