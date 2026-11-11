import { ChevronRight } from 'lucide-react'
import { Link } from 'react-router'
import styles from './ChallengeCard.module.css'

export interface ChallengeCardProps {
  live?: boolean
  status: string
  subtitle: string
  title: string
  to: string
}

export const ChallengeCard = ({
  live = false,
  status,
  subtitle,
  title,
  to,
}: ChallengeCardProps) => (
  <li className={styles.item}>
    <Link
      className={live ? `${styles.card} ${styles.live}` : styles.card}
      to={to}
    >
      <span className={styles.text}>
        <span className={styles.title}>{title}</span>
        <span className={styles.subtitle}>{subtitle}</span>
        <span
          className={
            live ? `${styles.status} ${styles.liveStatus}` : styles.status
          }
        >
          {status}
        </span>
      </span>
      <ChevronRight aria-hidden className={styles.chevron} />
    </Link>
  </li>
)
