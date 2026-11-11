import { describe, expect, it } from 'vitest'
import { ordinal, youResult } from './pastWeeksCopy'

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
  ])('%i is %s', (rank, text) => {
    expect(ordinal(rank)).toBe(text)
  })
})

describe('youResult', () => {
  it('celebrates a win', () => {
    expect(youResult({ points: 24, rank: 1 })).toBe('You won this week!')
  })

  it('shows rank and points otherwise', () => {
    expect(youResult({ points: 18, rank: 2 })).toBe('You: 2nd · 18 pts')
  })

  it('uses the singular for one point', () => {
    expect(youResult({ points: 1, rank: 5 })).toBe('You: 5th · 1 pt')
  })

  it('says so when you did not play', () => {
    expect(youResult(null)).toBe('You didn’t score this week')
  })
})
