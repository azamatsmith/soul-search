import { useState } from 'react'
import { EmptyState } from '../components/EmptyState'
import { LoadError } from '../components/LoadError'
import { PhotoViewer } from '../components/PhotoViewer'
import { ScreenTitle } from '../components/ScreenTitle'
import { SegmentedControl } from '../components/SegmentedControl'
import { SightingsList } from '../components/SightingsList'
import { SightingsPlaceholder } from '../components/SightingsPlaceholder'
import { useApiResource } from '../hooks/useApiResource'
import { useAutoRefresh } from '../hooks/useAutoRefresh'
import { useMeContext } from '../hooks/useMeContext'
import { useNow } from '../hooks/useNow'
import { usePhotoParam } from '../hooks/usePhotoParam'
import { useQueuedSightings } from '../hooks/useQueuedSightings'
import { useUploadsFlushed } from '../hooks/useUploadsFlushed'
import { useWaitingCards } from '../hooks/useWaitingCards'
import { getSightings, type LoggedSighting } from '../lib/api'
import { cardKind, groupByDay, type LogCard } from '../lib/sightingsCopy'
import styles from './SightingsScreen.module.css'

type Filter = 'everyone' | 'mine'

const loadEveryone = () => getSightings(false)
const loadMine = () => getSightings(true)

const FILTERS = [
  { label: 'Everyone', value: 'everyone' as const },
  { label: 'Just mine', value: 'mine' as const },
]

const toCard = (sighting: LoggedSighting): LogCard => ({
  categories: sighting.categories,
  checkNote: sighting.check_note,
  claimType: sighting.claim_type,
  fullPhotoUrl: sighting.photo_url ?? sighting.thumb_url,
  id: sighting.id,
  kind: cardKind(sighting),
  name: sighting.display_name,
  photoUrl: sighting.thumb_url,
  points: sighting.points,
  takenAt: sighting.taken_at,
})

export const SightingsScreen = () => {
  const { me } = useMeContext()
  const now = useNow()
  const [filter, setFilter] = useState<Filter>('everyone')
  const everyone = useApiResource(['sightings', 'everyone'], loadEveryone)
  const mine = useApiResource(['sightings', 'mine'], loadMine)
  const queue = useQueuedSightings(me.id)
  const waiting = useWaitingCards(queue.items, me.display_name ?? '')
  const photo = usePhotoParam()
  const log = filter === 'everyone' ? everyone : mine

  const handleRefresh = () => {
    everyone.refresh()
    mine.refresh()
    queue.reload()
  }
  useAutoRefresh(handleRefresh)
  useUploadsFlushed(handleRefresh)

  const sent = log.data?.sightings ?? []
  const sentIds = new Set(sent.map((s) => s.id))
  const cards = [
    ...waiting.filter((card) => !sentIds.has(card.id)),
    ...sent.map(toCard),
  ]
  const opened = photo.photoId
    ? [...(everyone.data?.sightings ?? []), ...(mine.data?.sightings ?? [])]
        .map(toCard)
        .concat(waiting)
        .find((card) => card.id === photo.photoId)
    : undefined
  const countText =
    log.status === 'loading' ? null : `${cards.length} this week`

  return (
    <div className={styles.screen}>
      <ScreenTitle
        action={countText && <span className={styles.count}>{countText}</span>}
        title="Sightings"
      />
      <div className={styles.body}>
        <SegmentedControl
          label="Whose sightings"
          onChange={setFilter}
          options={FILTERS}
          value={filter}
        />
        {log.status === 'loading' && <SightingsPlaceholder />}
        {log.status !== 'loading' && cards.length > 0 && (
          <SightingsList groups={groupByDay(cards, now)} onOpen={photo.open} />
        )}
        {log.status === 'error' && (
          <LoadError onRetry={log.retry} thing="sightings" />
        )}
        {log.status === 'ready' && cards.length === 0 && (
          <EmptyState
            body="Photos from everyone in the group show up here as soon as they're sent."
            title="No sightings yet"
          />
        )}
      </div>
      {opened && (
        <PhotoViewer card={opened} key={opened.id} onClose={photo.close} />
      )}
    </div>
  )
}
