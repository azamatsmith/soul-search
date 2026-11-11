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

  return items.map((item) => {
    const photoUrl = objectUrlFor(item.photo)
    return {
      categories: item.categories,
      challengeName: null,
      checkNote: null,
      claimType: item.claimType,
      fullPhotoUrl: photoUrl,
      id: item.id,
      kind: 'waiting',
      name,
      photoUrl,
      points: 0,
      takenAt: item.takenAt,
    }
  })
}
