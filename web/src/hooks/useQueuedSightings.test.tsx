import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import {
  type QueuedSighting,
  type QueueStore,
  UPLOADS_FLUSHED,
} from '../lib/uploadQueue'
import { useQueuedSightings } from './useQueuedSightings'

vi.mock('../lib/api', () => ({ postSighting: vi.fn() }))

const item = (id: string, playerId = 'p1'): QueuedSighting => ({
  categories: [],
  claimType: 'regular',
  createdAt: 1,
  id,
  location: null,
  photo: new Blob(['jpeg'], { type: 'image/jpeg' }),
  playerId,
  takenAt: '2026-11-10T20:00:00.000Z',
})

const storeOf = (items: QueuedSighting[]): QueueStore => ({
  add: async () => {},
  all: async () => [...items],
  remove: async () => {},
})

const ids = (items: QueuedSighting[]) => items.map((i) => i.id)

describe('useQueuedSightings', () => {
  it("loads only this player's queued items", async () => {
    const store = storeOf([item('mine'), item('theirs', 'p2')])

    const { result } = renderHook(() => useQueuedSightings('p1', store))

    await waitFor(() => expect(ids(result.current.items)).toEqual(['mine']))
  })

  it('reloads when uploads flush', async () => {
    const items = [item('a')]
    const store = storeOf(items)
    const { result } = renderHook(() => useQueuedSightings('p1', store))
    await waitFor(() => expect(ids(result.current.items)).toEqual(['a']))

    items.pop()
    act(() => {
      window.dispatchEvent(new Event(UPLOADS_FLUSHED))
    })

    await waitFor(() => expect(result.current.items).toEqual([]))
  })

  it('reloads on demand', async () => {
    const items: QueuedSighting[] = []
    const store = storeOf(items)
    const { result } = renderHook(() => useQueuedSightings('p1', store))

    items.push(item('b'))
    act(() => result.current.reload())

    await waitFor(() => expect(ids(result.current.items)).toEqual(['b']))
  })

  it('gives an empty list when the queue cannot be read', async () => {
    const store: QueueStore = {
      ...storeOf([]),
      all: () => Promise.reject(new Error('blocked')),
    }

    const { result } = renderHook(() => useQueuedSightings('p1', store))

    await waitFor(() => expect(result.current.items).toEqual([]))
  })
})
