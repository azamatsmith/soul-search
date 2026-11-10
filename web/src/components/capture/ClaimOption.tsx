import type { ChangeEvent } from 'react'
import type { ClaimType } from '../../lib/claim'
import styles from './ClaimOption.module.css'

export interface ClaimOptionProps {
  checked: boolean
  description: string
  label: string
  onChange: (claimType: ClaimType) => void
  points: number
  value: ClaimType
}

export const ClaimOption = ({
  checked,
  description,
  label,
  onChange,
  points,
  value,
}: ClaimOptionProps) => {
  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (event.target.checked) onChange(value)
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
        <span className={styles.description}>{description}</span>
      </span>
      <span
        className={
          value === 'special'
            ? `${styles.badge} ${styles.special}`
            : styles.badge
        }
      >
        +{points}
      </span>
    </label>
  )
}
