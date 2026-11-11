import { CountBadge } from '../components/CountBadge'
import { PushedScreen } from '../components/PushedScreen'
import { SettingsRow } from '../components/SettingsRow'
import { useApiResource } from '../hooks/useApiResource'
import { getAllowedEmails, getPointRules, getReviewQueue } from '../lib/api'
import { peopleCount } from '../lib/peopleCount'
import { rulesSummary } from '../lib/rulesSummary'
import styles from './AdminScreen.module.css'

export const AdminScreen = () => {
  const emails = useApiResource(['allowedEmails'], getAllowedEmails)
  const rules = useApiResource(['pointRules'], getPointRules)
  const queue = useApiResource(['reviewQueue'], getReviewQueue)
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
          subtitle="Waiting for a person to look"
          title="Flagged photos"
          to="/admin/flagged"
          trailing={<CountBadge count={queue.data?.flagged.length ?? 0} />}
        />
        <SettingsRow
          subtitle="Timed events with their own rules"
          title="Challenges"
          to="/admin/challenges"
        />
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
        <SettingsRow
          subtitle="Add or take away points"
          title="Adjust a score"
          to="/admin/adjust"
        />
        <SettingsRow
          subtitle="Who changed what, and when"
          title="Change history"
          to="/admin/history"
        />
      </div>
      <p className={styles.note}>
        Every change here is saved to the change history with your name.
      </p>
    </PushedScreen>
  )
}
