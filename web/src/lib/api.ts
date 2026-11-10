import { isAuthApiError } from '@supabase/supabase-js'
import type { TextSize } from '../hooks/useTextSize'
import { supabase } from './supabase'

export type { TextSize }

export interface Me {
  id: string
  email: string
  display_name: string | null
  is_admin: boolean
  text_size: TextSize
  flagged_count: number | null
}

export interface Rules {
  regular: number
  special: number
  false_call: number
  categories: string[]
  bonuses: Record<string, number>
}

export interface Period {
  kind: 'week' | 'challenge'
  id: string
  name: string | null
  starts_at: string
  ends_at: string
  rules: Rules
}

export interface Standing {
  points: number
  count: number
  rank: number | null
  total_players: number
  next_rank: number | null
  points_behind_next: number | null
  last_photo_url: string | null
}

export interface SessionTokens {
  access_token: string
  refresh_token: string
  expires_in: number
  expires_at: number
}

const ERROR_CODES = [
  'invalid_claim',
  'invalid_photo',
  'photo_too_large',
  'conflict',
  'storage_unavailable',
  'not_allowed',
  'locked',
  'too_soon',
  'auth_unavailable',
  'expired',
  'wrong_code',
  'unauthenticated',
  'too_short',
  'invalid',
  'name_taken',
  'no_player',
  'invalid_request',
  'network',
  'unknown',
] as const

export type ApiErrorCode = (typeof ERROR_CODES)[number]

export interface ApiFailure {
  ok: false
  status: number
  error: ApiErrorCode
  locked_until?: string
  tries_left?: number
}

export type ApiResult<T> = { ok: true; data: T } | ApiFailure

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

const isErrorCode = (value: unknown): value is ApiErrorCode =>
  ERROR_CODES.some((code) => code === value)

const readJson = async (response: Response): Promise<unknown> => {
  try {
    return await response.json()
  } catch {
    return null
  }
}

const toFailure = (status: number, body: unknown): ApiFailure => {
  const failure: ApiFailure = { ok: false, status, error: 'unknown' }
  if (!isRecord(body)) return failure
  if (isErrorCode(body.error)) failure.error = body.error
  if (typeof body.locked_until === 'string') {
    failure.locked_until = body.locked_until
  }
  if (typeof body.tries_left === 'number') failure.tries_left = body.tries_left
  return failure
}

const baseUrl = () => (import.meta.env.VITE_API_URL ?? '').replace(/\/+$/, '')

const REQUEST_TIMEOUT_MS = 15_000

type TokenResult = { token: string } | ApiFailure

const NETWORK: ApiFailure = { ok: false, status: 0, error: 'network' }
const SIGNED_OUT: ApiFailure = {
  ok: false,
  status: 401,
  error: 'unauthenticated',
}

const currentToken = async (): Promise<TokenResult> => {
  const { data, error } = await supabase.auth.getSession()
  if (error) return NETWORK
  return data.session ? { token: data.session.access_token } : SIGNED_OUT
}

const refreshedToken = async (): Promise<TokenResult> => {
  const { data, error } = await supabase.auth.refreshSession()
  if (error) return isAuthApiError(error) ? SIGNED_OUT : NETWORK
  return data.session ? { token: data.session.access_token } : SIGNED_OUT
}

const send = async (
  path: string,
  method: 'GET' | 'POST' | 'PUT',
  body: unknown,
  token: string | null,
): Promise<Response | null> => {
  const headers = new Headers()
  const form = body instanceof FormData
  if (body !== undefined && !form) {
    headers.set('Content-Type', 'application/json')
  }
  if (token) headers.set('Authorization', `Bearer ${token}`)
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  try {
    return await fetch(`${baseUrl()}${path}`, {
      method,
      headers,
      body: body === undefined || form ? body : JSON.stringify(body),
      signal: controller.signal,
    })
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

const toResult = async <T>(
  response: Response | null,
): Promise<ApiResult<T>> => {
  if (!response) return NETWORK
  if (!response.ok) return toFailure(response.status, await readJson(response))
  if (response.status === 204) return { ok: true, data: null as T }
  return { ok: true, data: (await readJson(response)) as T }
}

const request = async <T>(
  path: string,
  method: 'GET' | 'POST' | 'PUT',
  body: unknown,
  auth: boolean,
): Promise<ApiResult<T>> => {
  if (!auth) return toResult<T>(await send(path, method, body, null))

  const first = await currentToken()
  if (!('token' in first)) return first
  const response = await send(path, method, body, first.token)
  if (response?.status !== 401) return toResult<T>(response)

  const refreshed = await refreshedToken()
  if (!('token' in refreshed)) return refreshed
  return toResult<T>(await send(path, method, body, refreshed.token))
}

export const sendCode = (email: string) =>
  request<null>('/auth/send-code', 'POST', { email }, false)

export const verifyCode = (email: string, code: string) =>
  request<SessionTokens>('/auth/verify-code', 'POST', { email, code }, false)

export const getMe = () => request<Me>('/me', 'GET', undefined, true)

export const putDisplayName = (displayName: string) =>
  request<Me>('/me/display-name', 'PUT', { display_name: displayName }, true)

export const putTextSize = (textSize: TextSize) =>
  request<Me>('/me/text-size', 'PUT', { text_size: textSize }, true)

export const getPeriod = () =>
  request<Period>('/period', 'GET', undefined, true)

export const getStanding = () =>
  request<Standing>('/me/standing', 'GET', undefined, true)

export interface SightingOut {
  id: string
  taken_at: string
  claim_type: 'regular' | 'special'
  categories: string[]
  points: number
  status: string
  flagged: boolean
}

export interface PostSightingResult {
  sighting: SightingOut
  period_points: number
}

export interface NewSighting {
  categories: string[]
  claimType: 'regular' | 'special'
  id: string
  location: { latitude: number; longitude: number } | null
  photo: Blob
  takenAt: string
}

export const postSighting = (sighting: NewSighting) => {
  const form = new FormData()
  form.set('id', sighting.id)
  form.set('claim_type', sighting.claimType)
  form.set('taken_at', sighting.takenAt)
  sighting.categories.forEach((category) => form.append('categories', category))
  if (sighting.location) {
    form.set('latitude', String(sighting.location.latitude))
    form.set('longitude', String(sighting.location.longitude))
  }
  form.set('photo', sighting.photo, 'photo.jpg')
  return request<PostSightingResult>('/sightings', 'POST', form, true)
}
