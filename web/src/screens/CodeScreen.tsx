import { useState } from 'react'
import { AuthLayout } from '../components/AuthLayout'
import { Button } from '../components/Button'
import { CODE_LENGTH, CodeInput } from '../components/CodeInput'
import { CodeStatusMessage } from '../components/CodeStatusMessage'
import { LockoutCountdown } from '../components/LockoutCountdown'
import type { CodeState, CodeStatus } from '../hooks/useSignIn'
import styles from './CodeScreen.module.css'

export interface CodeScreenProps {
  onChangeEmail: () => void
  onResend: () => void
  onSubmitCode: (code: string) => void
  state: CodeState
}

const TITLES: Partial<Record<CodeStatus, string>> = {
  expired: 'That code expired',
  locked: 'Too many tries',
}

const DISABLED_INPUT: CodeStatus[] = ['expired', 'locked']
const READ_ONLY_INPUT: CodeStatus[] = ['checking', 'sending']
const WITH_RESEND: CodeStatus[] = ['wrong', 'too_soon', 'unavailable']

const clearsCode = (previous: CodeStatus, next: CodeStatus) =>
  next === 'expired' ||
  next === 'locked' ||
  (previous === 'sending' && next === 'idle')

export const CodeScreen = ({
  onChangeEmail,
  onResend,
  onSubmitCode,
  state,
}: CodeScreenProps) => {
  const { status } = state
  const [code, setCode] = useState('')
  const [shownStatus, setShownStatus] = useState(status)

  if (shownStatus !== status) {
    setShownStatus(status)
    if (clearsCode(shownStatus, status)) setCode('')
  }

  const sending = status === 'sending'
  const invalid = status === 'wrong' && code.length === CODE_LENGTH

  return (
    <AuthLayout
      kicker="Step 2 of 2"
      title={TITLES[status] ?? 'Check your email'}
    >
      <p className={styles.lead}>
        We sent a 6-digit code to <b className={styles.email}>{state.email}</b>.
      </p>
      <CodeInput
        disabled={DISABLED_INPUT.includes(status)}
        invalid={invalid}
        onChange={setCode}
        onComplete={onSubmitCode}
        readOnly={READ_ONLY_INPUT.includes(status)}
        value={code}
      />
      {(status === 'idle' || sending) && (
        <p className={styles.hint}>
          The code works for 10 minutes. Check spam if you don't see it.
        </p>
      )}
      <CodeStatusMessage state={state} />
      <div className={styles.spacer} />
      {status === 'expired' && (
        <Button onClick={onResend}>Email me a new code</Button>
      )}
      {status === 'locked' && state.lockedUntil && (
        <LockoutCountdown lockedUntil={state.lockedUntil} onRetry={onResend} />
      )}
      {WITH_RESEND.includes(status) ? (
        <div className={styles.pair}>
          <Button onClick={onResend} variant="secondary">
            Send a new code
          </Button>
          <Button onClick={onChangeEmail} variant="secondary">
            Use another email
          </Button>
        </div>
      ) : (
        status !== 'checking' && (
          <Button disabled={sending} onClick={onChangeEmail} variant="link">
            Use another email
          </Button>
        )
      )}
    </AuthLayout>
  )
}
