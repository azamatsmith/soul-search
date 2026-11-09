import { useRef, useState } from 'react'
import { sendCode, verifyCode, type ApiFailure } from '../lib/api'
import { supabase } from '../lib/supabase'

export type EmailError = 'not_allowed' | 'invalid_email' | 'unavailable'

export type CodeStatus =
  | 'idle'
  | 'sending'
  | 'checking'
  | 'wrong'
  | 'expired'
  | 'locked'
  | 'too_soon'
  | 'unavailable'

export type CodeState = {
  step: 'code'
  email: string
  status: CodeStatus
  triesLeft: number | null
  lockedUntil: string | null
}

export type SignInState =
  { step: 'email'; sending: boolean; error: EmailError | null } | CodeState

export const PENDING_KEY = 'soul-search.pending-sign-in'

const CODE_LIFETIME_MS = 600_000
const CHECKABLE: CodeStatus[] = ['idle', 'wrong', 'too_soon', 'unavailable']
const EMAIL_START: SignInState = { step: 'email', sending: false, error: null }

const codeState = (
  email: string,
  status: CodeStatus,
  extra: Partial<CodeState> = {},
): CodeState => ({
  step: 'code',
  email,
  status,
  triesLeft: null,
  lockedUntil: null,
  ...extra,
})

const savePending = (email: string, now: number) => {
  try {
    localStorage.setItem(
      PENDING_KEY,
      JSON.stringify({ email, codeSentAt: new Date(now).toISOString() }),
    )
  } catch {
    return
  }
}

const clearPending = () => {
  try {
    localStorage.removeItem(PENDING_KEY)
  } catch {
    return
  }
}

const loadPending = (now: number): string | null => {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(PENDING_KEY) ?? '')
    if (typeof parsed !== 'object' || parsed === null) return null
    const { email, codeSentAt } = parsed as Record<string, unknown>
    if (typeof email !== 'string' || typeof codeSentAt !== 'string') return null
    const age = now - new Date(codeSentAt).getTime()
    return age >= 0 && age < CODE_LIFETIME_MS ? email : null
  } catch {
    return null
  }
}

const initialState = (now: number): SignInState => {
  const email = loadPending(now)
  return email ? codeState(email, 'idle') : EMAIL_START
}

const lockedState = (email: string, failure: ApiFailure) =>
  codeState(email, 'locked', { lockedUntil: failure.locked_until ?? null })

const verifyFailureState = (email: string, failure: ApiFailure): CodeState => {
  switch (failure.error) {
    case 'wrong_code':
      return codeState(email, 'wrong', {
        triesLeft: failure.tries_left ?? null,
      })
    case 'expired':
      return codeState(email, 'expired')
    case 'locked':
      return lockedState(email, failure)
    default:
      return codeState(email, 'unavailable')
  }
}

const resendFailureState = (email: string, failure: ApiFailure): CodeState => {
  if (failure.error === 'too_soon') return codeState(email, 'too_soon')
  if (failure.error === 'locked') return lockedState(email, failure)
  return codeState(email, 'unavailable')
}

const emailError = (failure: ApiFailure): EmailError => {
  if (failure.error === 'not_allowed') return 'not_allowed'
  if (failure.error === 'invalid_request') return 'invalid_email'
  return 'unavailable'
}

export const useSignIn = (now: () => number = Date.now) => {
  const [state, setState] = useState<SignInState>(() => initialState(now()))
  const busy = useRef(false)

  const submitEmail = async (rawEmail: string) => {
    if (busy.current) return
    busy.current = true
    const email = rawEmail.trim().toLowerCase()
    setState({ step: 'email', sending: true, error: null })
    const result = await sendCode(email)
    busy.current = false
    if (result.ok || result.error === 'too_soon') {
      if (result.ok) savePending(email, now())
      setState(codeState(email, 'idle'))
    } else if (result.error === 'locked') {
      setState(lockedState(email, result))
    } else {
      setState({ step: 'email', sending: false, error: emailError(result) })
    }
  }

  const submitCode = async (code: string) => {
    if (busy.current || state.step !== 'code') return
    if (!CHECKABLE.includes(state.status)) return
    busy.current = true
    const { email } = state
    setState(codeState(email, 'checking'))
    const result = await verifyCode(email, code)
    if (!result.ok) {
      busy.current = false
      setState(verifyFailureState(email, result))
      return
    }
    const { error } = await supabase.auth.setSession({
      access_token: result.data.access_token,
      refresh_token: result.data.refresh_token,
    })
    busy.current = false
    if (error) {
      setState(codeState(email, 'unavailable'))
      return
    }
    clearPending()
  }

  const resendCode = async () => {
    if (busy.current || state.step !== 'code') return
    busy.current = true
    const { email } = state
    setState(codeState(email, 'sending'))
    const result = await sendCode(email)
    busy.current = false
    if (result.ok) {
      savePending(email, now())
      setState(codeState(email, 'idle'))
    } else {
      setState(resendFailureState(email, result))
    }
  }

  const changeEmail = () => {
    clearPending()
    setState(EMAIL_START)
  }

  return { state, submitEmail, submitCode, resendCode, changeEmail }
}
