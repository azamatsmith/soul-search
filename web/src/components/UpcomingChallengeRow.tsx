import { Link } from 'react-router'
import type { Challenge } from '../lib/api'
import { startText } from '../lib/upcomingCopy'
import styles from './UpcomingChallengeRow.module.css'

export interface UpcomingChallengeRowProps {
  challenge: Challenge
}

export const UpcomingChallengeRow = ({
  challenge,
}: UpcomingChallengeRowProps) => (
  <Link className={styles.row} to="/upcoming">
    <span aria-hidden className={styles.dot} />
    <span className={styles.text}>
      <span className={styles.name}>Upcoming challenge: {challenge.name}</span>
      <span className={styles.start}>{startText(challenge.starts_at)}</span>
    </span>
    <span aria-hidden className={styles.chevron}>
      ›
    </span>
  </Link>
)
