import { RollingCar } from '../RollingCar'
import styles from './SendingStep.module.css'

export interface SendingStepProps {
  photoUrl: string
  progress: number
}

export const SendingStep = ({ photoUrl, progress }: SendingStepProps) => (
  <main aria-busy="true" className={styles.screen}>
    <img alt="" className={styles.photo} src={photoUrl} />
    <div role="status">
      <h1 className={styles.title}>Sending your photo…</h1>
    </div>
    <div aria-hidden="true" className={styles.progress}>
      <RollingCar progress={progress} size="large" />
      <span className={styles.track}>
        <span
          className={styles.bar}
          data-progress-bar
          style={{ width: `${Math.round(Math.min(1, progress) * 100)}%` }}
        />
      </span>
    </div>
    <p className={styles.note}>
      Keep the app open. This usually takes a few seconds.
    </p>
  </main>
)
