import { useState } from 'react'
import { EmptyState } from '../components/EmptyState'
import { HistoryRow } from '../components/HistoryRow'
import { LoadError } from '../components/LoadError'
import { PushedScreen } from '../components/PushedScreen'
import { SegmentedControl } from '../components/SegmentedControl'
import { useApiResource } from '../hooks/useApiResource'
import { useNow } from '../hooks/useNow'
import { getHistory } from '../lib/api'
import styles from './ChangeHistoryScreen.module.css'

type Filter = 'everything' | 'scores'

const loadEverything = () => getHistory(false)
const loadScores = () => getHistory(true)

const FILTERS = [
  { label: 'Everything', value: 'everything' as const },
  { label: 'Scores only', value: 'scores' as const },
]

export const ChangeHistoryScreen = () => {
  const [filter, setFilter] = useState<Filter>('everything')
  const everything = useApiResource(['history', 'everything'], loadEverything)
  const scores = useApiResource(['history', 'scores'], loadScores)
  const now = useNow()
  const history = filter === 'scores' ? scores : everything
  const entries = history.data?.entries ?? []

  return (
    <PushedScreen
      backLabel="Admin tools"
      backTo="/admin"
      kicker="Newest first"
      title="Change history"
    >
      <SegmentedControl
        label="Which changes"
        onChange={setFilter}
        options={FILTERS}
        value={filter}
      />
      {history.status === 'error' && (
        <LoadError onRetry={history.retry} thing="the change history" />
      )}
      {history.data && entries.length === 0 && (
        <EmptyState
          body="Photo reviews, score changes and settings changes show up here."
          title="No changes yet"
        />
      )}
      {entries.length > 0 && (
        <ul className={styles.list}>
          {entries.map((entry) => (
            <HistoryRow entry={entry} key={entry.id} now={now} />
          ))}
        </ul>
      )}
    </PushedScreen>
  )
}
