import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ApiResult } from '../lib/api'
import { createQueryClient } from '../lib/queryClient'
import { queryWrapper } from '../test/queryWrapper'
import { useApiResource } from './useApiResource'

const ok = <T,>(data: T): ApiResult<T> => ({ ok: true, data })
const failed: ApiResult<never> = { ok: false, status: 0, error: 'network' }

const renderResource = <T,>(
  load: () => Promise<ApiResult<T>>,
  wrapper = queryWrapper(),
) => renderHook(() => useApiResource(['thing'], load), { wrapper })

describe('useApiResource', () => {
  it('starts loading, then has the data', async () => {
    const load = vi.fn(() => Promise.resolve(ok({ points: 3 })))
    const { result } = renderResource(load)

    expect(result.current.status).toBe('loading')
    await waitFor(() => expect(result.current.status).toBe('ready'))
    expect(result.current.data).toEqual({ points: 3 })
    expect(load).toHaveBeenCalledTimes(1)
  })

  it('reports an error and loads again on retry', async () => {
    let resolveSecond: (value: ApiResult<{ points: number }>) => void = () => {}
    const load = vi
      .fn<() => Promise<ApiResult<{ points: number }>>>()
      .mockResolvedValueOnce(failed)
      .mockImplementationOnce(() => new Promise((r) => (resolveSecond = r)))
    const { result } = renderResource(load)

    await waitFor(() => expect(result.current.status).toBe('error'))
    expect(result.current.data).toBeNull()
    expect(result.current.error).toBe('network')

    act(() => result.current.retry())

    await waitFor(() => expect(result.current.status).toBe('loading'))
    act(() => resolveSecond(ok({ points: 1 })))
    await waitFor(() => expect(result.current.status).toBe('ready'))
    expect(result.current.data).toEqual({ points: 1 })
  })

  it('keeps showing data while a refresh loads', async () => {
    let resolveSecond: (value: ApiResult<number>) => void = () => {}
    const load = vi
      .fn<() => Promise<ApiResult<number>>>()
      .mockResolvedValueOnce(ok(1))
      .mockImplementationOnce(() => new Promise((r) => (resolveSecond = r)))
    const { result } = renderResource(load)
    await waitFor(() => expect(result.current.status).toBe('ready'))

    act(() => result.current.refresh())

    expect(result.current.status).toBe('ready')
    expect(result.current.data).toBe(1)
    act(() => resolveSecond(ok(2)))
    await waitFor(() => expect(result.current.data).toBe(2))
  })

  it('keeps old data and reports the error when a refresh fails', async () => {
    const load = vi
      .fn<() => Promise<ApiResult<number>>>()
      .mockResolvedValueOnce(ok(1))
      .mockResolvedValueOnce(failed)
    const { result } = renderResource(load)
    await waitFor(() => expect(result.current.status).toBe('ready'))

    act(() => result.current.refresh())

    await waitFor(() => expect(result.current.error).toBe('network'))
    expect(load).toHaveBeenCalledTimes(2)
    expect(result.current.status).toBe('ready')
    expect(result.current.data).toBe(1)
  })

  it('keeps showing the error while a refresh after a failure loads', async () => {
    let resolveSecond: (value: ApiResult<number>) => void = () => {}
    const load = vi
      .fn<() => Promise<ApiResult<number>>>()
      .mockResolvedValueOnce(failed)
      .mockImplementationOnce(() => new Promise((r) => (resolveSecond = r)))
    const { result } = renderResource(load)
    await waitFor(() => expect(result.current.status).toBe('error'))

    act(() => result.current.refresh())

    expect(result.current.status).toBe('error')
    act(() => resolveSecond(ok(5)))
    await waitFor(() => expect(result.current.data).toBe(5))
  })

  it('ignores refresh while the first load is still running', async () => {
    let resolveFirst: (value: ApiResult<number>) => void = () => {}
    const load = vi.fn(
      () => new Promise<ApiResult<number>>((r) => (resolveFirst = r)),
    )
    const { result } = renderResource(load)

    act(() => result.current.refresh())

    expect(load).toHaveBeenCalledTimes(1)
    act(() => resolveFirst(ok(3)))
    await waitFor(() => expect(result.current.data).toBe(3))
    expect(load).toHaveBeenCalledTimes(1)
  })

  it('shows saved data right away when opened again, then updates it', async () => {
    let resolveSecond: (value: ApiResult<number>) => void = () => {}
    const load = vi
      .fn<() => Promise<ApiResult<number>>>()
      .mockResolvedValueOnce(ok(1))
      .mockImplementationOnce(() => new Promise((r) => (resolveSecond = r)))
    const wrapper = queryWrapper(createQueryClient())
    const first = renderResource(load, wrapper)
    await waitFor(() => expect(first.result.current.status).toBe('ready'))
    first.unmount()

    const { result } = renderResource(load, wrapper)

    expect(result.current.status).toBe('ready')
    expect(result.current.data).toBe(1)
    expect(load).toHaveBeenCalledTimes(2)
    act(() => resolveSecond(ok(2)))
    await waitFor(() => expect(result.current.data).toBe(2))
  })

  it('makes one request when two screens ask for the same data', async () => {
    const load = vi.fn(() => Promise.resolve(ok(7)))
    const wrapper = queryWrapper(createQueryClient())
    const first = renderResource(load, wrapper)
    const second = renderResource(load, wrapper)

    await waitFor(() => expect(second.result.current.data).toBe(7))
    expect(first.result.current.data).toBe(7)
    expect(load).toHaveBeenCalledTimes(1)
  })
})

const setVisibility = (value: 'hidden' | 'visible') => {
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    value,
  })
  document.dispatchEvent(new Event('visibilitychange', { bubbles: true }))
}

describe('useApiResource with refreshEvery', () => {
  const renderPolling = (load: () => Promise<ApiResult<number>>) =>
    renderHook(
      () => useApiResource(['polled'], load, { refreshEvery: 30_000 }),
      { wrapper: queryWrapper() },
    )

  beforeEach(() => {
    vi.useFakeTimers()
    setVisibility('visible')
  })

  afterEach(() => {
    vi.useRealTimers()
    setVisibility('visible')
  })

  it('loads again every interval while visible', async () => {
    const load = vi.fn(() => Promise.resolve(ok(1)))
    renderPolling(load)
    await act(() => vi.advanceTimersByTimeAsync(0))

    await act(() => vi.advanceTimersByTimeAsync(60_000))

    expect(load).toHaveBeenCalledTimes(3)
  })

  it('pauses while hidden and loads as soon as it is visible again', async () => {
    const load = vi.fn(() => Promise.resolve(ok(1)))
    renderPolling(load)
    await act(() => vi.advanceTimersByTimeAsync(0))

    act(() => setVisibility('hidden'))
    await act(() => vi.advanceTimersByTimeAsync(90_000))
    expect(load).toHaveBeenCalledTimes(1)

    act(() => setVisibility('visible'))
    await act(() => vi.advanceTimersByTimeAsync(0))
    expect(load).toHaveBeenCalledTimes(2)
  })
})
