import { renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAutoRefresh } from './useAutoRefresh'

const setVisibility = (value: 'hidden' | 'visible') => {
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    value,
  })
  document.dispatchEvent(new Event('visibilitychange'))
}

describe('useAutoRefresh', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    setVisibility('visible')
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('calls refresh every interval while visible', () => {
    const refresh = vi.fn()
    renderHook(() => useAutoRefresh(refresh))

    vi.advanceTimersByTime(30_000)
    vi.advanceTimersByTime(30_000)

    expect(refresh).toHaveBeenCalledTimes(2)
  })

  it('does not call refresh while hidden', () => {
    const refresh = vi.fn()
    renderHook(() => useAutoRefresh(refresh))

    setVisibility('hidden')
    vi.advanceTimersByTime(90_000)

    expect(refresh).not.toHaveBeenCalled()
  })

  it('refreshes once when the app becomes visible', () => {
    const refresh = vi.fn()
    renderHook(() => useAutoRefresh(refresh))
    setVisibility('hidden')

    setVisibility('visible')

    expect(refresh).toHaveBeenCalledTimes(1)
  })

  it('uses the latest refresh callback', () => {
    const first = vi.fn()
    const second = vi.fn()
    const { rerender } = renderHook(({ fn }) => useAutoRefresh(fn), {
      initialProps: { fn: first },
    })

    rerender({ fn: second })
    vi.advanceTimersByTime(30_000)

    expect(first).not.toHaveBeenCalled()
    expect(second).toHaveBeenCalledTimes(1)
  })

  it('stops after unmount', () => {
    const refresh = vi.fn()
    const { unmount } = renderHook(() => useAutoRefresh(refresh))

    unmount()
    vi.advanceTimersByTime(60_000)
    setVisibility('hidden')
    setVisibility('visible')

    expect(refresh).not.toHaveBeenCalled()
  })
})
