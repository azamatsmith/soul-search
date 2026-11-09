import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { TextField } from './TextField'

describe('TextField', () => {
  it('labels the input', () => {
    render(<TextField label="Your email" />)
    expect(screen.getByLabelText('Your email')).toBeInTheDocument()
  })

  it('shows the hint when there is no error', () => {
    render(<TextField label="Your name" hint="2 to 20 characters." />)
    expect(screen.getByLabelText('Your name')).toHaveAccessibleDescription(
      '2 to 20 characters.',
    )
    expect(screen.getByLabelText('Your name')).not.toHaveAttribute(
      'aria-invalid',
    )
  })

  it('shows the error instead of the hint and marks the input invalid', () => {
    render(
      <TextField
        label="Your name"
        hint="2 to 20 characters."
        error="Names need at least 2 characters."
      />,
    )
    const input = screen.getByLabelText('Your name')
    expect(input).toHaveAccessibleDescription(
      'Names need at least 2 characters.',
    )
    expect(input).toHaveAttribute('aria-invalid', 'true')
    expect(screen.queryByText('2 to 20 characters.')).not.toBeInTheDocument()
  })
})
