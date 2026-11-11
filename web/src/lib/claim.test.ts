import { describe, expect, it } from 'vitest'
import type { Rules } from './api'
import {
  claimPoints,
  hasBrownCategory,
  liveBonuses,
  pointsText,
  sendLabel,
  specialDescription,
} from './claim'

const RULES: Rules = {
  regular: 1,
  special: 2,
  false_call: -1,
  categories: ['Alien Green', 'Brown paint'],
  bonuses: { 'Brown paint': 3 },
}

describe('claimPoints', () => {
  it('is null until a valid claim is picked', () => {
    expect(claimPoints(RULES, null, null)).toBeNull()
    expect(claimPoints(RULES, 'special', null)).toBeNull()
  })

  it('scores regular and special claims', () => {
    expect(claimPoints(RULES, 'regular', null)).toBe(1)
    expect(claimPoints(RULES, 'special', 'Alien Green')).toBe(2)
  })

  it('uses the category bonus when it beats special points', () => {
    expect(claimPoints(RULES, 'special', 'Brown paint')).toBe(3)
  })
})

describe('sendLabel', () => {
  it('asks for a category until the claim is valid', () => {
    expect(sendLabel(null)).toBe('Pick what makes it special')
  })

  it('shows the points to be earned', () => {
    expect(sendLabel(1)).toBe('Send for 1 point')
    expect(sendLabel(3)).toBe('Send for 3 points')
  })
})

describe('specialDescription', () => {
  it('joins with commas and "or"', () => {
    expect(
      specialDescription([
        'Alien Green',
        'Racing stripes',
        'Exterior graphics',
        'Brown paint',
      ]),
    ).toBe('Alien Green, Racing stripes, Exterior graphics or Brown paint')
  })

  it('joins two with "or"', () => {
    expect(specialDescription(['Alien Green', 'Brown paint'])).toBe(
      'Alien Green or Brown paint',
    )
  })

  it('shows one as-is', () => {
    expect(specialDescription(['Brown paint'])).toBe('Brown paint')
  })

  it('is empty with none', () => {
    expect(specialDescription([])).toBe('')
  })
})

describe('hasBrownCategory', () => {
  it('finds a category starting with Brown', () => {
    expect(hasBrownCategory(['Alien Green', 'brown paint'])).toBe(true)
  })

  it('ignores Brown elsewhere in the name', () => {
    expect(hasBrownCategory(['Light brown'])).toBe(false)
  })
})

describe('pointsText', () => {
  it('signs positive points', () => {
    expect(pointsText(3)).toBe('+3')
  })

  it('uses a real minus sign', () => {
    expect(pointsText(-1)).toBe('\u22121')
  })
})

describe('liveBonuses', () => {
  it('keeps only bonuses worth more than a special Soul', () => {
    expect(
      liveBonuses({
        ...RULES,
        bonuses: { 'Alien Green': 2, 'Brown paint': 3, Graphics: 1 },
      }),
    ).toEqual({ 'Brown paint': 3 })
  })
})
