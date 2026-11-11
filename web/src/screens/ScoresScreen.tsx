import { Link } from 'react-router'
import { EmptyState } from '../components/EmptyState'
import { LeaderboardPlaceholder } from '../components/LeaderboardPlaceholder'
import { LeaderboardRow } from '../components/LeaderboardRow'
import { LoadError } from '../components/LoadError'
import { RulesStrip } from '../components/RulesStrip'
import { ScreenTitle } from '../components/ScreenTitle'
import { SegmentedControl } from '../components/SegmentedControl'
import {
  type LeaderboardTab,
  useLeaderboardTabs,
} from '../hooks/useLeaderboardTabs'
import { useNow } from '../hooks/useNow'
import { leaderboardKicker } from '../lib/leaderboardCopy'
import styles from './ScoresScreen.module.css'

const FIRST_PHOTO = 'The first photo puts you on top.'

const emptyFor = (tab: LeaderboardTab, challengeName: string | null) => {
  if (tab === 'all') return { body: FIRST_PHOTO, title: 'No scores yet' }
  if (challengeName) {
    return { body: FIRST_PHOTO, title: `No scores yet in ${challengeName}` }
  }
  return {
    body: `Nobody has spotted a Soul since Monday. ${FIRST_PHOTO}`,
    title: 'No scores yet this week',
  }
}

export const ScoresScreen = () => {
  const now = useNow()
  const { board, challengeName, options, rules, setTab, tab } =
    useLeaderboardTabs()
  const tabLabel = options.find((option) => option.value === tab)?.label

  return (
    <div className={styles.screen}>
      <ScreenTitle
        kicker={board.data ? leaderboardKicker(board.data, now) : tabLabel}
        title="Leaderboard"
      />
      <div className={styles.body}>
        <SegmentedControl
          label="Leaderboard period"
          onChange={setTab}
          options={options}
          value={tab}
        />
        {tab === 'first' && rules && <RulesStrip rules={rules} />}
        {board.status === 'loading' && <LeaderboardPlaceholder />}
        {board.status === 'error' && (
          <LoadError onRetry={board.retry} thing="the scores" />
        )}
        {board.data?.rows.length === 0 && (
          <EmptyState {...emptyFor(tab, challengeName)} />
        )}
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
