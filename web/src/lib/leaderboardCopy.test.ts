import { describe, expect, it } from 'vitest'
import type { Leaderboard } from './api'
import { leaderboardKicker } from './leaderboardCopy'

const WEEK: Leaderboard = {
  ends_at: '2026-11-16T08:00:00Z',
  rows: [],
  scope: 'week',
  starts_at: '2026-11-09T08:00:00Z',
  total_players: 23,
}

describe('leaderboardKicker', () => {
  it('names the week, the players and the reset', () => {
    expect(leaderboardKicker(WEEK)).toBe(
      'Nov 9-15 · 23 players · Resets Monday',
    )
  })

  it('says since you joined for all time', () => {
    expect(
      leaderboardKicker({
        ...WEEK,
        ends_at: null,
        scope: 'all',
        starts_at: null,
        total_players: 1,
      }),
    ).toBe('Since you joined · 1 player')
  })
})
