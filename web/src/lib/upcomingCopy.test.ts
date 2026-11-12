import { describe, expect, it } from 'vitest'
import {
  howSoonText,
  reminderText,
  upcomingRangeText,
  upcomingRulesText,
} from './upcomingCopy'

const NOW = Date.parse('2026-11-12T20:00:00Z')

describe('howSoonText', () => {
  it.each([
    ['2026-11-13T07:00:00Z', 'Today'],
    ['2026-11-13T08:00:00Z', 'Tomorrow'],
    ['2026-11-15T22:00:00Z', 'In 3 days'],
    ['2026-11-18T22:00:00Z', 'In 6 days'],
    ['2026-11-19T22:00:00Z', 'In 1 week'],
    ['2026-11-22T22:00:00Z', 'In 1 week'],
    ['2026-11-23T22:00:00Z', 'In 2 weeks'],
    ['2026-11-26T22:00:00Z', 'In 2 weeks'],
    ['2026-11-30T08:00:00Z', 'In 3 weeks'],
  ])('counts Pacific calendar days to %s', (start, text) => {
    expect(howSoonText(start, NOW)).toBe(text)
  })
})

describe('upcomingRangeText', () => {
  it('shows the day and both times for a same-day challenge', () => {
    expect(
      upcomingRangeText('2026-11-26T22:00:00Z', '2026-11-27T02:00:00Z'),
    ).toBe('Thu Nov 26, 2:00 – 6:00 pm')
  })

  it('shows only the first and last day for a multi-day challenge', () => {
    expect(
      upcomingRangeText('2026-11-30T08:00:00Z', '2026-12-07T08:00:00Z'),
    ).toBe('Mon Nov 30 – Sun Dec 6')
  })
})

describe('upcomingRulesText', () => {
  it('lists regular points then each challenge category', () => {
    expect(
      upcomingRulesText({
        categories: [
          { name: 'Alien Green', points: 3 },
          { name: 'Brown paint', points: 2 },
        ],
        false_call: -1,
        regular: 1,
      }),
    ).toBe('Regular +1, Alien Green +3, Brown paint +2')
  })

  it('shows just regular points when there are no categories', () => {
    expect(
      upcomingRulesText({ categories: [], false_call: -1, regular: 2 }),
    ).toBe('Regular +2')
  })
})

describe('reminderText', () => {
  it('names how long the challenge runs', () => {
    expect(reminderText('2026-11-26T22:00:00Z', '2026-11-27T02:00:00Z')).toBe(
      'For those 4 hours, new photos count toward the challenge instead of your week.',
    )
  })
})
