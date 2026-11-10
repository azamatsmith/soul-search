import { describe, expect, it } from 'vitest'
import type { PlayerScore, Scores } from './api'
import { periodKicker, pointsNow, saveLabel } from './adjustCopy'

const JOE: PlayerScore = { display_name: 'Grandpa Joe', id: 'p1', points: 8 }

const scores = (period: Scores['period']): Scores => ({ period, players: [] })

describe('adjustCopy', () => {
  it('names the week or the running challenge', () => {
    expect(periodKicker(scores({ kind: 'week', name: null }))).toBe('This week')
    expect(
      periodKicker(scores({ kind: 'challenge', name: 'Brown Week' })),
    ).toBe('Brown Week')
  })

  it('shows the points before and after the change', () => {
    expect(pointsNow(JOE, 3)).toBe('8 → 11')
    expect(pointsNow(JOE, -10)).toBe('8 → −2')
    expect(pointsNow(JOE, 0)).toBe('8')
  })

  it('names the player and change on the save button', () => {
    expect(saveLabel(JOE, 3)).toBe('Save (Grandpa Joe +3)')
    expect(saveLabel(JOE, -2)).toBe('Save (Grandpa Joe −2)')
    expect(saveLabel(JOE, 0)).toBe('Save')
    expect(saveLabel(null, 3)).toBe('Save')
  })
})
