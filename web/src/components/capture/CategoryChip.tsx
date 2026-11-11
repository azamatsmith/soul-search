import { pointsText } from '../../lib/claim'
import styles from './CategoryChip.module.css'

export interface CategoryChipProps {
  bonus?: number
  label: string
  onSelect: (label: string) => void
  selected: boolean
}

const DOTS: Record<string, string> = {
  'Alien Green': styles.alienGreen,
  'Brown paint': styles.brownPaint,
}

export const CategoryChip = ({
  bonus,
  label,
  onSelect,
  selected,
}: CategoryChipProps) => {
  const handleClick = () => onSelect(label)
  const dot = DOTS[label]

  return (
    <button
      aria-checked={selected}
      className={selected ? `${styles.chip} ${styles.selected}` : styles.chip}
      onClick={handleClick}
      role="radio"
      type="button"
    >
      {dot && <span aria-hidden className={`${styles.dot} ${dot}`} />}
      {label}
      {bonus !== undefined && (
        <span className={styles.bonus}>{pointsText(bonus)}</span>
      )}
    </button>
  )
}
