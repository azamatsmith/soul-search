import { useState } from 'react'
import type { Rules } from '../lib/api'
import { specialLabel } from '../lib/reviewCopy'
import { Button } from './Button'
import { CategoryChip } from './capture/CategoryChip'
import styles from './SpecialPicker.module.css'

export interface SpecialPickerProps {
  disabled: boolean
  initial: string | null
  onConfirm: (category: string) => void
  rules: Rules
}

export const SpecialPicker = ({
  disabled,
  initial,
  onConfirm,
  rules,
}: SpecialPickerProps) => {
  const [category, setCategory] = useState(
    initial && rules.categories.includes(initial) ? initial : null,
  )

  const handleConfirm = () => {
    if (category) onConfirm(category)
  }

  return (
    <fieldset className={styles.picker}>
      <legend className={styles.legend}>What makes it special?</legend>
      <div
        aria-label="Special category"
        className={styles.chips}
        role="radiogroup"
      >
        {rules.categories.map((option) => (
          <CategoryChip
            key={option}
            label={option}
            onSelect={setCategory}
            selected={option === category}
          />
        ))}
      </div>
      <Button disabled={disabled || !category} onClick={handleConfirm}>
        {specialLabel(rules, category)}
      </Button>
    </fieldset>
  )
}
