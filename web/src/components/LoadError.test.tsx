import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { LoadError } from './LoadError'

describe('LoadError', () => {
  it('names what failed and retries when tapped', () => {
    const onRetry = vi.fn()
    render(<LoadError onRetry={onRetry} thing="the scores" />)

    expect(screen.getByRole('alert')).toHaveTextContent(
      "Couldn't load the scores",
    )
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Check your Wi-Fi or signal, then try again. Your photos are safe.',
    )
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }))

    expect(onRetry).toHaveBeenCalledTimes(1)
  })
})
