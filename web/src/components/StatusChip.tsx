import { chipText, type LogCard } from '../lib/sightingsCopy'
import styles from './StatusChip.module.css'

export interface StatusChipProps {
  card: LogCard
}

export const StatusChip = ({ card }: StatusChipProps) => (
  <span className={`${styles.chip} ${styles[card.kind]}`} data-kind={card.kind}>
    {chipText(card)}
  </span>
)
