import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useNow } from './useNow'

describe('useNow', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-11-10T12:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns the current time and ticks every minute', () => {
    const { result } = renderHook(() => useNow())
    const start = new Date('2026-11-10T12:00:00Z').getTime()

    expect(result.current).toBe(start)

    act(() => vi.advanceTimersByTime(60_000))

    expect(result.current).toBe(start + 60_000)
  })

  it('stops ticking after unmount', () => {
    const { unmount } = renderHook(() => useNow())

    unmount()

    expect(vi.getTimerCount()).toBe(0)
  })
})
