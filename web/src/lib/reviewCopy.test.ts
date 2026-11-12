import { describe, expect, it } from 'vitest'
import type { ReviewItem, Rules } from './api'
import {
  claimedLine,
  claimSummary,
  queueChip,
  reviewCard,
  reviewChoices,
  categoryLabel,
} from './reviewCopy'

const RULES: Rules = {
  categories: [
    { name: 'Alien Green', points: 2 },
    { name: 'Brown paint', points: 2 },
  ],
  false_call: -1,
  regular: 1,
  special: 2,
}

const BROWN_WEEK: Rules = {
  categories: [{ name: 'Brown paint', points: 3 }],
  false_call: -1,
  regular: 1,
  special: null,
}

const ITEM: ReviewItem = {
  categories: ['Alien Green'],
  check_note: 'Color looks closer to light blue.',
  claim_type: 'special',
  display_name: 'Leo M.',
  id: 's1',
  photo_url: null,
  points: 2,
  status: 'counted',
  taken_at: '2026-11-12T21:15:00Z',
  thumb_url: null,
  verification_notes: null,
}

const FALSE_CALL: ReviewItem = {
  ...ITEM,
  categories: [],
  claim_type: 'regular',
  points: -1,
  status: 'false_call',
}

describe('claimSummary', () => {
  it('describes a special claim with its points', () => {
    expect(claimSummary(ITEM)).toBe('Special Soul · Alien Green · +2')
  })

  it('describes a false call with the claim and the penalty', () => {
    expect(claimSummary(FALSE_CALL)).toBe('Regular Soul · now −1')
  })
})

describe('reviewChoices', () => {
  it('offers keep, regular and false call for a flagged special', () => {
    expect(reviewChoices(ITEM, RULES)).toEqual([
      {
        action: 'keep',
        hint: 'Clears the flag. The model was wrong.',
        label: 'Keep the claim · +2',
        tone: 'primary',
      },
      {
        action: 'regular',
        hint: "It's a Soul, but not special.",
        label: 'Change to Regular · +1',
        tone: 'plain',
      },
      {
        action: 'false_call',
        hint: 'Not a Kia Soul.',
        label: 'Mark as false call · −1',
        tone: 'danger',
      },
    ])
  })

  it('leaves out Change to Regular for a flagged regular', () => {
    const actions = reviewChoices(
      { ...ITEM, categories: [], claim_type: 'regular', points: 1 },
      RULES,
    ).map((choice) => choice.action)
    expect(actions).toEqual(['keep', 'false_call'])
  })

  it('offers restore and keep for a false call', () => {
    expect(reviewChoices(FALSE_CALL, RULES)).toEqual([
      {
        action: 'regular',
        hint: "It's a Kia Soul.",
        label: 'Restore as Regular · +1',
        tone: 'primary',
      },
      {
        action: 'category',
        hint: 'Pick what makes it special.',
        label: 'Restore as Special',
        tone: 'plain',
      },
      {
        action: 'keep',
        hint: "It isn't a Kia Soul.",
        label: 'Keep false call · −1',
        tone: 'danger',
      },
    ])
  })
})

describe('reviewChoices during a challenge', () => {
  it('restores with a challenge category instead of Special', () => {
    expect(reviewChoices(FALSE_CALL, BROWN_WEEK)[1]).toEqual({
      action: 'category',
      hint: 'Pick the challenge category.',
      label: 'Restore with a challenge category',
      tone: 'plain',
    })
  })

  it('offers no category restore when the challenge has none', () => {
    const actions = reviewChoices(FALSE_CALL, { ...BROWN_WEEK, categories: [] })

    expect(actions.map(({ action }) => action)).toEqual(['regular', 'keep'])
  })

  it('offers Regular for a flagged challenge claim', () => {
    const brown = {
      ...ITEM,
      categories: ['Brown paint'],
      claim_type: 'challenge' as const,
    }

    expect(reviewChoices(brown, BROWN_WEEK)[1]).toMatchObject({
      action: 'regular',
      hint: "It's a Soul, but not Brown paint.",
    })
    expect(claimedLine(brown)).toBe('Claimed: Brown paint')
    expect(claimSummary(brown)).toBe('Brown paint · +2')
  })
})

describe('categoryLabel', () => {
  it('asks for a category until one is picked', () => {
    expect(categoryLabel(RULES, null)).toBe('Pick a category')
  })

  it('restores as Special in a week', () => {
    expect(categoryLabel(RULES, 'Brown paint')).toBe('Restore as Special · +2')
  })

  it('restores as the challenge category during a challenge', () => {
    expect(categoryLabel(BROWN_WEEK, 'Brown paint')).toBe(
      'Restore as Brown paint · +3',
    )
  })
})

describe('queue card copy', () => {
  it('shows the claim and the points still counting', () => {
    expect(claimedLine(ITEM)).toBe('Claimed: Special · Alien Green')
    expect(queueChip(ITEM)).toBe('Counting +2 for now')
  })

  it('shows a false call penalty', () => {
    expect(claimedLine(FALSE_CALL)).toBe('Claimed: Regular')
    expect(queueChip(FALSE_CALL)).toBe('−1 False call')
  })
})

describe('reviewCard', () => {
  it('maps a flagged photo to a flagged viewer card', () => {
    expect(reviewCard(ITEM).kind).toBe('flagged')
    expect(reviewCard(FALSE_CALL).kind).toBe('false_call')
  })
})
