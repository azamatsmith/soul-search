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
  'not_admin',
  'invalid_email',
  'already_allowed',
  'not_found',
  'cannot_remove_self',
  'invalid_points',
  'invalid_categories',
  'invalid_category',
  'already_reviewed',
  'invalid_change',
  'invalid_reason',
  'overlaps',
  'invalid_name',
  'invalid_times',
  'start_locked',
  'invalid_bonus',
  'network',
  'unknown',
] as const

export type ApiErrorCode = (typeof ERROR_CODES)[number]

export interface ApiFailure {
  ok: false
  status: number
  error: ApiErrorCode
  locked_until?: string
  name?: string
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
  if (typeof body.name === 'string') failure.name = body.name
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

type Method = 'DELETE' | 'GET' | 'POST' | 'PUT'

export type OnProgress = (fraction: number) => void

const NO_BODY_STATUSES = new Set([204, 205, 304])

const sendWithProgress = (
  path: string,
  method: Method,
  body: FormData,
  token: string | null,
  onProgress: OnProgress,
): Promise<Response | null> =>
  new Promise((resolve) => {
    const xhr = new XMLHttpRequest()
    xhr.open(method, `${baseUrl()}${path}`)
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`)
    xhr.timeout = REQUEST_TIMEOUT_MS
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(event.loaded / event.total)
    }
    xhr.onload = () => {
      const text = NO_BODY_STATUSES.has(xhr.status) ? null : xhr.responseText
      resolve(new Response(text, { status: xhr.status }))
    }
    xhr.onerror = () => resolve(null)
    xhr.ontimeout = () => resolve(null)
    xhr.send(body)
  })

const send = async (
  path: string,
  method: Method,
  body: unknown,
  token: string | null,
  onProgress?: OnProgress,
): Promise<Response | null> => {
  if (onProgress && body instanceof FormData) {
    return sendWithProgress(path, method, body, token, onProgress)
  }
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
  method: Method,
  body: unknown,
  auth: boolean,
  onProgress?: OnProgress,
): Promise<ApiResult<T>> => {
  if (!auth) {
    return toResult<T>(await send(path, method, body, null, onProgress))
  }

  const first = await currentToken()
  if (!('token' in first)) return first
  const response = await send(path, method, body, first.token, onProgress)
  if (response?.status !== 401) return toResult<T>(response)

  const refreshed = await refreshedToken()
  if (!('token' in refreshed)) return refreshed
  return toResult<T>(
    await send(path, method, body, refreshed.token, onProgress),
  )
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

export type LeaderboardScope = 'all' | 'week'

export interface LeaderboardEntry {
  count: number
  display_name: string
  is_me: boolean
  player_id: string
  points: number
  rank: number
}

export interface Leaderboard {
  ends_at: string | null
  rows: LeaderboardEntry[]
  scope: LeaderboardScope
  starts_at: string | null
  total_players: number
}

export const getLeaderboard = (scope: LeaderboardScope) =>
  request<Leaderboard>(`/leaderboard?scope=${scope}`, 'GET', undefined, true)

export interface PastWinner {
  display_name: string
  is_me: boolean
  player_id: string
  points: number
}

export interface MyResult {
  points: number
  rank: number
}

export interface PastWeekSummary {
  ends_at: string
  id: string
  me: MyResult | null
  starts_at: string
  winner: PastWinner | null
}

export interface PastWeeks {
  total_players: number
  weeks: PastWeekSummary[]
}

export interface PastWeek {
  ends_at: string
  id: string
  rows: LeaderboardEntry[]
  starts_at: string
}

export const getPastWeeks = () =>
  request<PastWeeks>('/past-weeks', 'GET', undefined, true)

export const getPastWeek = (id: string) =>
  request<PastWeek>(
    `/past-weeks/${encodeURIComponent(id)}`,
    'GET',
    undefined,
    true,
  )

export type SightingStatus = 'counted' | 'false_call' | 'waiting_review'

export interface LoggedSighting {
  categories: string[]
  check_note: string | null
  claim_type: 'regular' | 'special'
  display_name: string
  flagged: boolean
  id: string
  is_me: boolean
  photo_url: string | null
  player_id: string
  points: number
  status: SightingStatus
  taken_at: string
  thumb_url: string | null
}

export interface SightingsLog {
  ends_at: string
  sightings: LoggedSighting[]
  starts_at: string
}

export const getSightings = (mine: boolean) =>
  request<SightingsLog>(`/sightings?mine=${mine}`, 'GET', undefined, true)

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

export const postSighting = (
  sighting: NewSighting,
  onProgress?: OnProgress,
) => {
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
  return request<PostSightingResult>(
    '/sightings',
    'POST',
    form,
    true,
    onProgress,
  )
}

export interface AllowedEmail {
  display_name: string | null
  email: string
}

export interface AllowedEmails {
  emails: AllowedEmail[]
}

export const getAllowedEmails = () =>
  request<AllowedEmails>('/admin/allowed-emails', 'GET', undefined, true)

export const addAllowedEmail = (email: string) =>
  request<AllowedEmail>('/admin/allowed-emails', 'POST', { email }, true)

export const removeAllowedEmail = (email: string) =>
  request<null>(
    `/admin/allowed-emails/${encodeURIComponent(email)}`,
    'DELETE',
    undefined,
    true,
  )

export interface PointRules {
  categories: string[]
  false_call: number
  regular: number
  special: number
}

export const getPointRules = () =>
  request<PointRules>('/admin/settings', 'GET', undefined, true)

export const putPointRules = (rules: PointRules) =>
  request<PointRules>('/admin/settings', 'PUT', rules, true)

export interface ChallengeRules {
  bonuses: Record<string, number>
  false_call: number
  regular: number
  special: number
}

export interface Challenge {
  ends_at: string
  id: string
  name: string
  rules: ChallengeRules
  starts_at: string
}

export interface FinishedChallenge extends Challenge {
  winner: { display_name: string; points: number } | null
}

export interface ChallengeList {
  finished: FinishedChallenge[]
  running: Challenge[]
  upcoming: Challenge[]
}

export interface ChallengeDetail extends Challenge {
  started: boolean
}

export type ChallengeInput = Omit<Challenge, 'id'>

export const getChallenges = () =>
  request<ChallengeList>('/admin/challenges', 'GET', undefined, true)

export const getChallenge = (id: string) =>
  request<ChallengeDetail>(
    `/admin/challenges/${encodeURIComponent(id)}`,
    'GET',
    undefined,
    true,
  )

export const postChallenge = (input: ChallengeInput) =>
  request<Challenge>('/admin/challenges', 'POST', input, true)

export const putChallenge = (id: string, input: ChallengeInput) =>
  request<Challenge>(
    `/admin/challenges/${encodeURIComponent(id)}`,
    'PUT',
    input,
    true,
  )

export const deleteChallenge = (id: string) =>
  request<null>(
    `/admin/challenges/${encodeURIComponent(id)}`,
    'DELETE',
    undefined,
    true,
  )

export interface ReviewItem {
  categories: string[]
  check_note: string | null
  claim_type: 'regular' | 'special'
  display_name: string
  id: string
  photo_url: string | null
  points: number
  status: 'counted' | 'false_call'
  taken_at: string
  thumb_url: string | null
  verification_notes: string | null
}

export interface ReviewDetail extends ReviewItem {
  rules: Rules
}

export type ReviewAction = 'false_call' | 'keep' | 'regular' | 'special'

export const getReviewItem = (id: string) =>
  request<ReviewDetail>(
    `/admin/review/${encodeURIComponent(id)}`,
    'GET',
    undefined,
    true,
  )

export const postReview = (
  id: string,
  action: ReviewAction,
  category: string | null,
) =>
  request<null>(
    `/admin/review/${encodeURIComponent(id)}`,
    'POST',
    { action, category },
    true,
  )

export interface ReviewQueue {
  false_calls: ReviewItem[]
  flagged: ReviewItem[]
}

export const getReviewQueue = () =>
  request<ReviewQueue>('/admin/review', 'GET', undefined, true)

export interface PlayerScore {
  display_name: string
  id: string
  points: number
}

export interface Scores {
  period: { kind: 'challenge' | 'week'; name: string | null }
  players: PlayerScore[]
}

export interface ScoreAdjustment {
  change: number
  player_id: string
  reason: string
}

export const getScores = () =>
  request<Scores>('/admin/scores', 'GET', undefined, true)

export const postScoreAdjustment = (adjustment: ScoreAdjustment) =>
  request<{ player_id: string; points: number }>(
    '/admin/scores',
    'POST',
    adjustment,
    true,
  )

export type HistoryType = 'challenge' | 'emails' | 'photo' | 'rules' | 'score'

export interface HistoryEntry {
  admin: { display_name: string; id: string }
  after: Record<string, unknown> | null
  before: Record<string, unknown> | null
  created_at: string
  id: string
  reason: string | null
  target_name: string | null
  type: HistoryType
}

export interface History {
  entries: HistoryEntry[]
}

export const getHistory = (scoresOnly: boolean) =>
  request<History>(
    scoresOnly ? '/admin/history?type=score' : '/admin/history',
    'GET',
    undefined,
    true,
  )
