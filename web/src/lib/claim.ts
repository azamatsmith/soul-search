import type { CategoryPoints, ClaimType, Rules } from './api'

const DESCRIPTIONS: Record<string, string> = {
  'alien green': 'Solid Alien Green paint.',
  'brown paint':
    "Solid brown paint. Champagne, pale gold and beige don't count.",
  'exterior graphics': 'Graphics on any color.',
  'racing stripes': 'Racing stripes on any color.',
}

export const isChallengeRules = (rules: Rules) => rules.special === null

export const categoryClaim = (rules: Rules): ClaimType =>
  isChallengeRules(rules) ? 'challenge' : 'special'

export const categoryNames = (rules: Rules) =>
  rules.categories.map((category) => category.name)

export const claimPoints = (
  rules: Rules,
  claimType: ClaimType | null,
  category: string | null,
): number | null => {
  if (claimType === 'regular') return rules.regular
  if (claimType !== categoryClaim(rules) || category === null) return null
  return rules.categories.find(({ name }) => name === category)?.points ?? null
}

export const sendLabel = (points: number | null) =>
  points === null
    ? 'Pick what makes it special'
    : `Send for ${points} ${points === 1 ? 'point' : 'points'}`

export const specialDescription = (categories: string[]) =>
  categories.length < 2
    ? (categories[0] ?? '')
    : `${categories.slice(0, -1).join(', ')} or ${categories.at(-1)}`

export const categoryDescription = (category: string) =>
  DESCRIPTIONS[category.toLowerCase()] ?? ''

export const hasBrownCategory = (categories: string[]) =>
  categories.some((category) => category.toLowerCase().startsWith('brown'))

export const pointsText = (points: number) =>
  points < 0 ? `−${Math.abs(points)}` : `+${points}`

export const sortedCategories = (categories: CategoryPoints[]) =>
  [...categories].sort(
    (a, b) => b.points - a.points || a.name.localeCompare(b.name),
  )
