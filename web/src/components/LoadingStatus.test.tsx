import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { LoadingStatus } from './LoadingStatus'

describe('LoadingStatus', () => {
  it('announces its label with the rolling car hidden from screen readers', () => {
    const { container } = render(<LoadingStatus label="Sending your code…" />)
    expect(screen.getByRole('status')).toHaveTextContent('Sending your code…')
    expect(container.querySelector('[data-car="looping"]')).not.toBeNull()
    expect(
      container.querySelector('[data-car]')?.closest('[aria-hidden="true"]'),
    ).not.toBeNull()
  })
})
