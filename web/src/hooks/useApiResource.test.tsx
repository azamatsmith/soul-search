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

  it('keeps showing data while a refresh loads', async () => {
    let resolveSecond: (value: ApiResult<number>) => void = () => {}
    const load = vi
      .fn<() => Promise<ApiResult<number>>>()
      .mockResolvedValueOnce(ok(1))
      .mockImplementationOnce(() => new Promise((r) => (resolveSecond = r)))
    const { result } = renderHook(() => useApiResource(load))
    await waitFor(() => expect(result.current.status).toBe('ready'))

    act(() => result.current.refresh())

    expect(result.current.status).toBe('ready')
    expect(result.current.data).toBe(1)
    await act(async () => resolveSecond(ok(2)))
    expect(result.current.data).toBe(2)
  })

  it('keeps old data when a refresh fails', async () => {
    const load = vi
      .fn<() => Promise<ApiResult<number>>>()
      .mockResolvedValueOnce(ok(1))
      .mockResolvedValueOnce(failed)
    const { result } = renderHook(() => useApiResource(load))
    await waitFor(() => expect(result.current.status).toBe('ready'))

    act(() => result.current.refresh())

    await waitFor(() => expect(load).toHaveBeenCalledTimes(2))
    await act(async () => {})
    expect(result.current.status).toBe('ready')
    expect(result.current.data).toBe(1)
    expect(result.current.error).toBeNull()
  })

  it('keeps showing the error while a refresh after a failure loads', async () => {
    let resolveSecond: (value: ApiResult<number>) => void = () => {}
    const load = vi
      .fn<() => Promise<ApiResult<number>>>()
      .mockResolvedValueOnce(failed)
      .mockImplementationOnce(() => new Promise((r) => (resolveSecond = r)))
    const { result } = renderHook(() => useApiResource(load))
    await waitFor(() => expect(result.current.status).toBe('error'))

    act(() => result.current.refresh())

    expect(result.current.status).toBe('error')
    await act(async () => resolveSecond(ok(5)))
    expect(result.current.status).toBe('ready')
    expect(result.current.data).toBe(5)
  })

  it('ignores refresh while the first load is still running', async () => {
    let resolveFirst: (value: ApiResult<number>) => void = () => {}
    const load = vi.fn(
      () => new Promise<ApiResult<number>>((r) => (resolveFirst = r)),
    )
    const { result } = renderHook(() => useApiResource(load))

    act(() => result.current.refresh())

    expect(load).toHaveBeenCalledTimes(1)
    await act(async () => resolveFirst(ok(3)))
    expect(result.current.data).toBe(3)
  })
})
