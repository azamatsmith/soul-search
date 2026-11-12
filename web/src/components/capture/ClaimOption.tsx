import type { ChangeEvent } from 'react'
import type { ClaimType } from '../../lib/api'
import styles from './ClaimOption.module.css'

export interface ClaimOptionProps {
  checked: boolean
  description: string
  label: string
  onSelect: () => void
  points: number
  tone: ClaimType
  value: string
}

export const ClaimOption = ({
  checked,
  description,
  label,
  onSelect,
  points,
  tone,
  value,
}: ClaimOptionProps) => {
  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (event.target.checked) onSelect()
  }

  return (
    <label
      className={checked ? `${styles.option} ${styles.checked}` : styles.option}
    >
      <input
        checked={checked}
        className={styles.input}
        name="claim-type"
        onChange={handleChange}
        type="radio"
        value={value}
      />
      <span aria-hidden className={styles.radio} />
      <span className={styles.text}>
        <span className={styles.label}>{label}</span>
        {description && (
          <span className={styles.description}>{description}</span>
        )}
      </span>
      <span className={`${styles.badge} ${styles[tone]}`}>+{points}</span>
    </label>
  )
}
