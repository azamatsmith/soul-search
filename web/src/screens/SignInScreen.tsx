import { useState, type ChangeEvent, type FormEvent } from 'react'
import { AuthLayout } from '../components/AuthLayout'
import { Button } from '../components/Button'
import { FormError } from '../components/FormError'
import { LoadingStatus } from '../components/LoadingStatus'
import { TextField } from '../components/TextField'
import type { EmailError } from '../hooks/useSignIn'
import { CHECK_CONNECTION, UNREACHABLE } from '../lib/errorCopy'
import styles from './SignInScreen.module.css'

export interface SignInScreenProps {
  error: EmailError | null
  onSubmit: (email: string) => void
  sending: boolean
}

const ERRORS: Record<EmailError, { title: string; body?: string }> = {
  not_allowed: {
    title: "This email isn't on the list.",
    body: 'Ask Matthew or Heathyr to add you, then try again.',
  },
  invalid_email: { title: "That doesn't look like an email address." },
  unavailable: {
    title: UNREACHABLE,
    body: CHECK_CONNECTION,
  },
}

export const SignInScreen = ({
  error,
  onSubmit,
  sending,
}: SignInScreenProps) => {
  const [email, setEmail] = useState('')
  const canSubmit = !sending && email.trim().includes('@')
  const message = error ? ERRORS[error] : null

  const handleEmailChange = (event: ChangeEvent<HTMLInputElement>) => {
    setEmail(event.target.value)
  }

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    if (canSubmit) onSubmit(email)
  }

  return (
    <AuthLayout>
      <div className={styles.brand}>
        <div aria-hidden="true" className={styles.logo}>
          <span className={styles.logoDot} />S
        </div>
        <h1 className={styles.name}>Soul Search</h1>
        <p className={styles.tagline}>A new Kia Soul challenge every week.</p>
      </div>
      <form className={styles.form} noValidate onSubmit={handleSubmit}>
        <TextField
          aria-invalid={message ? true : undefined}
          autoCapitalize="none"
          autoComplete="email"
          className={sending ? styles.sendingEmail : undefined}
          hint={
            message
              ? undefined
              : "We'll email you a 6-digit code. Type it in here to sign in. No password to remember."
          }
          inputMode="email"
          label="Your email"
          onChange={handleEmailChange}
          readOnly={sending}
          spellCheck={false}
          type="email"
          value={email}
        />
        {message && <FormError title={message.title}>{message.body}</FormError>}
        <div className={styles.spacer} />
        {sending ? (
          <LoadingStatus label="Sending your code…" />
        ) : (
          <Button disabled={!canSubmit} type="submit">
            Email me a code
          </Button>
        )}
        <p className={styles.footnote}>Soul Search is invite-only.</p>
      </form>
    </AuthLayout>
  )
}
