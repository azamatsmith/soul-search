import styles from './LoadingScreen.module.css'
import { RollingCar } from './RollingCar'

export const LoadingScreen = () => (
  <main className={styles.screen}>
    <div className={styles.status} role="status">
      <RollingCar size="large" />
      Loading Soul Search…
    </div>
  </main>
)
