import { describe, expect, it } from 'vitest'
import {
  behindText,
  ordinal,
  pointsIntro,
  soulCountText,
  weekRange,
} from './homeCopy'

describe('weekRange', () => {
  it('shows the Pacific Monday to Sunday', () => {
    expect(weekRange('2026-11-09T08:00:00Z', '2026-11-16T08:00:00Z')).toBe(
      'Nov 9-15',
    )
  })

  it('names both months when the week crosses one', () => {
    expect(weekRange('2026-11-30T08:00:00Z', '2026-12-07T08:00:00Z')).toBe(
      'Nov 30-Dec 6',
    )
  })
})

describe('ordinal', () => {
  it.each([
    [1, '1st'],
    [2, '2nd'],
    [3, '3rd'],
    [4, '4th'],
    [11, '11th'],
    [12, '12th'],
    [13, '13th'],
    [21, '21st'],
    [22, '22nd'],
    [103, '103rd'],
  ])('%i is %s', (n, text) => {
    expect(ordinal(n)).toBe(text)
  })
})

describe('soulCountText', () => {
  it('counts Souls this week', () => {
    expect(soulCountText(3, null)).toBe('3 Souls this week')
    expect(soulCountText(1, null)).toBe('1 Soul this week')
  })

  it('names a running challenge', () => {
    expect(soulCountText(2, 'Brown Week')).toBe('2 Souls in Brown Week')
  })
})

describe('behindText', () => {
  it('says how far behind the next place', () => {
    expect(behindText(4, 3, 2)).toBe('2 pts behind 3rd place')
    expect(behindText(2, 1, 1)).toBe('1 pt behind 1st place')
  })

  it('says when you lead', () => {
    expect(behindText(1, null, null)).toBe("You're in 1st place")
  })
})

describe('pointsIntro', () => {
  it('uses the current point values', () => {
    expect(pointsIntro({ regular: 1, special: 2 })).toBe(
      'Regular Souls are +1, special ones +2.',
    )
    expect(pointsIntro({ regular: 2, special: 5 })).toBe(
      'Regular Souls are +2, special ones +5.',
    )
  })
})
