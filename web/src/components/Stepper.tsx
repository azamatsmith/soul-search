import { signedPoints } from '../lib/signedPoints'
import styles from './Stepper.module.css'

export interface StepperProps {
  hint?: string
  label: string
  max: number
  min: number
  onChange: (value: number) => void
  value: number
}

export const Stepper = ({
  hint = 'Points each',
  label,
  max,
  min,
  onChange,
  value,
}: StepperProps) => {
  const handleLessClick = () => onChange(value - 1)
  const handleMoreClick = () => onChange(value + 1)

  return (
    <div className={styles.row}>
      <span className={styles.text}>
        <span className={styles.label}>{label}</span>
        <span className={styles.hint}>{hint}</span>
      </span>
      <button
        aria-label={`Less for ${label}`}
        className={styles.less}
        disabled={value <= min}
        onClick={handleLessClick}
        type="button"
      >
        −
      </button>
      <span aria-live="polite" className={styles.value}>
        {signedPoints(value)}
      </span>
      <button
        aria-label={`More for ${label}`}
        className={styles.more}
        disabled={value >= max}
        onClick={handleMoreClick}
        type="button"
      >
        +
      </button>
    </div>
  )
}
