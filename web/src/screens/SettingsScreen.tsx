import { useState } from 'react'
import { Button } from '../components/Button'
import { CountBadge } from '../components/CountBadge'
import { FormError } from '../components/FormError'
import { ProfileCard } from '../components/ProfileCard'
import { PushedScreen } from '../components/PushedScreen'
import { SettingsRow } from '../components/SettingsRow'
import { ToggleSwitch } from '../components/ToggleSwitch'
import { useMeContext } from '../hooks/useMeContext'
import { putTextSize } from '../lib/api'
import { supabase } from '../lib/supabase'
import styles from './SettingsScreen.module.css'

const flaggedText = (count: number) => {
  if (count === 0) return 'Nothing to look at'
  return count === 1 ? '1 photo to look at' : `${count} photos to look at`
}

export const SettingsScreen = () => {
  const { me, setMe } = useMeContext()
  const [saving, setSaving] = useState(false)
  const [saveFailed, setSaveFailed] = useState(false)
  const flagged = me.flagged_count ?? 0

  const handleLargeTextChange = async (large: boolean) => {
    setSaving(true)
    setSaveFailed(false)
    setMe({ ...me, text_size: large ? 'large' : 'standard' })
    const result = await putTextSize(large ? 'large' : 'standard')
    setSaving(false)
    if (result.ok) {
      setMe(result.data)
    } else {
      setMe(me)
      setSaveFailed(true)
    }
  }

  const handleSignOut = () => {
    void supabase.auth.signOut()
  }

  return (
    <PushedScreen backLabel="Home" backTo="/" title="Settings">
      <ProfileCard email={me.email} name={me.display_name ?? ''} />
      <div className={styles.card}>
        <SettingsRow
          subtitle={me.display_name ?? ''}
          title="Your name"
          to="/settings/name"
        />
        <SettingsRow
          subtitle="Bigger words and buttons"
          title="Large text"
          trailing={
            <ToggleSwitch
              checked={me.text_size === 'large'}
              disabled={saving}
              label="Large text"
              onChange={handleLargeTextChange}
            />
          }
        />
      </div>
      {saveFailed && (
        <FormError title="We couldn't save that.">
          Check your connection and try again.
        </FormError>
      )}
      {me.is_admin && (
        <section className={styles.admin}>
          <h2 className={styles.label}>Only admins see this</h2>
          <div className={styles.card}>
            <SettingsRow
              subtitle={flaggedText(flagged)}
              title="Admin tools"
              to="/admin"
              trailing={<CountBadge count={flagged} />}
            />
          </div>
        </section>
      )}
      <div className={styles.spacer} />
      <Button onClick={handleSignOut} variant="danger">
        Sign out
      </Button>
      <p className={styles.version}>Version {__APP_VERSION__}</p>
    </PushedScreen>
  )
}
