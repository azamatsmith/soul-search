import type { ChallengeRules, PointRules } from '../lib/api'
import { signedPoints } from '../lib/signedPoints'
import { Stepper } from './Stepper'

export interface ChallengeRuleSteppersProps {
  disabled: boolean
  onChange: (rules: ChallengeRules) => void
  rules: ChallengeRules
  weekly: PointRules
}

const weeklyHint = (points: number) => `Weekly rule: ${signedPoints(points)}`

export const ChallengeRuleSteppers = ({
  disabled,
  onChange,
  rules,
  weekly,
}: ChallengeRuleSteppersProps) => {
  const handleRegularChange = (regular: number) =>
    onChange({ ...rules, regular })
  const handleSpecialChange = (special: number) =>
    onChange({ ...rules, special })
  const handleFalseCallChange = (false_call: number) =>
    onChange({ ...rules, false_call })

  return (
    <>
      <Stepper
        disabled={disabled}
        hint={weeklyHint(weekly.regular)}
        label="Regular Soul"
        max={10}
        min={1}
        onChange={handleRegularChange}
        value={rules.regular}
      />
      <Stepper
        disabled={disabled}
        hint={weeklyHint(weekly.special)}
        label="Special Soul"
        max={10}
        min={1}
        onChange={handleSpecialChange}
        value={rules.special}
      />
      <Stepper
        disabled={disabled}
        hint={weeklyHint(weekly.false_call)}
        label="False call"
        max={0}
        min={-10}
        onChange={handleFalseCallChange}
        value={rules.false_call}
      />
    </>
  )
}
