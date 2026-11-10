import { describe, expect, it, vi } from 'vitest'
import type { ApiResult, PostSightingResult } from './api'
import {
  flushQueue,
  singleFlight,
  type QueuedSighting,
  type QueueStore,
} from './uploadQueue'

vi.mock('./api', () => ({ postSighting: vi.fn() }))

const item = (
  id: string,
  createdAt: number,
  playerId = 'p1',
): QueuedSighting => ({
  categories: [],
  claimType: 'regular',
  createdAt,
  id,
  location: null,
  photo: new Blob(['jpeg'], { type: 'image/jpeg' }),
  playerId,
  takenAt: '2026-11-10T20:00:00.000Z',
})

const memoryStore = (
  items: QueuedSighting[],
): QueueStore & { ids: () => string[] } => {
  const map = new Map(items.map((i) => [i.id, i]))
  return {
    add: async (i) => void map.set(i.id, i),
    all: async () => [...map.values()],
    ids: () => [...map.keys()],
    remove: async (id) => void map.delete(id),
  }
}

const OK: ApiResult<PostSightingResult> = {
  ok: true,
  data: {
    period_points: 1,
    sighting: {
      id: 'x',
      taken_at: '',
      claim_type: 'regular',
      categories: [],
      points: 1,
      status: 'waiting_review',
      flagged: false,
    },
  },
}
const NETWORK: ApiResult<PostSightingResult> = {
  ok: false,
  status: 0,
  error: 'network',
}
const failure = (
  status: number,
  error: 'invalid_photo' | 'conflict' | 'unauthenticated' | 'unknown',
) => ({ ok: false, status, error }) as ApiResult<PostSightingResult>

describe('flushQueue', () => {
  it('sends oldest first and removes what the server confirmed', async () => {
    const store = memoryStore([item('b', 2), item('a', 1)])
    const post = vi.fn().mockResolvedValue(OK)

    expect(await flushQueue(store, post, 'p1')).toEqual({ kept: 0, sent: 2 })
    expect(post.mock.calls.map(([s]) => s.id)).toEqual(['a', 'b'])
    expect(store.ids()).toEqual([])
  })

  it('keeps everything and stops at the first network failure', async () => {
    const store = memoryStore([item('a', 1), item('b', 2)])
    const post = vi.fn().mockResolvedValue(NETWORK)

    expect(await flushQueue(store, post, 'p1')).toEqual({ kept: 2, sent: 0 })
    expect(post).toHaveBeenCalledTimes(1)
    expect(store.ids()).toEqual(['a', 'b'])
  })

  it.each([
    [500, 'unknown'],
    [401, 'unauthenticated'],
  ] as const)('keeps the photo after a %i', async (status, error) => {
    const store = memoryStore([item('a', 1)])

    await flushQueue(
      store,
      vi.fn().mockResolvedValue(failure(status, error)),
      'p1',
    )

    expect(store.ids()).toEqual(['a'])
  })

  it.each([
    [422, 'invalid_photo'],
    [409, 'conflict'],
  ] as const)(
    'drops a photo the server rejects for good (%i)',
    async (status, error) => {
      const store = memoryStore([item('a', 1), item('b', 2)])
      const post = vi
        .fn()
        .mockResolvedValueOnce(failure(status, error))
        .mockResolvedValueOnce(OK)

      expect(await flushQueue(store, post, 'p1')).toEqual({ kept: 0, sent: 1 })
      expect(store.ids()).toEqual([])
    },
  )

  it("only sends the signed-in player's photos", async () => {
    const store = memoryStore([item('mine', 1), item('theirs', 2, 'p2')])
    const post = vi.fn().mockResolvedValue(OK)

    expect(await flushQueue(store, post, 'p1')).toEqual({ kept: 0, sent: 1 })
    expect(post.mock.calls.map(([s]) => s.id)).toEqual(['mine'])
    expect(store.ids()).toEqual(['theirs'])
  })

  it('does nothing when storage cannot be read', async () => {
    const store = memoryStore([])
    store.all = () => Promise.reject(new Error('blocked'))
    const post = vi.fn()

    expect(await flushQueue(store, post, 'p1')).toEqual({ kept: 0, sent: 0 })
    expect(post).not.toHaveBeenCalled()
  })
})

describe('singleFlight', () => {
  it('shares one run between overlapping calls', async () => {
    let finish: (value: number) => void = () => {}
    const task = vi.fn(
      () => new Promise<number>((resolve) => (finish = resolve)),
    )
    const run = singleFlight(task)

    const first = run('p1')
    const second = run('p1')
    finish(3)

    expect(await first).toBe(3)
    expect(await second).toBe(3)
    expect(task).toHaveBeenCalledTimes(1)
  })

  it('runs separately for different players', async () => {
    const task = vi.fn(() => new Promise<number>(() => {}))
    const run = singleFlight(task)

    void run('p1')
    void run('p2')

    expect(task.mock.calls).toEqual([['p1'], ['p2']])
  })

  it('runs again once the last run is done', async () => {
    const task = vi.fn().mockResolvedValue(1)
    const run = singleFlight(task)

    await run('p1')
    await run('p1')

    expect(task).toHaveBeenCalledTimes(2)
  })
})
