import type { Period, Standing } from '../lib/api'
import { shortTimeLeftText } from '../lib/challengeTime'
import { ordinal, weekRange } from '../lib/homeCopy'
import { AvatarButton } from './AvatarButton'
import styles from './HomeHeader.module.css'

export interface HomeHeaderProps {
  name: string | null
  now: number
  period: Period
  standing: Standing
}

const kickerFor = (period: Period) =>
  period.name ?? `Week of ${weekRange(period.starts_at, period.ends_at)}`

export const HomeHeader = ({
  name,
  now,
  period,
  standing,
}: HomeHeaderProps) => (
  <header className={styles.header}>
    <div className={styles.row}>
      <div className={styles.when}>
        <span className={styles.kicker}>{kickerFor(period)}</span>
        <span className={styles.left}>
          {shortTimeLeftText(period.ends_at, now)}
        </span>
      </div>
      <AvatarButton name={name} />
    </div>
    <div className={`${styles.row} ${styles.scores}`}>
      <div className={styles.stat}>
        <span className={styles.label}>Your points</span>
        <span className={styles.points}>{standing.points}</span>
      </div>
      <div className={`${styles.stat} ${styles.rankStat}`}>
        <span className={styles.label}>Rank</span>
        {standing.rank === null ? (
          <span className={styles.unranked}>
            <span className={styles.hint}>Snap a Soul to get ranked</span>
            <span className={styles.of}>{standing.total_players} players</span>
          </span>
        ) : (
          <span className={styles.rank}>
            <span>{ordinal(standing.rank)}</span>{' '}
            <span className={styles.of}>of {standing.total_players}</span>
          </span>
        )}
      </div>
    </div>
  </header>
)
