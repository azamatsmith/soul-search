import { claimLine, type LogCard, timeText } from '../lib/sightingsCopy'
import styles from './SightingCard.module.css'
import { StatusChip } from './StatusChip'

export interface SightingCardProps {
  card: LogCard
  onOpen: (id: string) => void
}

export const SightingCard = ({ card, onOpen }: SightingCardProps) => {
  const time = timeText(card.takenAt)

  const handleClick = () => onOpen(card.id)

  return (
    <li className={styles.item}>
      <button
        aria-label={`Open photo from ${card.name}, ${time}`}
        className={styles.card}
        onClick={handleClick}
        type="button"
      >
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
            <span className={styles.time}>{time}</span>
          </span>
          <span className={styles.claim}>{claimLine(card)}</span>
          <StatusChip card={card} />
        </span>
      </button>
    </li>
  )
}
