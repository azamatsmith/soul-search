import { PushedScreen } from '../components/PushedScreen'
import { SettingsRow } from '../components/SettingsRow'
import { useApiResource } from '../hooks/useApiResource'
import { getAllowedEmails, getPointRules } from '../lib/api'
import { peopleCount } from '../lib/peopleCount'
import { rulesSummary } from '../lib/rulesSummary'
import styles from './AdminScreen.module.css'

export const AdminScreen = () => {
  const emails = useApiResource(getAllowedEmails)
  const rules = useApiResource(getPointRules)
  const emailsSubtitle = emails.data
    ? peopleCount(emails.data.emails.length)
    : 'Who can sign in'
  const rulesSubtitle = rules.data
    ? rulesSummary(rules.data)
    : 'Points for each photo'

  return (
    <PushedScreen
      backLabel="Settings"
      backTo="/settings"
      kicker="Admins only"
      title="Admin tools"
    >
      <div className={styles.card}>
        <SettingsRow
          subtitle={rulesSubtitle}
          title="Points & categories"
          to="/admin/points"
        />
        <SettingsRow
          subtitle={emailsSubtitle}
          title="Allowed emails"
          to="/admin/emails"
        />
      </div>
      <p className={styles.note}>
        Every change here is saved to the change history with your name.
      </p>
    </PushedScreen>
  )
}
