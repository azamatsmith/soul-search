import { describe, expect, it } from 'vitest'
import type { Period } from './api'
import { noteBody, noteTitle } from './noteCopy'

const NOW = Date.parse('2026-11-12T20:00:00Z')

const challenge = (endsAt: string, points: Record<string, number>): Period => ({
  ends_at: endsAt,
  id: 'c1',
  kind: 'challenge',
  name: 'Brown Week',
  rules: {
    categories: Object.entries(points).map(([name, value]) => ({
      name,
      points: value,
    })),
    false_call: -1,
    regular: 1,
    special: null,
  },
  starts_at: '2026-11-09T08:00:00Z',
})

describe('noteTitle', () => {
  it('says the challenge is on', () => {
    expect(noteTitle('Brown Week')).toBe('Brown Week is on')
  })
})

describe('noteBody', () => {
  it('uses the long version when the end is on a later day', () => {
    expect(
      noteBody(challenge('2026-11-16T07:59:00Z', { 'Brown paint': 3 }), NOW),
    ).toBe(
      'Brown paint is worth +3. Photos count toward the challenge until Sun 11:59 pm. Weekly scores pick up again after that.',
    )
  })

  it('uses the short version when it ends today', () => {
    expect(
      noteBody(challenge('2026-11-13T02:00:00Z', { 'Alien Green': 3 }), NOW),
    ).toBe(
      'Alien Green is worth +3 until 6:00 pm today. After that, photos count toward your week again.',
    )
  })

  it('uses the short version without categories', () => {
    expect(noteBody(challenge('2026-11-13T02:00:00Z', {}), NOW)).toBe(
      'Photos count toward the challenge until 6:00 pm today. After that, photos count toward your week again.',
    )
  })

  it('uses the long version without categories', () => {
    expect(noteBody(challenge('2026-11-16T07:59:00Z', {}), NOW)).toBe(
      'Photos count toward the challenge until Sun 11:59 pm. Weekly scores pick up again after that.',
    )
  })

  it('names every category, highest first', () => {
    expect(
      noteBody(challenge('2026-11-16T07:59:00Z', { A: 2, B: 2, C: 5 }), NOW),
    ).toBe(
      'C is worth +5, A +2 and B +2. Photos count toward the challenge until Sun 11:59 pm. Weekly scores pick up again after that.',
    )
  })

  it('treats midnight as the next day', () => {
    expect(noteBody(challenge('2026-11-13T08:00:00Z', {}), NOW)).toBe(
      'Photos count toward the challenge until Fri 12:00 am. Weekly scores pick up again after that.',
    )
  })
})
