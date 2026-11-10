import { describe, expect, it } from 'vitest'
import { signedPoints } from './signedPoints'

describe('signedPoints', () => {
  it('signs gains and losses', () => {
    expect(signedPoints(3)).toBe('+3')
    expect(signedPoints(-2)).toBe('−2')
  })

  it('shows zero without a sign', () => {
    expect(signedPoints(0)).toBe('0')
  })
})
