import { useNavigate } from 'react-router'
import { Button } from '../components/Button'
import { FormError } from '../components/FormError'
import { PushedScreen } from '../components/PushedScreen'
import { TextField } from '../components/TextField'
import { useDisplayNameForm } from '../hooks/useDisplayNameForm'
import { useMeContext } from '../hooks/useMeContext'
import type { Me } from '../lib/api'
import styles from './ChangeNameScreen.module.css'

export const ChangeNameScreen = () => {
  const { me, setMe } = useMeContext()
  const navigate = useNavigate()

  const handleSaved = (saved: Me) => {
    setMe(saved)
    void navigate('/settings')
  }

  const {
    fieldError,
    handleNameChange,
    handleSubmit,
    name,
    saving,
    unavailable,
  } = useDisplayNameForm({
    initialName: me.display_name ?? '',
    onSaved: handleSaved,
  })

  return (
    <PushedScreen
      backLabel="Settings"
      backTo="/settings"
      title="Change your name"
    >
      <form className={styles.form} noValidate onSubmit={handleSubmit}>
        <p className={styles.lead}>
          Other players see this on the leaderboard and in Sightings.
        </p>
        <TextField
          autoComplete="nickname"
          error={fieldError}
          hint="2 to 20 characters."
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
          Save name
        </Button>
      </form>
    </PushedScreen>
  )
}
