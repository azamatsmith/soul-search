import { act, renderHook, waitFor } from '@testing-library/react'
import {
  AuthRetryableFetchError,
  type AuthChangeEvent,
  type Session,
} from '@supabase/supabase-js'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { supabase } from '../lib/supabase'
import { useSession } from './useSession'

vi.mock('../lib/supabase', () => ({
  supabase: { auth: { onAuthStateChange: vi.fn(), getSession: vi.fn() } },
}))

type Listener = (event: AuthChangeEvent, session: Session | null) => void
type SessionResult = Awaited<ReturnType<typeof supabase.auth.getSession>>

const onChange = vi.mocked(supabase.auth.onAuthStateChange)
const getSession = vi.mocked(supabase.auth.getSession)
const unsubscribe = vi.fn()
let listener: Listener

const SESSION = { access_token: 'tok' } as Session

const storedSession = (session: Session | null, error: Error | null) =>
  getSession.mockResolvedValue({
    data: { session },
    error,
  } as unknown as SessionResult)

describe('useSession', () => {
  beforeEach(() => {
    unsubscribe.mockReset()
    getSession.mockReset()
    storedSession(null, null)
    onChange.mockImplementation((callback) => {
      listener = callback as Listener
      return { data: { subscription: { unsubscribe } } } as never
    })
  })

  it('is loading until the initial session arrives', () => {
    const { result } = renderHook(() => useSession())
    expect(result.current).toEqual({ status: 'loading' })
  })

  it('reports signed in from auth events', () => {
    const { result } = renderHook(() => useSession())
    act(() => listener('SIGNED_IN', SESSION))
    expect(result.current).toEqual({ status: 'signed_in', session: SESSION })
  })

  it('reports signed out when there is no stored session', async () => {
    const { result } = renderHook(() => useSession())
    act(() => listener('INITIAL_SESSION', null))
    await waitFor(() =>
      expect(result.current).toEqual({ status: 'signed_out' }),
    )
  })

  it('reports signed out after signing out', () => {
    const { result } = renderHook(() => useSession())
    act(() => listener('SIGNED_IN', SESSION))
    act(() => listener('SIGNED_OUT', null))
    expect(result.current).toEqual({ status: 'signed_out' })
  })

  it('reports unreachable when the stored session cannot be refreshed', async () => {
    storedSession(null, new AuthRetryableFetchError('offline', 0))
    const { result } = renderHook(() => useSession())
    act(() => listener('INITIAL_SESSION', null))
    await waitFor(() => expect(result.current.status).toBe('unreachable'))
  })

  it('signs in on retry once auth can be reached', async () => {
    storedSession(null, new AuthRetryableFetchError('offline', 0))
    const { result } = renderHook(() => useSession())
    act(() => listener('INITIAL_SESSION', null))
    await waitFor(() => expect(result.current.status).toBe('unreachable'))
    storedSession(SESSION, null)
    act(() => {
      if (result.current.status === 'unreachable') result.current.retry()
    })
    await waitFor(() =>
      expect(result.current).toEqual({ status: 'signed_in', session: SESSION }),
    )
  })

  it('unsubscribes on unmount', () => {
    const { unmount } = renderHook(() => useSession())
    unmount()
    expect(unsubscribe).toHaveBeenCalledTimes(1)
  })
})
