import type { Session } from '@supabase/supabase-js'
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export type SessionState =
  | { status: 'loading' }
  | { status: 'signed_out' }
  | { status: 'signed_in'; session: Session }
  | { status: 'unreachable'; retry: () => void }

type Known =
  | { status: 'loading' }
  | { status: 'signed_out' }
  | { status: 'signed_in'; session: Session }
  | { status: 'unreachable' }

const readStoredSession = async (): Promise<Known> => {
  const { data, error } = await supabase.auth.getSession()
  if (data.session) return { status: 'signed_in', session: data.session }
  return error ? { status: 'unreachable' } : { status: 'signed_out' }
}

export const useSession = (): SessionState => {
  const [state, setState] = useState<Known>({ status: 'loading' })

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) {
        setState({ status: 'signed_in', session })
      } else if (event === 'INITIAL_SESSION') {
        void readStoredSession().then(setState)
      } else {
        setState({ status: 'signed_out' })
      }
    })
    return () => data.subscription.unsubscribe()
  }, [])

  if (state.status !== 'unreachable') return state

  const retry = () => {
    setState({ status: 'loading' })
    void readStoredSession().then(setState)
  }
  return { status: 'unreachable', retry }
}
