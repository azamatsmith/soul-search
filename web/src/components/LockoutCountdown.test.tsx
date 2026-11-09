import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { LockoutCountdown } from './LockoutCountdown'

const NOW = new Date('2026-11-09T10:00:00Z').getTime()
const inSeconds = (seconds: number) =>
  new Date(NOW + seconds * 1000).toISOString()

describe('LockoutCountdown', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(NOW)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('shows a disabled button with the time left', () => {
    render(<LockoutCountdown lockedUntil={inSeconds(872)} onRetry={vi.fn()} />)
    expect(
      screen.getByRole('button', { name: 'Try again in 14:32' }),
    ).toBeDisabled()
  })

  it('enables Email me a new code when time is up', () => {
    const onRetry = vi.fn()
    render(<LockoutCountdown lockedUntil={inSeconds(2)} onRetry={onRetry} />)
    act(() => {
      vi.advanceTimersByTime(2000)
    })
    const button = screen.getByRole('button', { name: 'Email me a new code' })
    expect(button).toBeEnabled()
    fireEvent.click(button)
    expect(onRetry).toHaveBeenCalledTimes(1)
  })
})
