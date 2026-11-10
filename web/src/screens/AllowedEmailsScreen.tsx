import { AddEmailForm } from '../components/AddEmailForm'
import { AllowedEmailRow } from '../components/AllowedEmailRow'
import { FormError } from '../components/FormError'
import { LoadError } from '../components/LoadError'
import { PushedScreen } from '../components/PushedScreen'
import { useAllowedEmails } from '../hooks/useAllowedEmails'
import { useMeContext } from '../hooks/useMeContext'
import { peopleCount } from '../lib/peopleCount'
import styles from './AllowedEmailsScreen.module.css'

export const AllowedEmailsScreen = () => {
  const { me } = useMeContext()
  const { emails, handleAdded, handleRemove, removeFailed, retry, status } =
    useAllowedEmails()
  const myEmail = me.email.trim().toLowerCase()

  return (
    <PushedScreen
      backLabel="Admin tools"
      backTo="/admin"
      kicker={emails ? peopleCount(emails.length) : undefined}
      title="Allowed emails"
    >
      {status === 'error' && !emails && (
        <LoadError onRetry={retry} thing="allowed emails" />
      )}
      {emails && (
        <>
          <AddEmailForm onAdded={handleAdded} />
          {removeFailed && (
            <FormError title="We couldn't save that.">
              Check your connection and try again.
            </FormError>
          )}
          <ul className={styles.list}>
            {emails.map((entry) => (
              <AllowedEmailRow
                entry={entry}
                isMe={entry.email === myEmail}
                key={entry.email}
                onRemove={handleRemove}
              />
            ))}
          </ul>
        </>
      )}
    </PushedScreen>
  )
}
