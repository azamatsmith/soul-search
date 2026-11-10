import type { Period, Standing } from '../lib/api'
import { behindText, pointsIntro, soulCountText } from '../lib/homeCopy'
import styles from './SummaryCard.module.css'

export interface SummaryCardProps {
  period: Period
  standing: Standing
}

export const SummaryCard = ({ period, standing }: SummaryCardProps) => {
  if (standing.rank === null) {
    return (
      <section className={`${styles.card} ${styles.empty}`}>
        <span className={styles.title}>
          {period.name
            ? `No Souls yet in ${period.name}`
            : 'No Souls yet this week'}
        </span>
        <span className={styles.detail}>
          Your first one is out there. {pointsIntro(period.rules)}
        </span>
      </section>
    )
  }

  return (
    <section className={styles.card}>
      {standing.last_photo_url ? (
        <img
          alt="Your last photo"
          className={styles.thumb}
          src={standing.last_photo_url}
        />
      ) : (
        <span aria-hidden className={`${styles.thumb} ${styles.noPhoto}`} />
      )}
      <div className={styles.text}>
        <span className={styles.title}>
          {soulCountText(standing.count, period.name)}
        </span>
        <span className={styles.detail}>
          {behindText(
            standing.rank,
            standing.next_rank,
            standing.points_behind_next,
          )}
        </span>
      </div>
    </section>
  )
}
