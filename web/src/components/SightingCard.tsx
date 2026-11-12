import { claimLine, type LogCard, timeText } from '../lib/sightingsCopy'
import { ChallengeTag } from './ChallengeTag'
import { Photo } from './Photo'
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
            <Photo alt="" className={styles.image} lazy src={card.photoUrl} />
          )}
        </span>
        <span className={styles.body}>
          <span className={styles.top}>
            <span className={styles.name}>{card.name}</span>
            <span className={styles.time}>{time}</span>
          </span>
          <span className={styles.claim}>{claimLine(card)}</span>
          <span className={styles.chips}>
            <StatusChip card={card} />
            {card.challengeName && <ChallengeTag name={card.challengeName} />}
          </span>
        </span>
      </button>
    </li>
  )
}
