import { EmptyNote } from '../components/EmptyNote'
import { LeaderboardPlaceholder } from '../components/LeaderboardPlaceholder'
import { LoadError } from '../components/LoadError'
import { PushedScreen } from '../components/PushedScreen'
import { UpcomingChallengeCard } from '../components/UpcomingChallengeCard'
import { useApiResource } from '../hooks/useApiResource'
import { useNow } from '../hooks/useNow'
import { getUpcomingChallenges } from '../lib/api'
import styles from './UpcomingChallengesScreen.module.css'

export const UpcomingChallengesScreen = () => {
  const now = useNow()
  const upcoming = useApiResource(['upcomingChallenges'], getUpcomingChallenges)
  const challenges = upcoming.data ?? []

  return (
    <PushedScreen
      backLabel="Home"
      backTo="/"
      inTabs
      kicker="Coming soon"
      title="Upcoming challenges"
    >
      {upcoming.status === 'loading' && <LeaderboardPlaceholder />}
      {upcoming.status === 'error' && (
        <LoadError onRetry={upcoming.retry} thing="upcoming challenges" />
      )}
      {upcoming.data && challenges.length === 0 && (
        <EmptyNote>No challenges are scheduled yet.</EmptyNote>
      )}
      {challenges.length > 0 && (
        <ul className={styles.list}>
          {challenges.map((challenge, index) => (
            <UpcomingChallengeCard
              challenge={challenge}
              key={challenge.id}
              now={now}
              soonest={index === 0}
            />
          ))}
        </ul>
      )}
      <p className={styles.footnote}>
        All times Pacific. New challenges show up here as soon as an admin adds
        them.
      </p>
    </PushedScreen>
  )
}
