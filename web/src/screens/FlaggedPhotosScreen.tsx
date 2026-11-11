import { useSearchParams } from 'react-router'
import { EmptyNote } from '../components/EmptyNote'
import { LoadError } from '../components/LoadError'
import { PushedScreen } from '../components/PushedScreen'
import { ReviewCard } from '../components/ReviewCard'
import { SegmentedControl } from '../components/SegmentedControl'
import { useApiResource } from '../hooks/useApiResource'
import { getReviewQueue } from '../lib/api'
import styles from './FlaggedPhotosScreen.module.css'

type Tab = 'false_calls' | 'flagged'

export const FlaggedPhotosScreen = () => {
  const queue = useApiResource(['reviewQueue'], getReviewQueue)
  const [params, setParams] = useSearchParams()
  const tab: Tab =
    params.get('tab') === 'false_calls' ? 'false_calls' : 'flagged'
  const items = queue.data?.[tab] ?? []
  const flaggedCount = queue.data?.flagged.length ?? 0
  const falseCallCount = queue.data?.false_calls.length ?? 0

  const handleTabChange = (next: Tab) =>
    setParams(next === 'flagged' ? {} : { tab: next }, { replace: true })

  return (
    <PushedScreen
      backLabel="Admin tools"
      backTo="/admin"
      kicker="Admins only"
      title="Flagged photos"
    >
      <SegmentedControl
        label="Which photos"
        onChange={handleTabChange}
        options={[
          { label: `Flagged (${flaggedCount})`, value: 'flagged' },
          {
            label: `Auto false calls (${falseCallCount})`,
            value: 'false_calls',
          },
        ]}
        value={tab}
      />
      {queue.status === 'error' && (
        <LoadError onRetry={queue.retry} thing="flagged photos" />
      )}
      {queue.data && items.length === 0 && (
        <EmptyNote>
          {tab === 'flagged'
            ? 'No flagged photos. Nothing to look at right now.'
            : 'No automatic false calls to look at.'}
        </EmptyNote>
      )}
      {items.length > 0 && (
        <ul className={styles.list}>
          {items.map((item) => (
            <ReviewCard item={item} key={item.id} />
          ))}
        </ul>
      )}
    </PushedScreen>
  )
}
