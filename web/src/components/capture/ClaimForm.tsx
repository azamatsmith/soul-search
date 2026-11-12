import { useId } from 'react'
import type { ClaimType, Rules } from '../../lib/api'
import {
  categoryNames,
  claimPoints,
  hasBrownCategory,
  sendLabel,
  specialDescription,
} from '../../lib/claim'
import { Button } from '../Button'
import { CategoryChip } from './CategoryChip'
import { ChallengeClaimOptions } from './ChallengeClaimOptions'
import { ClaimOption } from './ClaimOption'
import styles from './ClaimForm.module.css'
import { StepHeading } from './StepHeading'

export interface ClaimFormProps {
  category: string | null
  challengeName: string | null
  claimType: ClaimType | null
  onCategoryChange: (category: string) => void
  onClaimTypeChange: (claimType: ClaimType) => void
  onSend: () => void
  photoUrl: string
  rules: Rules
}

export const ClaimForm = ({
  category,
  challengeName,
  claimType,
  onCategoryChange,
  onClaimTypeChange,
  onSend,
  photoUrl,
  rules,
}: ClaimFormProps) => {
  const legendId = useId()
  const points = claimPoints(rules, claimType, category)
  const names = categoryNames(rules)

  const handleRegularPick = () => onClaimTypeChange('regular')
  const handleSpecialPick = () => onClaimTypeChange('special')
  const handleChallengeCategoryPick = (name: string) => {
    onClaimTypeChange('challenge')
    onCategoryChange(name)
  }

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
        {challengeName && (
          <p className={styles.counts}>Counts toward {challengeName}</p>
        )}
        {rules.special === null ? (
          <ChallengeClaimOptions
            category={category}
            challengeName={challengeName ?? 'the challenge'}
            claimType={claimType}
            onCategoryPick={handleChallengeCategoryPick}
            onRegularPick={handleRegularPick}
            rules={rules}
          />
        ) : (
          <>
            <div
              aria-label="Kind of Soul"
              className={styles.options}
              role="radiogroup"
            >
              <ClaimOption
                checked={claimType === 'regular'}
                description="Any color not listed below"
                label="Regular Soul"
                onSelect={handleRegularPick}
                points={rules.regular}
                tone="regular"
                value="regular"
              />
              <ClaimOption
                checked={claimType === 'special'}
                description={specialDescription(names)}
                label="Special Soul"
                onSelect={handleSpecialPick}
                points={rules.special}
                tone="special"
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
                  {names.map((option) => (
                    <CategoryChip
                      key={option}
                      label={option}
                      onSelect={onCategoryChange}
                      selected={option === category}
                    />
                  ))}
                </div>
                {hasBrownCategory(names) && (
                  <p className={styles.note}>
                    Brown means brown: champagne, pale gold and beige don't
                    count.
                  </p>
                )}
              </fieldset>
            )}
          </>
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
