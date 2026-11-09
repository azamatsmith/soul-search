import { AuthApiError, AuthRetryableFetchError } from '@supabase/supabase-js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getMe, sendCode, verifyCode } from './api'
import { supabase } from './supabase'

vi.mock('./supabase', () => ({
  supabase: { auth: { getSession: vi.fn(), refreshSession: vi.fn() } },
}))

const getSession = vi.mocked(supabase.auth.getSession)
const refreshSession = vi.mocked(supabase.auth.refreshSession)

type RefreshResult = Awaited<ReturnType<typeof supabase.auth.refreshSession>>

const refreshesTo = (token: string) =>
  refreshSession.mockResolvedValue({
    data: { session: { access_token: token } },
    error: null,
  } as unknown as RefreshResult)

const refreshFails = (error: Error) =>
  refreshSession.mockResolvedValue({
    data: { session: null },
    error,
  } as unknown as RefreshResult)

const respond = (status: number, body?: unknown, raw?: string) =>
  Promise.resolve(
    new Response(raw ?? (body === undefined ? null : JSON.stringify(body)), {
      status,
    }),
  )

const stubFetch = (impl: (...args: unknown[]) => Promise<Response>) => {
  const fetchMock = vi.fn(impl)
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

const signedIn = (token: string) =>
  getSession.mockResolvedValue({
    data: { session: { access_token: token } },
    error: null,
  } as unknown as Awaited<ReturnType<typeof supabase.auth.getSession>>)

const signedOut = () =>
  getSession.mockResolvedValue({
    data: { session: null },
    error: null,
  } as unknown as Awaited<ReturnType<typeof supabase.auth.getSession>>)

describe('api', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_API_URL', 'http://localhost:8000/')
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
    getSession.mockReset()
    refreshSession.mockReset()
  })

  it('sendCode posts the email and returns ok on 204', async () => {
    const fetchMock = stubFetch(() => respond(204))
    const result = await sendCode('a@b.c')
    expect(result).toEqual({ ok: true, data: null })
    const [url, init] = fetchMock.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ]
    expect(url).toBe('http://localhost:8000/auth/send-code')
    expect(init.method).toBe('POST')
    expect(JSON.parse(String(init.body))).toEqual({ email: 'a@b.c' })
    expect(new Headers(init.headers).get('Content-Type')).toBe(
      'application/json',
    )
  })

  it('verifyCode returns the session tokens on 200', async () => {
    const tokens = {
      access_token: 'a',
      refresh_token: 'r',
      expires_in: 3600,
      expires_at: 1,
    }
    stubFetch(() => respond(200, tokens))
    expect(await verifyCode('a@b.c', '123456')).toEqual({
      ok: true,
      data: tokens,
    })
  })

  it('returns the error code and extras from the error body', async () => {
    stubFetch(() => respond(401, { error: 'wrong_code', tries_left: 3 }))
    expect(await verifyCode('a@b.c', '123456')).toEqual({
      ok: false,
      status: 401,
      error: 'wrong_code',
      tries_left: 3,
    })
  })

  it('passes locked_until through on a lockout', async () => {
    stubFetch(() =>
      respond(423, { error: 'locked', locked_until: '2026-11-09T10:15:00Z' }),
    )
    expect(await sendCode('a@b.c')).toEqual({
      ok: false,
      status: 423,
      error: 'locked',
      locked_until: '2026-11-09T10:15:00Z',
    })
  })

  it('maps an unrecognized error body to unknown', async () => {
    stubFetch(() => respond(500, undefined, 'oops'))
    expect(await sendCode('a@b.c')).toEqual({
      ok: false,
      status: 500,
      error: 'unknown',
    })
  })

  it('maps a rejected fetch to network with status 0', async () => {
    stubFetch(() => Promise.reject(new Error('offline')))
    expect(await sendCode('a@b.c')).toEqual({
      ok: false,
      status: 0,
      error: 'network',
    })
  })

  it('getMe sends the bearer token from the current session', async () => {
    signedIn('tok')
    const fetchMock = stubFetch(() =>
      respond(200, {
        id: '1',
        email: 'a@b.c',
        display_name: null,
        is_admin: false,
        text_size: 'standard',
        flagged_count: null,
      }),
    )
    const result = await getMe()
    expect(result.ok).toBe(true)
    const [url, init] = fetchMock.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ]
    expect(url).toBe('http://localhost:8000/me')
    expect(new Headers(init.headers).get('Authorization')).toBe('Bearer tok')
  })

  it('getMe returns unauthenticated without calling fetch when there is no session', async () => {
    signedOut()
    const fetchMock = stubFetch(() => respond(200, {}))
    expect(await getMe()).toEqual({
      ok: false,
      status: 401,
      error: 'unauthenticated',
    })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('getMe returns network when the session cannot be refreshed', async () => {
    getSession.mockResolvedValue({
      data: { session: null },
      error: new AuthRetryableFetchError('offline', 0),
    } as unknown as Awaited<ReturnType<typeof supabase.auth.getSession>>)
    const fetchMock = stubFetch(() => respond(200, {}))
    expect(await getMe()).toEqual({ ok: false, status: 0, error: 'network' })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('getMe refreshes the session and retries once on a 401', async () => {
    signedIn('old')
    refreshesTo('new')
    const fetchMock = vi
      .fn()
      .mockImplementationOnce(() => respond(401, { error: 'unauthenticated' }))
      .mockImplementationOnce(() => respond(200, { id: '1' }))
    vi.stubGlobal('fetch', fetchMock)
    expect(await getMe()).toEqual({ ok: true, data: { id: '1' } })
    const [, retryInit] = fetchMock.mock.calls[1] as unknown as [
      string,
      RequestInit,
    ]
    expect(new Headers(retryInit.headers).get('Authorization')).toBe(
      'Bearer new',
    )
  })

  it('getMe returns network when the refresh after a 401 cannot reach auth', async () => {
    signedIn('old')
    refreshFails(new AuthRetryableFetchError('offline', 0))
    stubFetch(() => respond(401, { error: 'unauthenticated' }))
    expect(await getMe()).toEqual({ ok: false, status: 0, error: 'network' })
  })

  it('getMe returns unauthenticated when the refresh token is rejected', async () => {
    signedIn('old')
    refreshFails(
      new AuthApiError('Invalid Refresh Token', 400, 'refresh_token_not_found'),
    )
    stubFetch(() => respond(401, { error: 'unauthenticated' }))
    expect(await getMe()).toEqual({
      ok: false,
      status: 401,
      error: 'unauthenticated',
    })
  })

  it('does not refresh on a 403', async () => {
    signedIn('tok')
    stubFetch(() => respond(403, { error: 'not_allowed' }))
    expect(await getMe()).toMatchObject({ error: 'not_allowed' })
    expect(refreshSession).not.toHaveBeenCalled()
  })

  it('gives up on a request that hangs for 15 seconds', async () => {
    vi.useFakeTimers()
    stubFetch(
      (...args: unknown[]) =>
        new Promise<Response>((_resolve, reject) => {
          const init = args[1] as RequestInit
          init.signal?.addEventListener('abort', () =>
            reject(new DOMException('Aborted', 'AbortError')),
          )
        }),
    )
    const pending = sendCode('a@b.c')
    await vi.advanceTimersByTimeAsync(14_999)
    let settled = false
    void pending.then(() => {
      settled = true
    })
    await Promise.resolve()
    expect(settled).toBe(false)
    await vi.advanceTimersByTimeAsync(1)
    expect(await pending).toEqual({ ok: false, status: 0, error: 'network' })
    vi.useRealTimers()
  })
})
