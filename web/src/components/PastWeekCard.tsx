import { ChevronRight } from 'lucide-react'
import { Link } from 'react-router'
import type { PastWeekSummary } from '../lib/api'
import { weekRange } from '../lib/homeCopy'
import { youResult } from '../lib/pastWeeksCopy'
import { PlayerAvatar } from './PlayerAvatar'
import styles from './PastWeekCard.module.css'

export interface PastWeekCardProps {
  week: PastWeekSummary
}

export const PastWeekCard = ({ week }: PastWeekCardProps) => {
  const { winner } = week
  const won = week.me?.rank === 1
  const winnerName = winner?.is_me
    ? `${winner.display_name} (you)`
    : winner?.display_name
  return (
    <li className={styles.item}>
      <Link className={styles.card} to={`/past-weeks/${week.id}`}>
        <span className={styles.top}>
          <span className={styles.range}>
            {weekRange(week.starts_at, week.ends_at)}
          </span>
          <ChevronRight aria-hidden className={styles.chevron} />
        </span>
        {winner ? (
          <span className={styles.winner}>
            <PlayerAvatar id={winner.player_id} name={winner.display_name} />
            <span className={styles.who}>
              <span className={styles.name}>{winnerName}</span>
              <span className={styles.label}>Winner</span>
            </span>
            <span className={styles.points}>{winner.points}</span>
          </span>
        ) : (
          <span className={styles.label}>Nobody scored this week</span>
        )}
        <span className={won ? styles.won : styles.result}>
          {youResult(week.me)}
        </span>
      </Link>
    </li>
  )
}
