import styles from './CategoryChip.module.css'

export interface CategoryChipProps {
  label: string
  onToggle: (label: string) => void
  selected: boolean
}

const DOTS: Record<string, string> = {
  'Alien Green': styles.alienGreen,
  'Brown paint': styles.brownPaint,
}

export const CategoryChip = ({
  label,
  onToggle,
  selected,
}: CategoryChipProps) => {
  const handleClick = () => onToggle(label)
  const dot = DOTS[label]

  return (
    <button
      aria-pressed={selected}
      className={selected ? `${styles.chip} ${styles.selected}` : styles.chip}
      onClick={handleClick}
      type="button"
    >
      {dot && <span aria-hidden className={`${styles.dot} ${dot}`} />}
      {label}
    </button>
  )
}
