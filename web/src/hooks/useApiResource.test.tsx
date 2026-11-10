import { act, renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { ApiResult } from '../lib/api'
import { useApiResource } from './useApiResource'

const ok = <T,>(data: T): ApiResult<T> => ({ ok: true, data })
const failed: ApiResult<never> = { ok: false, status: 0, error: 'network' }

describe('useApiResource', () => {
  it('starts loading, then has the data', async () => {
    const load = vi.fn(() => Promise.resolve(ok({ points: 3 })))
    const { result } = renderHook(() => useApiResource(load))

    expect(result.current.status).toBe('loading')
    await waitFor(() => expect(result.current.status).toBe('ready'))
    expect(result.current.data).toEqual({ points: 3 })
    expect(load).toHaveBeenCalledTimes(1)
  })

  it('reports an error and loads again on retry', async () => {
    const load = vi
      .fn<() => Promise<ApiResult<{ points: number }>>>()
      .mockResolvedValueOnce(failed)
      .mockResolvedValueOnce(ok({ points: 1 }))
    const { result } = renderHook(() => useApiResource(load))

    await waitFor(() => expect(result.current.status).toBe('error'))
    expect(result.current.data).toBeNull()

    act(() => result.current.retry())

    expect(result.current.status).toBe('loading')
    await waitFor(() => expect(result.current.status).toBe('ready'))
    expect(result.current.data).toEqual({ points: 1 })
  })

  it('ignores a response that arrives after unmount', async () => {
    let resolve: (value: ApiResult<number>) => void = () => {}
    const load = () => new Promise<ApiResult<number>>((r) => (resolve = r))
    const { result, unmount } = renderHook(() => useApiResource(load))

    unmount()
    resolve(ok(1))
    await Promise.resolve()

    expect(result.current.status).toBe('loading')
  })
})
