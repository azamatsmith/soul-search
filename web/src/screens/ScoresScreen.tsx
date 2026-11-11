import { useState } from 'react'
import { Link } from 'react-router'
import { EmptyState } from '../components/EmptyState'
import { LeaderboardPlaceholder } from '../components/LeaderboardPlaceholder'
import { LeaderboardRow } from '../components/LeaderboardRow'
import { LoadError } from '../components/LoadError'
import { ScreenTitle } from '../components/ScreenTitle'
import { SegmentedControl } from '../components/SegmentedControl'
import { useApiResource } from '../hooks/useApiResource'
import { useNow } from '../hooks/useNow'
import { getLeaderboard } from '../lib/api'
import { leaderboardKicker } from '../lib/leaderboardCopy'
import styles from './ScoresScreen.module.css'

const loadWeek = () => getLeaderboard('week')
const loadAll = () => getLeaderboard('all')
const EVERY_30_SECONDS = { refreshEvery: 30_000 }

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
  const now = useNow()
  const [scope, setScope] = useState<'all' | 'week'>('week')
  const week = useApiResource(
    ['leaderboard', 'week'],
    loadWeek,
    EVERY_30_SECONDS,
  )
  const all = useApiResource(['leaderboard', 'all'], loadAll, EVERY_30_SECONDS)
  const board = scope === 'week' ? week : all
  const scopeLabel = scope === 'week' ? 'This week' : 'All time'

  return (
    <div className={styles.screen}>
      <ScreenTitle
        kicker={board.data ? leaderboardKicker(board.data, now) : scopeLabel}
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
        <Link className={styles.pastWeeks} to="/past-weeks">
          See past weeks ›
        </Link>
      </div>
    </div>
  )
}
