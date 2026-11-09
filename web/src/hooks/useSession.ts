import type { Session } from '@supabase/supabase-js'
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export type SessionState =
  | { status: 'loading' }
  | { status: 'signed_out' }
  | { status: 'signed_in'; session: Session }

export const useSession = (): SessionState => {
  const [state, setState] = useState<SessionState>({ status: 'loading' })

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setState(
        session ? { status: 'signed_in', session } : { status: 'signed_out' },
      )
    })
    return () => data.subscription.unsubscribe()
  }, [])

  return state
}
