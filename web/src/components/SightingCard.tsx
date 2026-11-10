import { claimLine, type LogCard, timeText } from '../lib/sightingsCopy'
import styles from './SightingCard.module.css'
import { StatusChip } from './StatusChip'

export interface SightingCardProps {
  card: LogCard
}

export const SightingCard = ({ card }: SightingCardProps) => (
  <li className={styles.card}>
    <span className={styles.photo}>
      {card.photoUrl && (
        <img
          alt=""
          className={styles.image}
          loading="lazy"
          src={card.photoUrl}
        />
      )}
    </span>
    <span className={styles.body}>
      <span className={styles.top}>
        <span className={styles.name}>{card.name}</span>
        <span className={styles.time}>{timeText(card.takenAt)}</span>
      </span>
      <span className={styles.claim}>{claimLine(card)}</span>
      <StatusChip card={card} />
    </span>
  </li>
)
