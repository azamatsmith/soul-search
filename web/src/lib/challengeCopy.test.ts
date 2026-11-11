import { describe, expect, it } from 'vitest'
import type { ApiFailure } from './api'
import { challengeErrorText } from './challengeCopy'

const failure = (error: ApiFailure['error'], name?: string): ApiFailure => ({
  error,
  ok: false,
  status: 422,
  ...(name ? { name } : {}),
})

describe('challengeErrorText', () => {
  it.each([
    [
      failure('overlaps', 'Brown Week'),
      'This overlaps Brown Week. Pick other times.',
    ],
    [
      failure('invalid_name'),
      'Give the challenge a name (up to 40 characters).',
    ],
    [
      failure('invalid_times'),
      "The end has to be after the start, and can't be in the past once it's running.",
    ],
    [
      failure('start_locked'),
      "This challenge has started, so its start time can't change.",
    ],
    [
      failure('invalid_bonus'),
      'A bonus uses a category that no longer exists. Remove it and try again.',
    ],
    [failure('invalid_points'), 'Point values are out of range.'],
    [failure('not_found'), 'This challenge was deleted.'],
    [
      failure('network'),
      "We couldn't save that. Check your connection and try again.",
    ],
  ])('explains %o', (input, text) => {
    expect(challengeErrorText(input)).toBe(text)
  })
})
