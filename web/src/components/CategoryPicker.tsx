import { useState } from 'react'
import type { Rules } from '../lib/api'
import { categoryNames, isChallengeRules } from '../lib/claim'
import { categoryLabel } from '../lib/reviewCopy'
import { Button } from './Button'
import { CategoryChip } from './capture/CategoryChip'
import styles from './CategoryPicker.module.css'

export interface CategoryPickerProps {
  disabled: boolean
  initial: string | null
  onConfirm: (category: string) => void
  rules: Rules
}

export const CategoryPicker = ({
  disabled,
  initial,
  onConfirm,
  rules,
}: CategoryPickerProps) => {
  const names = categoryNames(rules)
  const [category, setCategory] = useState(
    initial && names.includes(initial) ? initial : null,
  )

  const handleConfirm = () => {
    if (category) onConfirm(category)
  }

  return (
    <fieldset className={styles.picker}>
      <legend className={styles.legend}>
        {isChallengeRules(rules)
          ? 'Which challenge category?'
          : 'What makes it special?'}
      </legend>
      <div aria-label="Category" className={styles.chips} role="radiogroup">
        {names.map((option) => (
          <CategoryChip
            key={option}
            label={option}
            onSelect={setCategory}
            selected={option === category}
          />
        ))}
      </div>
      <Button disabled={disabled || !category} onClick={handleConfirm}>
        {categoryLabel(rules, category)}
      </Button>
    </fieldset>
  )
}
