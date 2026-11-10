import type { LeaderboardEntry } from '../lib/api'
import { PlayerAvatar } from './PlayerAvatar'
import styles from './LeaderboardRow.module.css'

export interface LeaderboardRowProps {
  entry: LeaderboardEntry
}

const variantOf = (entry: LeaderboardEntry) => {
  if (entry.is_me) return 'me'
  if (entry.rank === 1) return 'first'
  return 'default'
}

export const LeaderboardRow = ({ entry }: LeaderboardRowProps) => {
  const variant = variantOf(entry)
  const name = entry.is_me ? `${entry.display_name} (you)` : entry.display_name
  const souls = `${entry.count} ${entry.count === 1 ? 'Soul' : 'Souls'}`
  return (
    <li className={`${styles.row} ${styles[variant]}`} data-variant={variant}>
      <span className={styles.rank}>{entry.rank}</span>
      <PlayerAvatar id={entry.player_id} name={entry.display_name} />
      <span className={styles.who}>
        <span className={styles.name}>{name}</span>
        <span className={styles.souls}>{souls}</span>
      </span>
      <span className={styles.points}>{entry.points}</span>
    </li>
  )
}
