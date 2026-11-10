import type { Rules } from './api'

export type ClaimType = 'regular' | 'special'

export const claimPoints = (
  rules: Rules,
  claimType: ClaimType | null,
  category: string | null,
): number | null => {
  if (claimType === 'regular') return rules.regular
  if (claimType !== 'special' || category === null) return null
  return Math.max(rules.special, rules.bonuses[category] ?? 0)
}

export const sendLabel = (points: number | null) =>
  points === null
    ? 'Pick what makes it special'
    : `Send for ${points} ${points === 1 ? 'point' : 'points'}`
