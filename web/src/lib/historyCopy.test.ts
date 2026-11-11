import { describe, expect, it } from 'vitest'
import type { HistoryEntry } from './api'
import { historyLine, historyTag, historyTime } from './historyCopy'

const entry = (changes: Partial<HistoryEntry>): HistoryEntry => ({
  admin: { display_name: 'Matthew', id: 'm' },
  after: null,
  before: null,
  created_at: '2026-11-13T00:45:00Z',
  id: 'e',
  reason: null,
  target_name: 'Leo M.',
  type: 'photo',
  ...changes,
})

const photo = (status: string, claimType: string, points: number) => ({
  categories: [],
  claim_type: claimType,
  flagged: false,
  points,
  status,
})

const RULES = {
  categories: ['Alien Green', 'Brown paint'],
  false_call: -1,
  regular: 1,
  special: 3,
}

describe('historyLine', () => {
  it('describes a score adjustment with its reason', () => {
    const line = historyLine(
      entry({
        after: { change: 3, points: 11 },
        reason: 'Photos failed to upload at the rest stop',
        target_name: 'Grandpa Joe',
        type: 'score',
      }),
    )
    expect(line).toBe(
      'gave Grandpa Joe +3. “Photos failed to upload at the rest stop.”',
    )
  })

  it('keeps the reason punctuation and shows taken points', () => {
    const line = historyLine(
      entry({
        after: { change: -2, points: 4 },
        reason: 'Duplicates!',
        type: 'score',
      }),
    )
    expect(line).toBe('gave Leo M. −2. “Duplicates!”')
  })

  it('describes a kept claim that cleared the flag', () => {
    const line = historyLine(
      entry({
        after: photo('counted', 'special', 2),
        before: { ...photo('counted', 'special', 2), flagged: true },
      }),
    )
    expect(line).toBe("kept Leo M.'s Special claim (+2) and cleared the flag.")
  })

  it('describes a changed claim', () => {
    const line = historyLine(
      entry({
        after: photo('counted', 'regular', 1),
        before: { ...photo('counted', 'special', 2), flagged: true },
      }),
    )
    expect(line).toBe(
      "changed Leo M.'s photo from Special (+2) to Regular (+1).",
    )
  })

  it('describes a photo marked as a false call', () => {
    const line = historyLine(
      entry({
        after: photo('false_call', 'special', -1),
        before: { ...photo('counted', 'special', 2), flagged: true },
      }),
    )
    expect(line).toBe("marked Leo M.'s photo as a false call (−1).")
  })

  it('describes a restored false call', () => {
    const line = historyLine(
      entry({
        after: photo('counted', 'special', 2),
        before: photo('false_call', 'special', -1),
      }),
    )
    expect(line).toBe("restored Leo M.'s photo as Special (+2).")
  })

  it('describes a kept false call', () => {
    const line = historyLine(
      entry({
        after: photo('false_call', 'regular', -1),
        before: photo('false_call', 'regular', -1),
      }),
    )
    expect(line).toBe("kept Leo M.'s false call (−1).")
  })

  it('names a missing player generically', () => {
    const line = historyLine(
      entry({
        after: photo('false_call', 'regular', -1),
        before: photo('false_call', 'regular', -1),
        target_name: null,
      }),
    )
    expect(line).toBe("kept a player's false call (−1).")
  })

  it('describes added and removed emails', () => {
    expect(
      historyLine(
        entry({ after: { email: 'nora.l@example.com' }, type: 'emails' }),
      ),
    ).toBe('added nora.l@example.com to the allowed emails.')
    expect(
      historyLine(
        entry({ before: { email: 'nora.l@example.com' }, type: 'emails' }),
      ),
    ).toBe('removed nora.l@example.com from the allowed emails.')
  })

  it('describes a point change', () => {
    const line = historyLine(
      entry({ after: { ...RULES, special: 2 }, before: RULES, type: 'rules' }),
    )
    expect(line).toBe('changed the Special points from +3 to +2.')
  })

  it('joins several rule changes', () => {
    const line = historyLine(
      entry({
        after: {
          ...RULES,
          categories: ['Alien Green', 'Racing stripes'],
          false_call: -2,
        },
        before: RULES,
        type: 'rules',
      }),
    )
    expect(line).toBe(
      'changed the False call points from −1 to −2, added the category “Racing stripes” and removed the category “Brown paint”.',
    )
  })

  it('describes rules saved without changes', () => {
    const line = historyLine(
      entry({ after: RULES, before: RULES, type: 'rules' }),
    )
    expect(line).toBe('saved the points and categories with no changes.')
  })

  it('describes a challenge change', () => {
    expect(historyLine(entry({ type: 'challenge' }))).toBe(
      'changed a challenge.',
    )
  })
})

describe('historyTag', () => {
  it('labels each type', () => {
    expect(historyTag('photo')).toBe('Photo')
    expect(historyTag('score')).toBe('Score')
    expect(historyTag('emails')).toBe('Emails')
    expect(historyTag('rules')).toBe('Rules')
    expect(historyTag('challenge')).toBe('Challenge')
  })
})

describe('historyTime', () => {
  const THU_EVENING = Date.parse('2026-11-13T04:00:00Z')

  it('shows today, the weekday this week, then the date', () => {
    expect(historyTime('2026-11-13T00:45:00Z', THU_EVENING)).toBe(
      'Today 4:45 PM',
    )
    expect(historyTime('2026-11-12T05:30:00Z', THU_EVENING)).toBe('Wed 9:30 PM')
    expect(historyTime('2026-11-07T05:30:00Z', THU_EVENING)).toBe('Fri 9:30 PM')
    expect(historyTime('2026-11-06T05:30:00Z', THU_EVENING)).toBe(
      'Nov 5 9:30 PM',
    )
  })
})
