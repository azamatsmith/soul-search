import { renderHook, waitFor } from '@testing-library/react'
import { StrictMode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { QueuedSighting } from '../lib/uploadQueue'
import { useWaitingCards } from './useWaitingCards'

const item = (id: string): QueuedSighting => ({
  categories: [],
  claimType: 'regular',
  createdAt: 1,
  id,
  location: null,
  photo: new Blob([id], { type: 'image/jpeg' }),
  playerId: 'p1',
  takenAt: '2026-11-10T20:00:00.000Z',
})

describe('useWaitingCards', () => {
  let created: string[]
  let revoked: Set<string>

  beforeEach(() => {
    created = []
    revoked = new Set()
    URL.createObjectURL = vi.fn(() => {
      const url = `blob:${created.length}`
      created.push(url)
      return url
    })
    URL.revokeObjectURL = vi.fn((url: string) => void revoked.add(url))
  })

  it('keeps photo urls alive under StrictMode', async () => {
    const items = [item('a')]
    const { result } = renderHook(() => useWaitingCards(items, 'Bob'), {
      wrapper: StrictMode,
    })

    await waitFor(() => expect(result.current[0]?.photoUrl).toBeTruthy())
    await Promise.resolve()
    expect(revoked.has(result.current[0].photoUrl ?? '')).toBe(false)
  })

  it('revokes photo urls on unmount', async () => {
    const items = [item('a')]
    const { result, unmount } = renderHook(() => useWaitingCards(items, 'Bob'))
    await waitFor(() => expect(result.current[0]?.photoUrl).toBeTruthy())
    const url = result.current[0].photoUrl ?? ''

    unmount()

    await waitFor(() => expect(revoked.has(url)).toBe(true))
  })
})
