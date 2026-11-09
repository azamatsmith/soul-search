import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { sendCode, verifyCode, type ApiResult } from '../lib/api'
import { supabase } from '../lib/supabase'
import { PENDING_KEY, useSignIn } from './useSignIn'

vi.mock('../lib/api', () => ({ sendCode: vi.fn(), verifyCode: vi.fn() }))
vi.mock('../lib/supabase', () => ({
  supabase: { auth: { setSession: vi.fn() } },
}))

const send = vi.mocked(sendCode)
const verify = vi.mocked(verifyCode)
const setSession = vi.mocked(supabase.auth.setSession)

const NOW = new Date('2026-11-09T10:00:00Z').getTime()
const EMAIL = 'heathyr@example.com'
const LOCKED_UNTIL = '2026-11-09T10:15:00Z'
const TOKENS = {
  access_token: 'a',
  refresh_token: 'r',
  expires_in: 3600,
  expires_at: 1,
}

const fail = (
  status: number,
  error: string,
  extra: object = {},
): ApiResult<never> =>
  ({ ok: false, status, error, ...extra }) as ApiResult<never>

const storePending = (secondsAgo: number) =>
  localStorage.setItem(
    PENDING_KEY,
    JSON.stringify({
      email: EMAIL,
      codeSentAt: new Date(NOW - secondsAgo * 1000).toISOString(),
    }),
  )

const renderSignIn = () => renderHook(() => useSignIn(() => NOW))

const renderAtCode = () => {
  storePending(30)
  return renderSignIn()
}

describe('useSignIn', () => {
  beforeEach(() => {
    localStorage.clear()
    send.mockReset()
    verify.mockReset()
    setSession.mockReset()
    setSession.mockResolvedValue({
      data: { session: null, user: null },
      error: null,
    } as unknown as Awaited<ReturnType<typeof supabase.auth.setSession>>)
  })

  it('starts at the email step', () => {
    const { result } = renderSignIn()
    expect(result.current.state).toEqual({
      step: 'email',
      sending: false,
      error: null,
    })
  })

  it('moves to the code step and remembers the email when the code is sent', async () => {
    send.mockResolvedValue({ ok: true, data: null })
    const { result } = renderSignIn()
    await act(() => result.current.submitEmail('  Heathyr@Example.com '))
    expect(send).toHaveBeenCalledWith(EMAIL)
    expect(result.current.state).toEqual({
      step: 'code',
      email: EMAIL,
      status: 'idle',
      triesLeft: null,
      lockedUntil: null,
    })
    expect(JSON.parse(localStorage.getItem(PENDING_KEY) ?? '')).toEqual({
      email: EMAIL,
      codeSentAt: new Date(NOW).toISOString(),
    })
  })

  it('shows not_allowed when the email is not on the list', async () => {
    send.mockResolvedValue(fail(403, 'not_allowed'))
    const { result } = renderSignIn()
    await act(() => result.current.submitEmail(EMAIL))
    expect(result.current.state).toEqual({
      step: 'email',
      sending: false,
      error: 'not_allowed',
    })
  })

  it('shows invalid_email when the api rejects the email', async () => {
    send.mockResolvedValue(fail(422, 'invalid_request'))
    const { result } = renderSignIn()
    await act(() => result.current.submitEmail('x@'))
    expect(result.current.state).toMatchObject({ error: 'invalid_email' })
  })

  it('moves to the locked code state when sending while locked', async () => {
    send.mockResolvedValue(fail(423, 'locked', { locked_until: LOCKED_UNTIL }))
    const { result } = renderSignIn()
    await act(() => result.current.submitEmail(EMAIL))
    expect(result.current.state).toEqual({
      step: 'code',
      email: EMAIL,
      status: 'locked',
      triesLeft: null,
      lockedUntil: LOCKED_UNTIL,
    })
  })

  it('moves to the code step when a code was sent moments ago', async () => {
    send.mockResolvedValue(fail(429, 'too_soon'))
    const { result } = renderSignIn()
    await act(() => result.current.submitEmail(EMAIL))
    expect(result.current.state).toMatchObject({ step: 'code', status: 'idle' })
  })

  it('shows unavailable when sending cannot reach the api', async () => {
    send.mockResolvedValue(fail(0, 'network'))
    const { result } = renderSignIn()
    await act(() => result.current.submitEmail(EMAIL))
    expect(result.current.state).toMatchObject({
      step: 'email',
      error: 'unavailable',
    })
  })

  it('shows unavailable when checking cannot reach the api', async () => {
    verify.mockResolvedValue(fail(502, 'auth_unavailable'))
    const { result } = renderAtCode()
    await act(() => result.current.submitCode('482913'))
    expect(result.current.state).toMatchObject({ status: 'unavailable' })
  })

  it('sets the session and clears the pending email on a right code', async () => {
    verify.mockResolvedValue({ ok: true, data: TOKENS })
    const { result } = renderAtCode()
    await act(() => result.current.submitCode('482913'))
    expect(verify).toHaveBeenCalledWith(EMAIL, '482913')
    expect(setSession).toHaveBeenCalledWith({
      access_token: 'a',
      refresh_token: 'r',
    })
    expect(localStorage.getItem(PENDING_KEY)).toBeNull()
  })

  it('shows unavailable and keeps the pending email when the session cannot be stored', async () => {
    verify.mockResolvedValue({ ok: true, data: TOKENS })
    setSession.mockResolvedValue({
      data: { session: null, user: null },
      error: new Error('down'),
    } as unknown as Awaited<ReturnType<typeof supabase.auth.setSession>>)
    const { result } = renderAtCode()
    await act(() => result.current.submitCode('482913'))
    expect(result.current.state).toMatchObject({ status: 'unavailable' })
    expect(localStorage.getItem(PENDING_KEY)).not.toBeNull()
  })

  it('shows wrong with tries left', async () => {
    verify.mockResolvedValue(fail(401, 'wrong_code', { tries_left: 3 }))
    const { result } = renderAtCode()
    await act(() => result.current.submitCode('482931'))
    expect(result.current.state).toMatchObject({
      status: 'wrong',
      triesLeft: 3,
    })
  })

  it('shows expired', async () => {
    verify.mockResolvedValue(fail(410, 'expired'))
    const { result } = renderAtCode()
    await act(() => result.current.submitCode('482931'))
    expect(result.current.state).toMatchObject({ status: 'expired' })
  })

  it('shows locked after the fifth wrong code', async () => {
    verify.mockResolvedValue(
      fail(423, 'locked', { locked_until: LOCKED_UNTIL }),
    )
    const { result } = renderAtCode()
    await act(() => result.current.submitCode('482931'))
    expect(result.current.state).toMatchObject({
      status: 'locked',
      lockedUntil: LOCKED_UNTIL,
    })
  })

  it('sends only one verify request when the code is submitted twice while checking', async () => {
    verify.mockReturnValue(new Promise(() => {}))
    const { result } = renderAtCode()
    act(() => {
      void result.current.submitCode('482913')
      void result.current.submitCode('482913')
    })
    expect(verify).toHaveBeenCalledTimes(1)
    expect(result.current.state).toMatchObject({ status: 'checking' })
  })

  it('resets to idle and refreshes the sent time when a new code is sent', async () => {
    verify.mockResolvedValue(fail(410, 'expired'))
    send.mockResolvedValue({ ok: true, data: null })
    const { result } = renderAtCode()
    await act(() => result.current.submitCode('482931'))
    await act(() => result.current.resendCode())
    expect(send).toHaveBeenCalledWith(EMAIL)
    expect(result.current.state).toMatchObject({ status: 'idle' })
    expect(JSON.parse(localStorage.getItem(PENDING_KEY) ?? '')).toEqual({
      email: EMAIL,
      codeSentAt: new Date(NOW).toISOString(),
    })
  })

  it('shows too_soon when a new code is asked for too soon', async () => {
    send.mockResolvedValue(fail(429, 'too_soon'))
    const { result } = renderAtCode()
    await act(() => result.current.resendCode())
    expect(result.current.state).toMatchObject({ status: 'too_soon' })
  })

  it('shows locked when asking for a new code while locked', async () => {
    send.mockResolvedValue(fail(423, 'locked', { locked_until: LOCKED_UNTIL }))
    const { result } = renderAtCode()
    await act(() => result.current.resendCode())
    expect(result.current.state).toMatchObject({
      status: 'locked',
      lockedUntil: LOCKED_UNTIL,
    })
  })

  it('resumes at the code step when a code was sent under 10 minutes ago', () => {
    storePending(599)
    const { result } = renderSignIn()
    expect(result.current.state).toEqual({
      step: 'code',
      email: EMAIL,
      status: 'idle',
      triesLeft: null,
      lockedUntil: null,
    })
  })

  it('starts at the email step when the pending code is older than 10 minutes', () => {
    storePending(601)
    const { result } = renderSignIn()
    expect(result.current.state).toMatchObject({ step: 'email' })
  })

  it('starts at the email step when the stored value is unreadable', () => {
    localStorage.setItem(PENDING_KEY, '{not json')
    const { result } = renderSignIn()
    expect(result.current.state).toMatchObject({ step: 'email' })
  })

  it('changeEmail returns to the email step and forgets the email', () => {
    const { result } = renderAtCode()
    act(() => result.current.changeEmail())
    expect(result.current.state).toEqual({
      step: 'email',
      sending: false,
      error: null,
    })
    expect(localStorage.getItem(PENDING_KEY)).toBeNull()
  })
})
