import { describe, expect, it } from 'vitest'
import type { Period } from './api'
import { bannerBody, bannerTitle, bonusText } from './bannerCopy'

const NOW = Date.parse('2026-11-12T20:00:00Z')

const challenge = (
  endsAt: string,
  bonuses: Record<string, number>,
): Period => ({
  ends_at: endsAt,
  id: 'c1',
  kind: 'challenge',
  name: 'Brown Week',
  rules: { bonuses, categories: [], false_call: -1, regular: 1, special: 2 },
  starts_at: '2026-11-09T08:00:00Z',
})

describe('bonusText', () => {
  it('is null with no bonuses', () => {
    expect(bonusText({})).toBeNull()
  })

  it('names one bonus', () => {
    expect(bonusText({ 'Brown paint': 3 })).toBe('Brown paint is worth +3.')
  })

  it('joins two, highest first', () => {
    expect(bonusText({ 'Alien Green': 4, 'Brown paint': 3 })).toBe(
      'Alien Green is worth +4 and Brown paint +3.',
    )
  })

  it('lists three with commas and "and"', () => {
    expect(bonusText({ A: 2, B: 2, C: 5 })).toBe(
      'C is worth +5, A +2 and B +2.',
    )
  })

  it('ignores key order', () => {
    expect(bonusText({ B: 2, C: 5, A: 2 })).toBe(
      'C is worth +5, A +2 and B +2.',
    )
  })

  it('keeps the sign on +1', () => {
    expect(bonusText({ X: 1 })).toBe('X is worth +1.')
  })
})

describe('bannerTitle', () => {
  it('says the challenge is on', () => {
    expect(bannerTitle('Brown Week')).toBe('Brown Week is on')
  })
})

describe('bannerBody', () => {
  it('uses the long version when the end is on a later day', () => {
    expect(
      bannerBody(challenge('2026-11-16T07:59:00Z', { 'Brown paint': 3 }), NOW),
    ).toBe(
      'Brown paint is worth +3. Photos count toward the challenge until Sun 11:59 pm. Weekly scores pick up again after that.',
    )
  })

  it('uses the short version when it ends today', () => {
    expect(
      bannerBody(challenge('2026-11-13T02:00:00Z', { 'Alien Green': 3 }), NOW),
    ).toBe(
      'Alien Green is worth +3 until 6:00 pm today. After that, photos count toward your week again.',
    )
  })

  it('uses the short version without bonuses', () => {
    expect(bannerBody(challenge('2026-11-13T02:00:00Z', {}), NOW)).toBe(
      'Photos count toward the challenge until 6:00 pm today. After that, photos count toward your week again.',
    )
  })

  it('uses the long version without bonuses', () => {
    expect(bannerBody(challenge('2026-11-16T07:59:00Z', {}), NOW)).toBe(
      'Photos count toward the challenge until Sun 11:59 pm. Weekly scores pick up again after that.',
    )
  })

  it('treats midnight as the next day', () => {
    expect(bannerBody(challenge('2026-11-13T08:00:00Z', {}), NOW)).toBe(
      'Photos count toward the challenge until Fri 12:00 am. Weekly scores pick up again after that.',
    )
  })
})
