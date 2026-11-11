import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { CodeState, CodeStatus } from '../hooks/useSignIn'
import { CodeScreen } from './CodeScreen'

const EMAIL = 'heathyr@example.com'

const stateWith = (
  status: CodeStatus,
  extra: Partial<CodeState> = {},
): CodeState => ({
  step: 'code',
  email: EMAIL,
  status,
  triesLeft: null,
  lockedUntil: null,
  ...extra,
})

const renderScreen = (state: CodeState) => {
  const props = {
    onSubmitCode: vi.fn(),
    onResend: vi.fn(),
    onChangeEmail: vi.fn(),
  }
  const view = render(<CodeScreen state={state} {...props} />)
  return { ...props, ...view }
}

const alertText = () => screen.getByRole('alert').textContent

describe('CodeScreen', () => {
  it('asks for the code sent to the email', () => {
    renderScreen(stateWith('idle'))
    expect(screen.getByText('Step 2 of 2')).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: 'Check your email' }),
    ).toBeInTheDocument()
    expect(screen.getByText(EMAIL)).toBeInTheDocument()
    expect(
      screen.getByText(
        "The code works for 10 minutes. Check spam if you don't see it.",
      ),
    ).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('submits the code after the sixth digit', () => {
    const { onSubmitCode } = renderScreen(stateWith('idle'))
    fireEvent.change(screen.getByLabelText('6-digit code'), {
      target: { value: '482913' },
    })
    expect(onSubmitCode).toHaveBeenCalledWith('482913')
  })

  it('shows checking and locks the code without closing the keyboard', () => {
    renderScreen(stateWith('checking'))
    const status = screen.getByRole('status')
    expect(status).toHaveTextContent('Checking your code…')
    expect(status.querySelector('svg')).toHaveAttribute('aria-hidden', 'true')
    const input = screen.getByLabelText('6-digit code')
    expect(input).toBeEnabled()
    expect(input).toHaveAttribute('readonly')
  })

  it('keeps the code field enabled while a new code is sent', () => {
    renderScreen(stateWith('sending'))
    const input = screen.getByLabelText('6-digit code')
    expect(input).toBeEnabled()
    expect(input).toHaveAttribute('readonly')
  })

  it('shows a wrong code with tries left', () => {
    renderScreen(stateWith('wrong', { triesLeft: 3 }))
    expect(alertText()).toBe(
      "That code isn't right.Check the email and try again. 3 tries left.",
    )
    expect(
      screen.getByRole('button', { name: 'Send a new code' }),
    ).toBeInTheDocument()
  })

  it('says 1 try left', () => {
    renderScreen(stateWith('wrong', { triesLeft: 1 }))
    expect(alertText()).toContain('1 try left.')
  })

  it('calls onResend from Send a new code', () => {
    const { onResend } = renderScreen(stateWith('wrong', { triesLeft: 3 }))
    fireEvent.click(screen.getByRole('button', { name: 'Send a new code' }))
    expect(onResend).toHaveBeenCalledTimes(1)
  })

  it('shows an expired code', () => {
    const { onResend } = renderScreen(stateWith('expired'))
    expect(
      screen.getByRole('heading', { name: 'That code expired' }),
    ).toBeInTheDocument()
    expect(alertText()).toBe(
      "Codes only work for 10 minutes.Get a new one and we'll email it right away.",
    )
    expect(screen.getByLabelText('6-digit code')).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'Email me a new code' }))
    expect(onResend).toHaveBeenCalledTimes(1)
  })

  it('shows too many tries with a countdown', () => {
    const lockedUntil = new Date(Date.now() + 600_000).toISOString()
    renderScreen(stateWith('locked', { lockedUntil }))
    expect(
      screen.getByRole('heading', { name: 'Too many tries' }),
    ).toBeInTheDocument()
    expect(alertText()).toBe(
      'Please wait 15 minutes.For safety, sign-in is paused after 5 wrong codes. Then ask for a new code.',
    )
    expect(screen.getByRole('button', { name: /Try again in/ })).toBeDisabled()
    expect(screen.getByLabelText('6-digit code')).toBeDisabled()
  })

  it('shows a code already on its way', () => {
    renderScreen(stateWith('too_soon'))
    expect(alertText()).toBe(
      'A code is already on its way.Wait a minute before asking for another one.',
    )
  })

  it('shows the could-not-reach error', () => {
    renderScreen(stateWith('unavailable'))
    expect(alertText()).toBe(
      "We couldn't reach Soul Search.Check your connection and try again.",
    )
  })

  it('calls onChangeEmail from Use another email', () => {
    const { onChangeEmail } = renderScreen(stateWith('idle'))
    fireEvent.click(screen.getByRole('button', { name: 'Use another email' }))
    expect(onChangeEmail).toHaveBeenCalledTimes(1)
  })

  it('clears the code when a new one is sent', () => {
    const { rerender, ...props } = renderScreen(
      stateWith('wrong', { triesLeft: 3 }),
    )
    const input = screen.getByLabelText('6-digit code')
    fireEvent.change(input, { target: { value: '482931' } })
    rerender(<CodeScreen state={stateWith('sending')} {...props} />)
    rerender(<CodeScreen state={stateWith('idle')} {...props} />)
    expect(screen.getByLabelText('6-digit code')).toHaveValue('')
  })
})
