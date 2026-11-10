import type { ReviewAction, ReviewItem, Rules } from './api'
import { claimPoints } from './claim'
import { cardKind, type LogCard } from './sightingsCopy'
import { signedPoints } from './signedPoints'

export interface ReviewChoice {
  action: ReviewAction
  hint: string
  label: string
  tone: 'danger' | 'plain' | 'primary'
}

const claimed = ({ categories, claim_type }: ReviewItem) =>
  claim_type === 'special'
    ? `Special Soul · ${categories.join(', ')}`
    : 'Regular Soul'

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
  ...(item.claim_type === 'special'
    ? [
        {
          action: 'regular',
          hint: "It's a Soul, but not special.",
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
  {
    action: 'special',
    hint: 'Pick what makes it special.',
    label: 'Restore as Special',
    tone: 'plain',
  },
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

export const specialLabel = (rules: Rules, category: string | null) => {
  const points = claimPoints(rules, 'special', category)
  return points === null
    ? 'Pick a category'
    : `Restore as Special · ${signedPoints(points)}`
}

export const claimedLine = (item: ReviewItem) =>
  item.claim_type === 'special'
    ? `Claimed: Special · ${item.categories.join(', ')}`
    : 'Claimed: Regular'

export const queueChip = (item: ReviewItem) =>
  item.status === 'false_call'
    ? `${signedPoints(item.points)} False call`
    : `Counting ${signedPoints(item.points)} for now`

export const reviewCard = (item: ReviewItem): LogCard => ({
  categories: item.categories,
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
