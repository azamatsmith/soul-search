import { describe, expect, it } from 'vitest'
import type { Rules } from './api'
import { claimPoints, sendLabel } from './claim'

const RULES: Rules = {
  regular: 1,
  special: 2,
  false_call: -1,
  categories: ['Alien Green', 'Brown paint'],
  bonuses: { 'Brown paint': 3 },
}

describe('claimPoints', () => {
  it('is null until a valid claim is picked', () => {
    expect(claimPoints(RULES, null, [])).toBeNull()
    expect(claimPoints(RULES, 'special', [])).toBeNull()
  })

  it('scores regular and special claims', () => {
    expect(claimPoints(RULES, 'regular', [])).toBe(1)
    expect(claimPoints(RULES, 'special', ['Alien Green'])).toBe(2)
  })

  it('uses the highest category bonus', () => {
    expect(claimPoints(RULES, 'special', ['Alien Green', 'Brown paint'])).toBe(
      3,
    )
  })
})

describe('sendLabel', () => {
  it('asks for a category until the claim is valid', () => {
    expect(sendLabel(null)).toBe('Pick what makes it special')
  })

  it('shows the points to be earned', () => {
    expect(sendLabel(1)).toBe('Send · +1 point')
    expect(sendLabel(3)).toBe('Send · +3 points')
  })
})
