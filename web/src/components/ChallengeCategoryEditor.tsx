import { useState } from 'react'
import type { CategoryPoints } from '../lib/api'
import { Stepper } from './Stepper'
import styles from './ChallengeCategoryEditor.module.css'

export interface ChallengeCategoryEditorProps {
  categories: CategoryPoints[]
  disabled?: boolean
  onChange: (categories: CategoryPoints[]) => void
  options: string[]
  startingPoints: number
}

const MAX_POINTS = 10

export const ChallengeCategoryEditor = ({
  categories,
  disabled = false,
  onChange,
  options,
  startingPoints,
}: ChallengeCategoryEditorProps) => {
  const [choosing, setChoosing] = useState(false)
  const taken = new Set(categories.map(({ name }) => name))
  const available = options.filter((option) => !taken.has(option))

  const handleChooseClick = () => setChoosing(true)
  const addCategory = (name: string) => {
    onChange([
      ...categories,
      { name, points: Math.min(startingPoints, MAX_POINTS) },
    ])
    setChoosing(false)
  }
  const changePoints = (name: string, points: number) => {
    onChange(
      categories.map((category) =>
        category.name === name ? { name, points } : category,
      ),
    )
  }
  const removeCategory = (name: string) => {
    onChange(categories.filter((category) => category.name !== name))
  }

  return (
    <div className={styles.editor}>
      {categories.map(({ name, points }) => (
        <div className={styles.category} key={name}>
          <Stepper
            disabled={disabled}
            hint="Challenge category"
            label={name}
            max={MAX_POINTS}
            min={1}
            onChange={(next) => changePoints(name, next)}
            value={points}
          />
          {!disabled && (
            <button
              aria-label={`Remove ${name}`}
              className={styles.remove}
              onClick={() => removeCategory(name)}
              type="button"
            >
              Remove
            </button>
          )}
        </div>
      ))}
      {!disabled && available.length > 0 && !choosing && (
        <button
          className={styles.add}
          onClick={handleChooseClick}
          type="button"
        >
          + Add a challenge category
        </button>
      )}
      {choosing && (
        <div className={styles.choices}>
          {available.map((option) => (
            <button
              className={styles.choice}
              key={option}
              onClick={() => addCategory(option)}
              type="button"
            >
              {option}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
