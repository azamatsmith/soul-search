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

export const specialDescription = (categories: string[]) =>
  categories.length < 2
    ? (categories[0] ?? '')
    : `${categories.slice(0, -1).join(', ')} or ${categories.at(-1)}`

export const hasBrownCategory = (categories: string[]) =>
  categories.some((category) => category.toLowerCase().startsWith('brown'))

export const pointsText = (points: number) =>
  points < 0 ? `−${Math.abs(points)}` : `+${points}`
