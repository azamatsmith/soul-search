import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getMe, sendCode, verifyCode } from './api'
import { supabase } from './supabase'

vi.mock('./supabase', () => ({
  supabase: { auth: { getSession: vi.fn() } },
}))

const getSession = vi.mocked(supabase.auth.getSession)

const respond = (status: number, body?: unknown, raw?: string) =>
  Promise.resolve(
    new Response(raw ?? (body === undefined ? null : JSON.stringify(body)), {
      status,
    }),
  )

const stubFetch = (impl: () => Promise<Response>) => {
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
})
