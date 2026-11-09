import { useState, type ChangeEvent, type FormEvent } from 'react'
import { AuthLayout } from '../components/AuthLayout'
import { Button } from '../components/Button'
import { FormError } from '../components/FormError'
import { TextField } from '../components/TextField'
import type { EmailError } from '../hooks/useSignIn'
import styles from './SignInScreen.module.css'

export interface SignInScreenProps {
  sending: boolean
  error: EmailError | null
  onSubmit: (email: string) => void
}

const ERRORS: Record<EmailError, { title: string; body?: string }> = {
  not_allowed: {
    title: "This email isn't on the list.",
    body: 'Ask Matthew or Heathyr to add you, then try again.',
  },
  invalid_email: { title: "That doesn't look like an email address." },
  unavailable: {
    title: "We couldn't reach Soul Search.",
    body: 'Check your connection and try again.',
  },
}

export const SignInScreen = ({
  sending,
  error,
  onSubmit,
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
        <div className={styles.logo} aria-hidden="true">
          <span className={styles.logoDot} />S
        </div>
        <h1 className={styles.name}>Soul Search</h1>
        <p className={styles.tagline}>A new Kia Soul challenge every week.</p>
      </div>
      <form className={styles.form} onSubmit={handleSubmit} noValidate>
        <TextField
          label="Your email"
          type="email"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="none"
          spellCheck={false}
          value={email}
          onChange={handleEmailChange}
          aria-invalid={message ? true : undefined}
          hint={
            message
              ? undefined
              : "We'll email you a 6-digit code. Type it in here to sign in. No password to remember."
          }
        />
        {message && <FormError title={message.title}>{message.body}</FormError>}
        <div className={styles.spacer} />
        <Button type="submit" disabled={!canSubmit}>
          Email me a code
        </Button>
        <p className={styles.footnote}>Soul Search is invite-only.</p>
      </form>
    </AuthLayout>
  )
}
