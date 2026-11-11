import { useState } from 'react'
import { Stepper } from './Stepper'
import styles from './BonusEditor.module.css'

export interface BonusEditorProps {
  bonuses: Record<string, number>
  categories: string[]
  disabled?: boolean
  onChange: (bonuses: Record<string, number>) => void
  startingBonus: number
}

const MAX_BONUS = 10

export const BonusEditor = ({
  bonuses,
  categories,
  disabled = false,
  onChange,
  startingBonus,
}: BonusEditorProps) => {
  const [choosing, setChoosing] = useState(false)
  const available = categories.filter((category) => !(category in bonuses))

  const handleChooseClick = () => setChoosing(true)
  const addBonus = (category: string) => {
    onChange({ ...bonuses, [category]: Math.min(startingBonus, MAX_BONUS) })
    setChoosing(false)
  }
  const removeBonus = (category: string) => {
    onChange(
      Object.fromEntries(
        Object.entries(bonuses).filter(([name]) => name !== category),
      ),
    )
  }

  return (
    <div className={styles.editor}>
      {Object.entries(bonuses).map(([category, value]) => (
        <div className={styles.bonus} key={category}>
          <Stepper
            disabled={disabled}
            hint="Category bonus"
            label={category}
            max={MAX_BONUS}
            min={1}
            onChange={(next) => onChange({ ...bonuses, [category]: next })}
            value={value}
          />
          {!disabled && (
            <button
              aria-label={`Remove ${category} bonus`}
              className={styles.remove}
              onClick={() => removeBonus(category)}
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
          + Add a category bonus
        </button>
      )}
      {choosing && (
        <div className={styles.choices}>
          {available.map((category) => (
            <button
              className={styles.choice}
              key={category}
              onClick={() => addBonus(category)}
              type="button"
            >
              {category}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
