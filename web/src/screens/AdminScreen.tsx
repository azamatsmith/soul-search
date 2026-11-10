import { PushedScreen } from '../components/PushedScreen'
import styles from './AdminScreen.module.css'

export const AdminScreen = () => (
  <PushedScreen backLabel="Settings" backTo="/settings" title="Admin tools">
    <p className={styles.note}>
      Flagged photos, challenges and the rest of the admin tools are coming
      soon.
    </p>
  </PushedScreen>
)
