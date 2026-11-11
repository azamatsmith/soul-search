import type { Period, Standing } from '../lib/api'
import { shortTimeLeftText, timeLeftText } from '../lib/challengeTime'
import { ordinal, weekRange } from '../lib/homeCopy'
import { AvatarButton } from './AvatarButton'
import styles from './HomeHeader.module.css'

export interface HomeHeaderProps {
  name: string | null
  now: number
  period: Period
  standing: Standing
}

const isChallenge = (period: Period) => period.kind === 'challenge'

const kickerFor = (period: Period) =>
  isChallenge(period)
    ? `Challenge · ${period.name}`
    : `Week of ${weekRange(period.starts_at, period.ends_at)}`

const timeLeftFor = (period: Period, now: number) =>
  isChallenge(period)
    ? timeLeftText(period.ends_at, now)
    : shortTimeLeftText(period.ends_at, now)

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
        <span className={styles.left}>{timeLeftFor(period, now)}</span>
      </div>
      <AvatarButton name={name} />
    </div>
    <div className={`${styles.row} ${styles.scores}`}>
      <div className={styles.stat}>
        <span className={styles.label}>
          {isChallenge(period) ? 'Challenge points' : 'Your points'}
        </span>
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
