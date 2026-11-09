import { describe, expect, it } from 'vitest'
import { validateDisplayName } from './validateDisplayName'

describe('validateDisplayName', () => {
  it.each([
    ['  Mom K. ', 'Mom K.'],
    ["O'Neil-Smith", "O'Neil-Smith"],
    ['Al', 'Al'],
    ['a'.repeat(20), 'a'.repeat(20)],
  ])('accepts %j as %j', (raw, name) => {
    expect(validateDisplayName(raw)).toEqual({ ok: true, name })
  })

  it.each([
    ['H', 'too_short'],
    ['   ', 'too_short'],
    ['a'.repeat(21), 'too_long'],
    ['Mom!', 'invalid'],
    ['Zoë', 'invalid'],
  ])('rejects %j as %s', (raw, error) => {
    expect(validateDisplayName(raw)).toEqual({ ok: false, error })
  })
})
