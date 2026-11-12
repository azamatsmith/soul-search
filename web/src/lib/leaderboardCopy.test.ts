import { describe, expect, it } from 'vitest'
import type { Leaderboard } from './api'
import { leaderboardKicker, rulesText } from './leaderboardCopy'

const NOW = Date.parse('2026-11-12T20:00:00Z')

const WEEK: Leaderboard = {
  ends_at: '2026-11-16T08:00:00Z',
  name: null,
  rows: [],
  scope: 'week',
  starts_at: '2026-11-09T08:00:00Z',
  total_players: 23,
}

describe('leaderboardKicker', () => {
  it('names the week, the players and the reset', () => {
    expect(leaderboardKicker(WEEK, NOW)).toBe(
      'Nov 9-15 · 23 players · Resets Monday',
    )
  })

  it('says since you joined for all time', () => {
    expect(
      leaderboardKicker(
        {
          ...WEEK,
          ends_at: null,
          scope: 'all',
          starts_at: null,
          total_players: 1,
        },
        NOW,
      ),
    ).toBe('Since you joined · 1 player')
  })
})

describe('leaderboardKicker for a challenge', () => {
  it('says when the challenge ends', () => {
    expect(
      leaderboardKicker(
        {
          ends_at: '2026-11-16T07:59:00Z',
          name: 'Brown Week',
          rows: [],
          scope: 'challenge',
          starts_at: '2026-11-12T17:00:00Z',
          total_players: 19,
        },
        NOW,
      ),
    ).toBe('Challenge · ends Sun 11:59 pm')
  })
})

describe('rulesText', () => {
  const WEEKLY = {
    categories: [{ name: 'Brown paint', points: 2 }],
    false_call: -1,
    regular: 1,
    special: 2,
  }

  it('lists the weekly rules with Special', () => {
    expect(rulesText(WEEKLY)).toBe(
      'Rules: Regular +1, Special +2, False call \u22121',
    )
  })

  it('lists challenge categories instead of Special', () => {
    const brownWeek = {
      categories: [{ name: 'Brown paint', points: 3 }],
      false_call: -1,
      regular: 1,
      special: null,
    }

    expect(rulesText(brownWeek)).toBe(
      'Rules: Regular +1, Brown paint +3, False call \u22121',
    )
  })
})
