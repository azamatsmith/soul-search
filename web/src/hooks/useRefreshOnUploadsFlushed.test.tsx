import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { createQueryClient } from '../lib/queryClient'
import { UPLOADS_FLUSHED } from '../lib/uploadQueue'
import { queryWrapper } from '../test/queryWrapper'
import { useRefreshOnUploadsFlushed } from './useRefreshOnUploadsFlushed'

vi.mock('../lib/api', () => ({ postSighting: vi.fn() }))

describe('useRefreshOnUploadsFlushed', () => {
  it('refreshes points, scores and sightings when queued photos are sent', () => {
    const client = createQueryClient()
    const invalidate = vi.spyOn(client, 'invalidateQueries')
    renderHook(() => useRefreshOnUploadsFlushed(), {
      wrapper: queryWrapper(client),
    })

    act(() => {
      window.dispatchEvent(new Event(UPLOADS_FLUSHED))
    })

    const keys = invalidate.mock.calls.map(([filters]) => filters?.queryKey)
    expect(keys).toEqual([['standing'], ['leaderboard'], ['sightings']])
  })
})
