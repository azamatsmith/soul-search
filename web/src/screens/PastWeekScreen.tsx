import { useParams } from 'react-router'
import { LeaderboardPlaceholder } from '../components/LeaderboardPlaceholder'
import { LeaderboardRow } from '../components/LeaderboardRow'
import { LoadError } from '../components/LoadError'
import { PushedScreen } from '../components/PushedScreen'
import { useApiResource } from '../hooks/useApiResource'
import { getPastWeek, type PastWeek } from '../lib/api'
import { weekRange } from '../lib/homeCopy'
import styles from './PastWeekScreen.module.css'

const titleOf = (week: PastWeek | null) => {
  if (!week) return 'Final standings'
  const winner = week.rows[0]
  return winner ? `${winner.display_name} won` : 'Nobody scored'
}

export const PastWeekScreen = () => {
  const { id = '' } = useParams()
  const week = useApiResource(['pastWeek', id], () => getPastWeek(id))
  const data = week.data

  return (
    <PushedScreen
      backLabel="Past weeks"
      backTo="/past-weeks"
      kicker={
        data ? `Final · ${weekRange(data.starts_at, data.ends_at)}` : undefined
      }
      title={titleOf(data)}
    >
      {week.status === 'loading' && <LeaderboardPlaceholder />}
      {week.status === 'error' && (
        <LoadError onRetry={week.retry} thing="this week" />
      )}
      {data && (
        <ol className={styles.list}>
          {data.rows.map((entry) => (
            <LeaderboardRow entry={entry} key={entry.player_id} />
          ))}
        </ol>
      )}
    </PushedScreen>
  )
}
