import type { PointRules } from './api'
import { signedPoints } from './signedPoints'

export const rulesSummary = (rules: PointRules) => {
  const points = [rules.regular, rules.special, rules.false_call]
    .map(signedPoints)
    .join(', ')
  const count = rules.categories.length
  return `${points}, ${count} ${count === 1 ? 'category' : 'categories'}`
}
