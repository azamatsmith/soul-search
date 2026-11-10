import { useId } from 'react'
import type { Rules } from '../../lib/api'
import { claimPoints, sendLabel, type ClaimType } from '../../lib/claim'
import { Button } from '../Button'
import { CategoryChip } from './CategoryChip'
import { ClaimOption } from './ClaimOption'
import styles from './ClaimForm.module.css'
import { StepHeading } from './StepHeading'

export interface ClaimFormProps {
  category: string | null
  claimType: ClaimType | null
  onCategoryChange: (category: string) => void
  onClaimTypeChange: (claimType: ClaimType) => void
  onSend: () => void
  photoUrl: string
  rules: Rules
}

export const ClaimForm = ({
  category,
  claimType,
  onCategoryChange,
  onClaimTypeChange,
  onSend,
  photoUrl,
  rules,
}: ClaimFormProps) => {
  const legendId = useId()
  const points = claimPoints(rules, claimType, category)

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
            <legend className={styles.legend} id={legendId}>
              What makes it special?{' '}
              <span className={styles.hint}>Pick one</span>
            </legend>
            <div
              aria-labelledby={legendId}
              className={styles.chips}
              role="radiogroup"
            >
              {rules.categories.map((option) => (
                <CategoryChip
                  key={option}
                  label={option}
                  onSelect={onCategoryChange}
                  selected={option === category}
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
