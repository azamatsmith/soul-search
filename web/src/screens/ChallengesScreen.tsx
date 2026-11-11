import { Link } from 'react-router'
import { ChallengeCard } from '../components/ChallengeCard'
import { EmptyNote } from '../components/EmptyNote'
import { LeaderboardPlaceholder } from '../components/LeaderboardPlaceholder'
import { LoadError } from '../components/LoadError'
import { PushedScreen } from '../components/PushedScreen'
import { useApiResource } from '../hooks/useApiResource'
import { useNow } from '../hooks/useNow'
import { getChallenges, type ChallengeList } from '../lib/api'
import {
  dayRangeText,
  liveText,
  rangeText,
  startsInText,
} from '../lib/challengeTime'
import styles from './ChallengesScreen.module.css'

interface CardContent {
  id: string
  live?: boolean
  name: string
  status: string
  subtitle: string
}

const sections = (list: ChallengeList, now: number) =>
  [
    {
      cards: list.running.map((c) => ({
        id: c.id,
        live: true,
        name: c.name,
        status: liveText(c.ends_at, now),
        subtitle: rangeText(c.starts_at, c.ends_at),
      })),
      title: 'Running now',
    },
    {
      cards: list.upcoming.map((c) => ({
        id: c.id,
        name: c.name,
        status: startsInText(c.starts_at, now),
        subtitle: rangeText(c.starts_at, c.ends_at),
      })),
      title: 'Coming up',
    },
    {
      cards: list.finished.map((c) => ({
        id: c.id,
        name: c.name,
        status: c.winner ? `Won by ${c.winner.display_name}` : 'Nobody scored',
        subtitle: dayRangeText(c.starts_at, c.ends_at),
      })),
      title: 'Finished',
    },
  ].filter((section) => section.cards.length > 0)

const renderCard = (card: CardContent) => (
  <ChallengeCard
    key={card.id}
    live={card.live}
    status={card.status}
    subtitle={card.subtitle}
    title={card.name}
    to={`/admin/challenges/${card.id}`}
  />
)

export const ChallengesScreen = () => {
  const challenges = useApiResource(['challenges'], getChallenges)
  const now = useNow()
  const groups = challenges.data ? sections(challenges.data, now) : []

  return (
    <PushedScreen
      backLabel="Admin tools"
      backTo="/admin"
      kicker="Admins only"
      title="Challenges"
    >
      <Link className={styles.newChallenge} to="/admin/challenges/new">
        + New challenge
      </Link>
      {challenges.status === 'loading' && <LeaderboardPlaceholder />}
      {challenges.status === 'error' && !challenges.data && (
        <LoadError onRetry={challenges.retry} thing="the challenges" />
      )}
      {challenges.data && groups.length === 0 && (
        <EmptyNote>No challenges yet.</EmptyNote>
      )}
      {groups.map((group) => (
        <section className={styles.section} key={group.title}>
          <h2 className={styles.heading}>{group.title}</h2>
          <ul className={styles.list}>{group.cards.map(renderCard)}</ul>
        </section>
      ))}
    </PushedScreen>
  )
}
