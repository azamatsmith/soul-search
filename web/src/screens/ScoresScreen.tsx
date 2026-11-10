import { useState } from 'react'
import { EmptyState } from '../components/EmptyState'
import { LeaderboardPlaceholder } from '../components/LeaderboardPlaceholder'
import { LeaderboardRow } from '../components/LeaderboardRow'
import { LoadError } from '../components/LoadError'
import { ScreenTitle } from '../components/ScreenTitle'
import { SegmentedControl } from '../components/SegmentedControl'
import { useApiResource } from '../hooks/useApiResource'
import { useAutoRefresh } from '../hooks/useAutoRefresh'
import { getLeaderboard, type LeaderboardScope } from '../lib/api'
import { leaderboardKicker } from '../lib/leaderboardCopy'
import styles from './ScoresScreen.module.css'

const loadWeek = () => getLeaderboard('week')
const loadAll = () => getLeaderboard('all')

const SCOPES = [
  { label: 'This week', value: 'week' as const },
  { label: 'All time', value: 'all' as const },
]

const EMPTY = {
  all: { body: 'The first photo puts you on top.', title: 'No scores yet' },
  week: {
    body: 'Nobody has spotted a Soul since Monday. The first photo puts you on top.',
    title: 'No scores yet this week',
  },
}

export const ScoresScreen = () => {
  const [scope, setScope] = useState<LeaderboardScope>('week')
  const week = useApiResource(loadWeek)
  const all = useApiResource(loadAll)
  const board = scope === 'week' ? week : all
  const scopeLabel = scope === 'week' ? 'This week' : 'All time'

  const handleRefresh = () => {
    week.refresh()
    all.refresh()
  }
  useAutoRefresh(handleRefresh)

  return (
    <div className={styles.screen}>
      <ScreenTitle
        kicker={board.data ? leaderboardKicker(board.data) : scopeLabel}
        title="Leaderboard"
      />
      <div className={styles.body}>
        <SegmentedControl
          label="Leaderboard period"
          onChange={setScope}
          options={SCOPES}
          value={scope}
        />
        {board.status === 'loading' && <LeaderboardPlaceholder />}
        {board.status === 'error' && (
          <LoadError onRetry={board.retry} thing="the scores" />
        )}
        {board.data?.rows.length === 0 && <EmptyState {...EMPTY[scope]} />}
        {board.data && board.data.rows.length > 0 && (
          <ol className={styles.list}>
            {board.data.rows.map((entry) => (
              <LeaderboardRow entry={entry} key={entry.player_id} />
            ))}
          </ol>
        )}
      </div>
    </div>
  )
}
