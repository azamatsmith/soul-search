import { act, renderHook } from '@testing-library/react'
import type { AuthChangeEvent, Session } from '@supabase/supabase-js'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { supabase } from '../lib/supabase'
import { useSession } from './useSession'

vi.mock('../lib/supabase', () => ({
  supabase: { auth: { onAuthStateChange: vi.fn() } },
}))

type Listener = (event: AuthChangeEvent, session: Session | null) => void

const onChange = vi.mocked(supabase.auth.onAuthStateChange)
const unsubscribe = vi.fn()
let listener: Listener

describe('useSession', () => {
  beforeEach(() => {
    unsubscribe.mockReset()
    onChange.mockImplementation((callback) => {
      listener = callback as Listener
      return { data: { subscription: { unsubscribe } } } as never
    })
  })

  it('is loading until the initial session arrives', () => {
    const { result } = renderHook(() => useSession())
    expect(result.current).toEqual({ status: 'loading' })
  })

  it('reports signed out and signed in from auth events', () => {
    const { result } = renderHook(() => useSession())
    act(() => listener('INITIAL_SESSION', null))
    expect(result.current).toEqual({ status: 'signed_out' })
    const session = { access_token: 'tok' } as Session
    act(() => listener('SIGNED_IN', session))
    expect(result.current).toEqual({ status: 'signed_in', session })
  })

  it('unsubscribes on unmount', () => {
    const { unmount } = renderHook(() => useSession())
    unmount()
    expect(unsubscribe).toHaveBeenCalledTimes(1)
  })
})
