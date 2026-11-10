import { useState, type ChangeEvent, type FormEvent } from 'react'
import { addAllowedEmail, type AllowedEmail } from '../lib/api'
import { Button } from './Button'
import { FormError } from './FormError'
import { TextField } from './TextField'
import styles from './AddEmailForm.module.css'

export interface AddEmailFormProps {
  onAdded: (entry: AllowedEmail) => void
}

const FIELD_ERRORS: Partial<Record<string, string>> = {
  already_allowed: 'That email is already on the list.',
  invalid_email: 'Check the email address.',
}

export const AddEmailForm = ({ onAdded }: AddEmailFormProps) => {
  const [email, setEmail] = useState('')
  const [fieldError, setFieldError] = useState<string>()
  const [failed, setFailed] = useState(false)
  const [saving, setSaving] = useState(false)

  const handleEmailChange = (event: ChangeEvent<HTMLInputElement>) => {
    setEmail(event.target.value)
    setFieldError(undefined)
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSaving(true)
    setFailed(false)
    const result = await addAllowedEmail(email)
    setSaving(false)
    if (result.ok) {
      setEmail('')
      onAdded(result.data)
      return
    }
    const message = FIELD_ERRORS[result.error]
    if (message) setFieldError(message)
    else setFailed(true)
  }

  return (
    <form className={styles.form} noValidate onSubmit={handleSubmit}>
      <TextField
        autoCapitalize="none"
        autoComplete="off"
        error={fieldError}
        inputMode="email"
        label="Add someone"
        onChange={handleEmailChange}
        type="email"
        value={email}
      />
      <Button disabled={saving || email.trim() === ''} type="submit">
        Add to the list
      </Button>
      {failed && (
        <FormError title="We couldn't save that.">
          Check your connection and try again.
        </FormError>
      )}
      <p className={styles.note}>
        They can sign in once they're on the list. We don't send an invite; tell
        them to open the app.
      </p>
    </form>
  )
}
