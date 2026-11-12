import type { ReviewAction, ReviewItem, Rules } from './api'
import { categoryClaim, claimPoints, isChallengeRules } from './claim'
import { cardKind, type LogCard } from './sightingsCopy'
import { signedPoints } from './signedPoints'

export interface ReviewChoice {
  action: ReviewAction
  hint: string
  label: string
  tone: 'danger' | 'plain' | 'primary'
}

const claimed = ({ categories, claim_type }: ReviewItem) => {
  if (claim_type === 'challenge') return categories.join(', ')
  return claim_type === 'special'
    ? `Special Soul · ${categories.join(', ')}`
    : 'Regular Soul'
}

export const claimSummary = (item: ReviewItem) =>
  item.status === 'false_call'
    ? `${claimed(item)} · now ${signedPoints(item.points)}`
    : `${claimed(item)} · ${signedPoints(item.points)}`

const flaggedChoices = (item: ReviewItem, rules: Rules): ReviewChoice[] => [
  {
    action: 'keep',
    hint: 'Clears the flag. The model was wrong.',
    label: `Keep the claim · ${signedPoints(item.points)}`,
    tone: 'primary',
  },
  ...(item.claim_type !== 'regular'
    ? [
        {
          action: 'regular',
          hint:
            item.claim_type === 'challenge'
              ? `It's a Soul, but not ${item.categories.join(', ')}.`
              : "It's a Soul, but not special.",
          label: `Change to Regular · ${signedPoints(rules.regular)}`,
          tone: 'plain',
        } as const,
      ]
    : []),
  {
    action: 'false_call',
    hint: 'Not a Kia Soul.',
    label: `Mark as false call · ${signedPoints(rules.false_call)}`,
    tone: 'danger',
  },
]

const falseCallChoices = (item: ReviewItem, rules: Rules): ReviewChoice[] => [
  {
    action: 'regular',
    hint: "It's a Kia Soul.",
    label: `Restore as Regular · ${signedPoints(rules.regular)}`,
    tone: 'primary',
  },
  ...(rules.categories.length > 0
    ? [
        {
          action: 'category',
          hint: isChallengeRules(rules)
            ? 'Pick the challenge category.'
            : 'Pick what makes it special.',
          label: isChallengeRules(rules)
            ? 'Restore with a challenge category'
            : 'Restore as Special',
          tone: 'plain',
        } as const,
      ]
    : []),
  {
    action: 'keep',
    hint: "It isn't a Kia Soul.",
    label: `Keep false call · ${signedPoints(item.points)}`,
    tone: 'danger',
  },
]

export const reviewChoices = (item: ReviewItem, rules: Rules) =>
  item.status === 'false_call'
    ? falseCallChoices(item, rules)
    : flaggedChoices(item, rules)

export const categoryLabel = (rules: Rules, category: string | null) => {
  const points = claimPoints(rules, categoryClaim(rules), category)
  if (points === null || category === null) return 'Pick a category'
  const name = isChallengeRules(rules) ? category : 'Special'
  return `Restore as ${name} · ${signedPoints(points)}`
}

export const claimedLine = (item: ReviewItem) => {
  if (item.claim_type === 'challenge') {
    return `Claimed: ${item.categories.join(', ')}`
  }
  return item.claim_type === 'special'
    ? `Claimed: Special · ${item.categories.join(', ')}`
    : 'Claimed: Regular'
}

export const queueChip = (item: ReviewItem) =>
  item.status === 'false_call'
    ? `${signedPoints(item.points)} False call`
    : `Counting ${signedPoints(item.points)} for now`

export const reviewCard = (item: ReviewItem): LogCard => ({
  categories: item.categories,
  challengeName: null,
  checkNote: item.check_note,
  claimType: item.claim_type,
  fullPhotoUrl: item.photo_url,
  id: item.id,
  kind: cardKind({
    claim_type: item.claim_type,
    flagged: item.status !== 'false_call',
    status: item.status,
  }),
  name: item.display_name,
  photoUrl: item.thumb_url,
  points: item.points,
  takenAt: item.taken_at,
})
