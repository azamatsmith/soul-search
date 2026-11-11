import { LeaderboardPlaceholder } from '../components/LeaderboardPlaceholder'
import { LoadError } from '../components/LoadError'
import { PastWeekCard } from '../components/PastWeekCard'
import { PushedScreen } from '../components/PushedScreen'
import { useApiResource } from '../hooks/useApiResource'
import { getPastWeeks } from '../lib/api'
import styles from './PastWeeksScreen.module.css'

const players = (count: number) =>
  `${count} ${count === 1 ? 'player' : 'players'}`

export const PastWeeksScreen = () => {
  const past = useApiResource(getPastWeeks)
  const weeks = past.data?.weeks ?? []

  return (
    <PushedScreen
      backLabel="Scores"
      backTo="/scores"
      kicker={past.data ? players(past.data.total_players) : undefined}
      title="Past weeks"
    >
      {past.status === 'loading' && <LeaderboardPlaceholder />}
      {past.status === 'error' && (
        <LoadError onRetry={past.retry} thing="past weeks" />
      )}
      {past.data && weeks.length === 0 && (
        <p className={styles.empty}>
          Finished weeks show up here after Monday’s reset.
        </p>
      )}
      {weeks.length > 0 && (
        <ul className={styles.list}>
          {weeks.map((week) => (
            <PastWeekCard key={week.id} week={week} />
          ))}
        </ul>
      )}
    </PushedScreen>
  )
}
