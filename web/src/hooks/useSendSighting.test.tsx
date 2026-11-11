import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { postSighting, type OnProgress } from '../lib/api'
import { useSendSighting } from './useSendSighting'

vi.mock('../lib/api', () => ({ postSighting: vi.fn() }))
vi.mock('../lib/uploadQueue', () => ({
  deviceQueue: { add: vi.fn(async () => {}), remove: vi.fn(async () => {}) },
  isRejectedForGood: () => false,
}))

const post = vi.mocked(postSighting)

const SIGHTING = {
  categories: [],
  claimType: 'regular' as const,
  id: 's1',
  location: null,
  photo: new Blob(['jpeg']),
  takenAt: '2026-11-10T20:00:00.000Z',
}

describe('useSendSighting', () => {
  beforeEach(() => {
    post.mockReset()
  })

  it('follows upload progress and starts over on retry', async () => {
    let report: OnProgress = () => {}
    let finish: (failed: boolean) => void = () => {}
    post.mockImplementation((_sighting, onProgress) => {
      report = onProgress ?? report
      return new Promise((resolve) => {
        finish = (failed) =>
          resolve(
            failed
              ? { ok: false, status: 0, error: 'network' }
              : { ok: true, data: { period_points: 1 } as never },
          )
      })
    })
    const { result } = renderHook(() => useSendSighting('p1'))
    expect(result.current.progress).toBe(0)

    await act(async () => {
      void result.current.send(SIGHTING)
    })
    act(() => report(0.6))
    expect(result.current.progress).toBe(0.6)
    await act(async () => finish(true))
    expect(result.current.status).toBe('failed')

    await act(async () => {
      void result.current.retry()
    })
    expect(result.current.progress).toBe(0)
  })
})
