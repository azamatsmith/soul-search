import { useState, type ChangeEvent, type FormEvent } from 'react'
import { AuthLayout } from '../components/AuthLayout'
import { Button } from '../components/Button'
import { FormError } from '../components/FormError'
import { TextField } from '../components/TextField'
import { useMeContext } from '../hooks/useMeContext'
import { putDisplayName } from '../lib/api'
import {
  validateDisplayName,
  type DisplayNameError,
} from '../lib/validateDisplayName'
import styles from './WelcomeScreen.module.css'

type NameError = DisplayNameError | 'name_taken' | 'unavailable'

const nameErrorText = (error: NameError, name: string): string | undefined => {
  switch (error) {
    case 'too_short':
      return 'Names need at least 2 characters.'
    case 'too_long':
      return 'Names can be up to 20 characters.'
    case 'invalid':
      return "Use only letters, numbers, spaces and . ' -"
    case 'name_taken':
      return `Someone already goes by “${name}”. Try adding a last initial, like “${name} K.”`
    default:
      return undefined
  }
}

const serverError = (code: string): NameError => {
  if (code === 'name_taken' || code === 'too_short' || code === 'invalid') {
    return code
  }
  return 'unavailable'
}

export const WelcomeScreen = () => {
  const { setMe } = useMeContext()
  const [name, setName] = useState('')
  const [error, setError] = useState<NameError | null>(null)
  const [submittedName, setSubmittedName] = useState('')
  const [saving, setSaving] = useState(false)

  const handleNameChange = (event: ChangeEvent<HTMLInputElement>) => {
    setName(event.target.value)
    setError(null)
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    if (saving) return
    const checked = validateDisplayName(name)
    if (!checked.ok) {
      setError(checked.error)
      return
    }
    setSaving(true)
    setSubmittedName(checked.name)
    const result = await putDisplayName(checked.name)
    setSaving(false)
    if (result.ok) {
      setMe(result.data)
    } else {
      setError(serverError(result.error))
    }
  }

  return (
    <AuthLayout kicker="Welcome!" title="What should we call you?">
      <form className={styles.form} onSubmit={handleSubmit} noValidate>
        <p className={styles.lead}>
          This is how other players see you on the leaderboard.
        </p>
        <TextField
          label="Your name"
          autoComplete="nickname"
          value={name}
          onChange={handleNameChange}
          hint="2 to 20 characters. You can change it later in Settings."
          error={error ? nameErrorText(error, submittedName) : undefined}
        />
        {error === 'unavailable' && (
          <FormError title="We couldn't reach Soul Search.">
            Check your connection and try again.
          </FormError>
        )}
        <div className={styles.spacer} />
        <Button type="submit" disabled={saving}>
          Let's go
        </Button>
      </form>
    </AuthLayout>
  )
}
