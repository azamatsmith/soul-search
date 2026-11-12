import type { ClaimType, Rules } from '../../lib/api'
import { categoryDescription, categoryNames } from '../../lib/claim'
import styles from './ChallengeClaimOptions.module.css'
import { ClaimOption } from './ClaimOption'

export interface ChallengeClaimOptionsProps {
  category: string | null
  challengeName: string
  claimType: ClaimType | null
  onCategoryPick: (category: string) => void
  onRegularPick: () => void
  rules: Rules
}

const listText = (items: string[]) =>
  items.length < 2
    ? (items[0] ?? '')
    : `${items.slice(0, -1).join(', ')} or ${items.at(-1)}`

export const ChallengeClaimOptions = ({
  category,
  challengeName,
  claimType,
  onCategoryPick,
  onRegularPick,
  rules,
}: ChallengeClaimOptionsProps) => {
  const names = categoryNames(rules)

  return (
    <>
      <div
        aria-label="Kind of Soul"
        className={styles.options}
        role="radiogroup"
      >
        <ClaimOption
          checked={claimType === 'regular'}
          description="Any other Kia Soul"
          label="Regular Soul"
          onSelect={onRegularPick}
          points={rules.regular}
          tone="regular"
          value="regular"
        />
        {rules.categories.map(({ name, points }) => (
          <ClaimOption
            checked={claimType === 'challenge' && category === name}
            description={categoryDescription(name)}
            key={name}
            label={name}
            onSelect={() => onCategoryPick(name)}
            points={points}
            tone="challenge"
            value={name}
          />
        ))}
      </div>
      {names.length > 0 && (
        <p className={styles.note}>
          During {challengeName} only {listText(names)} Souls earn extra. Every
          other Soul is Regular.
        </p>
      )}
    </>
  )
}
