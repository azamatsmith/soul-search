import { useEffect, useMemo } from 'react'
import type { LogCard } from '../lib/sightingsCopy'
import type { QueuedSighting } from '../lib/uploadQueue'

export const useWaitingCards = (
  items: QueuedSighting[],
  name: string,
): LogCard[] => {
  const cards = useMemo(
    () =>
      items.map((item) => ({
        categories: item.categories,
        checkNote: null,
        claimType: item.claimType,
        id: item.id,
        kind: 'waiting' as const,
        name,
        photoUrl: URL.createObjectURL(item.photo),
        points: 0,
        takenAt: item.takenAt,
      })),
    [items, name],
  )

  useEffect(
    () => () => {
      cards.forEach(
        (card) => card.photoUrl && URL.revokeObjectURL(card.photoUrl),
      )
    },
    [cards],
  )

  return cards
}
