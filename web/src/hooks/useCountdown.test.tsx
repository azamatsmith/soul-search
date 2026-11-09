import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { formatCountdown, useCountdown } from './useCountdown'

const NOW = new Date('2026-11-09T10:00:00Z').getTime()
const inSeconds = (seconds: number) =>
  new Date(NOW + seconds * 1000).toISOString()

describe('formatCountdown', () => {
  it.each([
    [872, '14:32'],
    [65, '1:05'],
    [0, '0:00'],
  ])('formats %i seconds as %s', (seconds, text) => {
    expect(formatCountdown(seconds)).toBe(text)
  })
})

describe('useCountdown', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(NOW)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('counts down each second', () => {
    const { result } = renderHook(() => useCountdown(inSeconds(872)))
    expect(result.current).toBe(872)
    act(() => {
      vi.advanceTimersByTime(1000)
    })
    expect(result.current).toBe(871)
  })

  it('jumps to the true time left after a long pause', () => {
    const { result } = renderHook(() => useCountdown(inSeconds(872)))
    vi.setSystemTime(NOW + 600_000)
    act(() => {
      vi.advanceTimersByTime(1000)
    })
    expect(result.current).toBe(271)
  })

  it('never goes below zero', () => {
    const { result } = renderHook(() => useCountdown(inSeconds(-30)))
    expect(result.current).toBe(0)
  })
})
