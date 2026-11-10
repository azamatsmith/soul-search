import { describe, expect, it } from 'vitest'
import { avatarTone } from './avatarTone'

describe('avatarTone', () => {
  it('gives the same id the same tone', () => {
    expect(avatarTone('b2222222')).toBe(avatarTone('b2222222'))
  })

  it('spreads ids across all four tones', () => {
    const tones = new Set(['a', 'b', 'c', 'd'].map(avatarTone))
    expect(tones).toEqual(new Set(['forest', 'orange', 'inkMuted', 'ink']))
  })
})
