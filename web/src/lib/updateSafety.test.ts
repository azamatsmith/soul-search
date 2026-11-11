import { describe, expect, it } from 'vitest'
import { isSafeToUpdate } from './updateSafety'

describe('isSafeToUpdate', () => {
  it.each([
    '/',
    '/sightings',
    '/scores',
    '/past-weeks',
    '/past-weeks/w1',
    '/settings',
    '/admin',
    '/admin/flagged',
    '/admin/challenges',
    '/admin/history',
  ])('is safe on %s', (pathname) => {
    expect(isSafeToUpdate(pathname)).toBe(true)
  })

  it.each([
    '/capture',
    '/sign-in',
    '/welcome',
    '/settings/name',
    '/admin/challenges/new',
    '/admin/challenges/abc',
    '/admin/flagged/abc',
    '/admin/points',
    '/admin/adjust',
    '/admin/emails',
    '/something-new',
  ])('waits on %s', (pathname) => {
    expect(isSafeToUpdate(pathname)).toBe(false)
  })
})
