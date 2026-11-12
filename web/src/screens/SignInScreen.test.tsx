import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { SignInScreen } from './SignInScreen'

const button = () => screen.getByRole('button', { name: 'Email me a code' })
const typeEmail = (value: string) =>
  fireEvent.change(screen.getByLabelText('Your email'), { target: { value } })

describe('SignInScreen', () => {
  it('shows the brand, hint and invite-only footnote', () => {
    render(<SignInScreen error={null} onSubmit={vi.fn()} sending={false} />)
    expect(
      screen.getByRole('heading', { name: 'Soul Search' }),
    ).toBeInTheDocument()
    expect(
      screen.getByText('A new Kia Soul challenge every week.'),
    ).toBeInTheDocument()
    expect(screen.getByLabelText('Your email')).toHaveAccessibleDescription(
      "We'll email you a 6-digit code. Type it in here to sign in. No password to remember.",
    )
    expect(screen.getByText('Soul Search is invite-only.')).toBeInTheDocument()
  })

  it('disables Email me a code until the email has an @', () => {
    render(<SignInScreen error={null} onSubmit={vi.fn()} sending={false} />)
    expect(button()).toBeDisabled()
    typeEmail('heathyr')
    expect(button()).toBeDisabled()
    typeEmail('heathyr@example.com')
    expect(button()).toBeEnabled()
  })

  it('submits the typed email', () => {
    const onSubmit = vi.fn()
    render(<SignInScreen error={null} onSubmit={onSubmit} sending={false} />)
    typeEmail('heathyr@example.com')
    fireEvent.click(button())
    expect(onSubmit).toHaveBeenCalledWith('heathyr@example.com')
  })

  it('shows the not-on-the-list error', () => {
    render(
      <SignInScreen error="not_allowed" onSubmit={vi.fn()} sending={false} />,
    )
    expect(screen.getByRole('alert')).toHaveTextContent(
      "This email isn't on the list.Ask Matthew or Heathyr to add you, then try again.",
    )
    expect(screen.getByLabelText('Your email')).toHaveAttribute(
      'aria-invalid',
      'true',
    )
  })

  it('shows the invalid email error', () => {
    render(
      <SignInScreen error="invalid_email" onSubmit={vi.fn()} sending={false} />,
    )
    expect(screen.getByRole('alert')).toHaveTextContent(
      "That doesn't look like an email address.",
    )
  })

  it('shows the could-not-reach error', () => {
    render(
      <SignInScreen error="unavailable" onSubmit={vi.fn()} sending={false} />,
    )
    expect(screen.getByRole('alert')).toHaveTextContent(
      "We couldn't reach Soul Search.Check your connection and try again.",
    )
  })

  it('swaps the button for a sending status while the code is sent', () => {
    render(<SignInScreen error={null} onSubmit={vi.fn()} sending />)
    expect(screen.getByRole('status')).toHaveTextContent('Sending your code…')
    expect(
      screen.queryByRole('button', { name: 'Email me a code' }),
    ).not.toBeInTheDocument()
  })

  it('makes the email read-only while sending', () => {
    render(<SignInScreen error={null} onSubmit={vi.fn()} sending />)
    expect(screen.getByLabelText('Your email')).toHaveAttribute('readonly')
  })

  it('keeps the typed email when the send fails', () => {
    const { rerender } = render(
      <SignInScreen error={null} onSubmit={vi.fn()} sending={false} />,
    )
    typeEmail('heathyr@example.com')
    rerender(<SignInScreen error={null} onSubmit={vi.fn()} sending />)
    rerender(
      <SignInScreen error="unavailable" onSubmit={vi.fn()} sending={false} />,
    )
    expect(screen.getByLabelText('Your email')).toHaveValue(
      'heathyr@example.com',
    )
    expect(screen.getByLabelText('Your email')).not.toHaveAttribute('readonly')
    expect(button()).toBeEnabled()
  })
})
