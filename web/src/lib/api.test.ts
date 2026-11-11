import { AuthApiError, AuthRetryableFetchError } from '@supabase/supabase-js'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  addAllowedEmail,
  getLeaderboard,
  getPointRules,
  getMe,
  getPeriod,
  getSightings,
  getReviewItem,
  getStanding,
  postReview,
  postScoreAdjustment,
  postSighting,
  putPointRules,
  putTextSize,
  removeAllowedEmail,
  sendCode,
  verifyCode,
} from './api'
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

const SIGHTING = {
  categories: [],
  claimType: 'regular' as const,
  id: 's1',
  location: null,
  photo: new Blob(['jpeg'], { type: 'image/jpeg' }),
  takenAt: '2026-11-10T20:00:00.000Z',
}

interface UploadProgress {
  lengthComputable: boolean
  loaded: number
  total: number
}

class FakeXhr {
  body: unknown = null
  headers: Record<string, string> = {}
  method = ''
  onerror: (() => void) | null = null
  onload: (() => void) | null = null
  ontimeout: (() => void) | null = null
  responseText = ''
  status = 0
  timeout = 0
  upload: { onprogress: ((event: UploadProgress) => void) | null } = {
    onprogress: null,
  }
  url = ''

  open(method: string, url: string) {
    this.method = method
    this.url = url
  }

  setRequestHeader(name: string, value: string) {
    this.headers[name] = value
  }

  send(body: unknown) {
    this.body = body
  }

  respond(status: number, body: unknown) {
    this.status = status
    this.responseText = JSON.stringify(body)
    this.onload?.()
  }

  fail() {
    this.onerror?.()
  }
}

const stubXhr = () => {
  const xhrs: FakeXhr[] = []
  vi.stubGlobal(
    'XMLHttpRequest',
    class extends FakeXhr {
      constructor() {
        super()
        xhrs.push(this)
      }
    },
  )
  return xhrs
}

const nextXhr = async (xhrs: FakeXhr[], index: number) => {
  await vi.waitFor(() => expect(xhrs[index]?.body).toBeTruthy())
  return xhrs[index]
}

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

  it('putTextSize sends the size with the bearer token', async () => {
    signedIn('tok')
    const fetchMock = stubFetch(() => respond(200, { text_size: 'large' }))
    await putTextSize('large')
    const [url, init] = fetchMock.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ]
    expect(url).toBe('http://localhost:8000/me/text-size')
    expect(init.method).toBe('PUT')
    expect(init.body).toBe(JSON.stringify({ text_size: 'large' }))
    expect(new Headers(init.headers).get('Authorization')).toBe('Bearer tok')
  })

  it('addAllowedEmail posts the email and passes already_allowed through', async () => {
    signedIn('tok')
    const fetchMock = stubFetch(() =>
      respond(409, { error: 'already_allowed' }),
    )
    expect(await addAllowedEmail('nora@example.com')).toEqual({
      ok: false,
      status: 409,
      error: 'already_allowed',
    })
    const [url, init] = fetchMock.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ]
    expect(url).toBe('http://localhost:8000/admin/allowed-emails')
    expect(init.method).toBe('POST')
    expect(init.body).toBe(JSON.stringify({ email: 'nora@example.com' }))
  })

  it('removeAllowedEmail deletes the encoded email', async () => {
    signedIn('tok')
    const fetchMock = stubFetch(() => respond(204))
    expect(await removeAllowedEmail('nora+1@example.com')).toEqual({
      ok: true,
      data: null,
    })
    const [url, init] = fetchMock.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ]
    expect(url).toBe(
      'http://localhost:8000/admin/allowed-emails/nora%2B1%40example.com',
    )
    expect(init.method).toBe('DELETE')
  })

  it('getPointRules reads the admin settings', async () => {
    signedIn('tok')
    const rules = {
      categories: ['Fins'],
      false_call: -1,
      regular: 1,
      special: 2,
    }
    const fetchMock = stubFetch(() => respond(200, rules))
    expect(await getPointRules()).toEqual({ ok: true, data: rules })
    expect(fetchMock.mock.calls[0][0]).toBe(
      'http://localhost:8000/admin/settings',
    )
  })

  it('putPointRules sends the rules and passes invalid_categories through', async () => {
    signedIn('tok')
    const rules = { categories: [], false_call: -1, regular: 1, special: 2 }
    const fetchMock = stubFetch(() =>
      respond(422, { error: 'invalid_categories' }),
    )
    expect(await putPointRules(rules)).toEqual({
      ok: false,
      status: 422,
      error: 'invalid_categories',
    })
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(init.method).toBe('PUT')
    expect(init.body).toBe(JSON.stringify(rules))
  })

  it('putTextSize passes no_player through', async () => {
    signedIn('tok')
    stubFetch(() => respond(404, { error: 'no_player' }))
    expect(await putTextSize('large')).toEqual({
      ok: false,
      status: 404,
      error: 'no_player',
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

  it.each([
    ['getPeriod', '/period', getPeriod],
    ['getStanding', '/me/standing', getStanding],
    ['getLeaderboard', '/leaderboard?scope=all', () => getLeaderboard('all')],
    ['getSightings', '/sightings?mine=false', () => getSightings(false)],
    ['getSightings', '/sightings?mine=true', () => getSightings(true)],
  ])('%s gets %s with the bearer token', async (_name, path, load) => {
    signedIn('tok')
    const fetchMock = stubFetch(() => respond(200, { points: 3 }))
    expect(await load()).toEqual({ ok: true, data: { points: 3 } })
    const [url, init] = fetchMock.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ]
    expect(url).toBe(`http://localhost:8000${path}`)
    expect(init.method).toBe('GET')
    expect(new Headers(init.headers).get('Authorization')).toBe('Bearer tok')
  })

  it('postSighting sends the photo and claim as multipart form data', async () => {
    signedIn('tok')
    const fetchMock = stubFetch(() => respond(201, { period_points: 4 }))
    const photo = new Blob(['jpeg'], { type: 'image/jpeg' })

    const result = await postSighting({
      categories: ['Alien Green', 'Brown paint'],
      claimType: 'special',
      id: 's1',
      location: { latitude: 47.6, longitude: -122.3 },
      photo,
      takenAt: '2026-11-10T20:00:00.000Z',
    })

    expect(result).toEqual({ ok: true, data: { period_points: 4 } })
    const [url, init] = fetchMock.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ]
    expect(url).toBe('http://localhost:8000/sightings')
    expect(init.method).toBe('POST')
    const headers = new Headers(init.headers)
    expect(headers.get('Authorization')).toBe('Bearer tok')
    expect(headers.get('Content-Type')).toBeNull()
    const form = init.body as FormData
    expect(form.get('id')).toBe('s1')
    expect(form.get('claim_type')).toBe('special')
    expect(form.getAll('categories')).toEqual(['Alien Green', 'Brown paint'])
    expect(form.get('taken_at')).toBe('2026-11-10T20:00:00.000Z')
    expect(form.get('latitude')).toBe('47.6')
    expect(form.get('longitude')).toBe('-122.3')
    expect(form.get('photo')).toBeInstanceOf(Blob)
  })

  it('postSighting leaves out location when there is none', async () => {
    signedIn('tok')
    const fetchMock = stubFetch(() => respond(201, {}))

    await postSighting({
      categories: [],
      claimType: 'regular',
      id: 's2',
      location: null,
      photo: new Blob(['jpeg'], { type: 'image/jpeg' }),
      takenAt: '2026-11-10T20:00:00.000Z',
    })

    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    const form = init.body as FormData
    expect(form.has('latitude')).toBe(false)
    expect(form.has('categories')).toBe(false)
  })

  it('postSighting reports upload progress when asked', async () => {
    signedIn('tok')
    const xhrs = stubXhr()
    const progress: number[] = []

    const pending = postSighting(SIGHTING, (fraction) =>
      progress.push(fraction),
    )
    const xhr = await nextXhr(xhrs, 0)
    xhr.upload.onprogress?.({ lengthComputable: true, loaded: 25, total: 100 })
    xhr.upload.onprogress?.({ lengthComputable: false, loaded: 60, total: 0 })
    xhr.upload.onprogress?.({ lengthComputable: true, loaded: 100, total: 100 })
    xhr.respond(201, { period_points: 4 })

    expect(await pending).toEqual({ ok: true, data: { period_points: 4 } })
    expect(progress).toEqual([0.25, 1])
    expect(xhr.method).toBe('POST')
    expect(xhr.url).toBe('http://localhost:8000/sightings')
    expect(xhr.headers.Authorization).toBe('Bearer tok')
    expect(xhr.timeout).toBe(15_000)
    expect((xhr.body as FormData).get('id')).toBe('s1')
  })

  it('postSighting with progress refreshes an expired token and retries', async () => {
    signedIn('old')
    refreshesTo('new')
    const xhrs = stubXhr()

    const pending = postSighting(SIGHTING, () => {})
    ;(await nextXhr(xhrs, 0)).respond(401, { error: 'unauthenticated' })
    const retry = await nextXhr(xhrs, 1)
    retry.respond(201, { period_points: 1 })

    expect(await pending).toEqual({ ok: true, data: { period_points: 1 } })
    expect(retry.headers.Authorization).toBe('Bearer new')
  })

  it('postSighting with progress maps errors and lost connections', async () => {
    signedIn('tok')
    const xhrs = stubXhr()

    const rejected = postSighting(SIGHTING, () => {})
    ;(await nextXhr(xhrs, 0)).respond(422, { error: 'invalid_photo' })
    expect(await rejected).toEqual({
      ok: false,
      status: 422,
      error: 'invalid_photo',
    })

    const offline = postSighting(SIGHTING, () => {})
    ;(await nextXhr(xhrs, 1)).fail()
    expect(await offline).toEqual({ ok: false, status: 0, error: 'network' })
  })

  it('getReviewItem reads one photo waiting for review', async () => {
    signedIn('tok')
    const fetchMock = stubFetch(() => respond(200, { id: 's1' }))
    expect(await getReviewItem('s1')).toEqual({ ok: true, data: { id: 's1' } })
    expect(fetchMock.mock.calls[0][0]).toBe(
      'http://localhost:8000/admin/review/s1',
    )
  })

  it('postReview sends the action and passes already_reviewed through', async () => {
    signedIn('tok')
    const fetchMock = stubFetch(() =>
      respond(409, { error: 'already_reviewed' }),
    )
    expect(await postReview('s1', 'special', 'Brown paint')).toEqual({
      ok: false,
      status: 409,
      error: 'already_reviewed',
    })
    const [url, init] = fetchMock.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ]
    expect(url).toBe('http://localhost:8000/admin/review/s1')
    expect(init.method).toBe('POST')
    expect(init.body).toBe(
      JSON.stringify({ action: 'special', category: 'Brown paint' }),
    )
  })

  it('postScoreAdjustment sends the change and passes invalid_reason through', async () => {
    signedIn('tok')
    const fetchMock = stubFetch(() => respond(422, { error: 'invalid_reason' }))
    const adjustment = { change: 3, player_id: 'p1', reason: 'Lost uploads' }
    expect(await postScoreAdjustment(adjustment)).toEqual({
      ok: false,
      status: 422,
      error: 'invalid_reason',
    })
    const [url, init] = fetchMock.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ]
    expect(url).toBe('http://localhost:8000/admin/scores')
    expect(init.method).toBe('POST')
    expect(init.body).toBe(JSON.stringify(adjustment))
  })
})
