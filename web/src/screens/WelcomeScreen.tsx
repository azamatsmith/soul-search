import { AuthLayout } from '../components/AuthLayout'
import { Button } from '../components/Button'
import { FormError } from '../components/FormError'
import { TextField } from '../components/TextField'
import { useDisplayNameForm } from '../hooks/useDisplayNameForm'
import { useMeContext } from '../hooks/useMeContext'
import styles from './WelcomeScreen.module.css'

export const WelcomeScreen = () => {
  const { setMe } = useMeContext()
  const {
    fieldError,
    handleNameChange,
    handleSubmit,
    name,
    saving,
    unavailable,
  } = useDisplayNameForm({ initialName: '', onSaved: setMe })

  return (
    <AuthLayout kicker="Welcome!" title="What should we call you?">
      <form className={styles.form} noValidate onSubmit={handleSubmit}>
        <p className={styles.lead}>
          This is how other players see you on the leaderboard.
        </p>
        <TextField
          autoComplete="nickname"
          error={fieldError}
          hint="2 to 20 characters. You can change it later in Settings."
          label="Your name"
          onChange={handleNameChange}
          value={name}
        />
        {unavailable && (
          <FormError title="We couldn't reach Soul Search.">
            Check your connection and try again.
          </FormError>
        )}
        <div className={styles.spacer} />
        <Button disabled={saving} type="submit">
          Let's go
        </Button>
      </form>
    </AuthLayout>
  )
}
