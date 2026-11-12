import { describe, expect, it } from 'vitest'
import type { Rules } from './api'
import {
  categoryClaim,
  categoryDescription,
  claimPoints,
  hasBrownCategory,
  pointsText,
  sendLabel,
  sortedCategories,
  specialDescription,
} from './claim'

const RULES: Rules = {
  categories: [
    { name: 'Alien Green', points: 2 },
    { name: 'Brown paint', points: 2 },
  ],
  false_call: -1,
  regular: 1,
  special: 2,
}

const BROWN_WEEK: Rules = {
  categories: [{ name: 'Brown paint', points: 3 }],
  false_call: -1,
  regular: 1,
  special: null,
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

  it('scores a challenge category with its own points', () => {
    expect(claimPoints(BROWN_WEEK, 'challenge', 'Brown paint')).toBe(3)
    expect(claimPoints(BROWN_WEEK, 'regular', null)).toBe(1)
  })

  it('is null for a claim the period does not allow', () => {
    expect(claimPoints(BROWN_WEEK, 'special', 'Brown paint')).toBeNull()
    expect(claimPoints(RULES, 'challenge', 'Brown paint')).toBeNull()
    expect(claimPoints(BROWN_WEEK, 'challenge', 'Alien Green')).toBeNull()
  })
})

describe('categoryClaim', () => {
  it('is special in a week and challenge during a challenge', () => {
    expect(categoryClaim(RULES)).toBe('special')
    expect(categoryClaim(BROWN_WEEK)).toBe('challenge')
  })
})

describe('categoryDescription', () => {
  it('describes known categories, ignoring case', () => {
    expect(categoryDescription('brown paint')).toBe(
      "Solid brown paint. Champagne, pale gold and beige don't count.",
    )
  })

  it('is empty for other categories', () => {
    expect(categoryDescription('Fins')).toBe('')
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

describe('sortedCategories', () => {
  it('lists categories highest first, then by name', () => {
    expect(
      sortedCategories([
        { name: 'A', points: 2 },
        { name: 'D', points: 3 },
        { name: 'C', points: 5 },
        { name: 'B', points: 3 },
      ]).map(({ name }) => name),
    ).toEqual(['C', 'B', 'D', 'A'])
  })
})
