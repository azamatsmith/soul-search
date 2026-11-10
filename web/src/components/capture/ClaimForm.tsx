import type { Rules } from '../../lib/api'
import { claimPoints, sendLabel, type ClaimType } from '../../lib/claim'
import { Button } from '../Button'
import { CategoryChip } from './CategoryChip'
import { ClaimOption } from './ClaimOption'
import styles from './ClaimForm.module.css'
import { StepHeading } from './StepHeading'

export interface ClaimFormProps {
  categories: string[]
  claimType: ClaimType | null
  onCategoryToggle: (category: string) => void
  onClaimTypeChange: (claimType: ClaimType) => void
  onSend: () => void
  photoUrl: string
  rules: Rules
}

export const ClaimForm = ({
  categories,
  claimType,
  onCategoryToggle,
  onClaimTypeChange,
  onSend,
  photoUrl,
  rules,
}: ClaimFormProps) => {
  const points = claimPoints(rules, claimType, categories)

  return (
    <main className={styles.screen}>
      <div className={styles.body}>
        <div className={styles.header}>
          <img alt="" className={styles.thumb} src={photoUrl} />
          <StepHeading
            size="h2"
            step="Step 2 of 2"
            title="What did you find?"
          />
        </div>
        <div
          aria-label="Kind of Soul"
          className={styles.options}
          role="radiogroup"
        >
          <ClaimOption
            checked={claimType === 'regular'}
            description="Any color not listed below"
            label="Regular Soul"
            onChange={onClaimTypeChange}
            points={rules.regular}
            value="regular"
          />
          <ClaimOption
            checked={claimType === 'special'}
            description="Alien Green, racing stripes, graphics or brown"
            label="Special Soul"
            onChange={onClaimTypeChange}
            points={rules.special}
            value="special"
          />
        </div>
        {claimType === 'special' && (
          <fieldset className={styles.categories}>
            <legend className={styles.legend}>
              What makes it special?{' '}
              <span className={styles.any}>Pick any</span>
            </legend>
            <div className={styles.chips}>
              {rules.categories.map((category) => (
                <CategoryChip
                  key={category}
                  label={category}
                  onToggle={onCategoryToggle}
                  selected={categories.includes(category)}
                />
              ))}
            </div>
            <p className={styles.note}>
              Brown means brown: champagne, pale gold and beige don't count.
            </p>
          </fieldset>
        )}
      </div>
      <footer className={styles.footer}>
        <Button disabled={points === null} onClick={onSend}>
          {sendLabel(points)}
        </Button>
        <p className={styles.footnote}>
          Not a Soul after all? Wrong calls cost {Math.abs(rules.false_call)}{' '}
          {Math.abs(rules.false_call) === 1 ? 'point' : 'points'}.
        </p>
      </footer>
    </main>
  )
}
