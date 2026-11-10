import type { Rules } from './api'

export type ClaimType = 'regular' | 'special'

export const claimPoints = (
  rules: Rules,
  claimType: ClaimType | null,
  categories: string[],
): number | null => {
  if (claimType === 'regular') return rules.regular
  if (claimType !== 'special' || categories.length === 0) return null
  const bonuses = categories.map((category) => rules.bonuses[category] ?? 0)
  return Math.max(rules.special, ...bonuses)
}

export const sendLabel = (points: number | null) =>
  points === null
    ? 'Pick what makes it special'
    : `Send · +${points} ${points === 1 ? 'point' : 'points'}`
