import type { Challenge } from '../lib/api'
import {
  howSoonText,
  reminderText,
  upcomingRangeText,
  upcomingRulesText,
} from '../lib/upcomingCopy'
import styles from './UpcomingChallengeCard.module.css'

export interface UpcomingChallengeCardProps {
  challenge: Challenge
  now: number
  soonest: boolean
}

export const UpcomingChallengeCard = ({
  challenge,
  now,
  soonest,
}: UpcomingChallengeCardProps) => {
  const { ends_at, name, rules, starts_at } = challenge
  const cardClass = soonest ? `${styles.card} ${styles.soonest}` : styles.card
  const chipClass = soonest
    ? `${styles.chip} ${styles.chipSoonest}`
    : styles.chip

  return (
    <li className={cardClass}>
      <div className={styles.top}>
        <h2 className={styles.name}>{name}</h2>
        <span className={chipClass}>{howSoonText(starts_at, now)}</span>
      </div>
      <p className={styles.range}>{upcomingRangeText(starts_at, ends_at)}</p>
      <p className={styles.detail}>{upcomingRulesText(rules)}</p>
      {soonest && (
        <p className={styles.detail}>{reminderText(starts_at, ends_at)}</p>
      )}
    </li>
  )
}
