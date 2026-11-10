import styles from './SendingStep.module.css'

export interface SendingStepProps {
  photoUrl: string
}

export const SendingStep = ({ photoUrl }: SendingStepProps) => (
  <main aria-busy="true" className={styles.screen}>
    <img alt="" className={styles.photo} src={photoUrl} />
    <h1 className={styles.title}>Sending your photo…</h1>
    <span aria-hidden className={styles.track}>
      <span className={styles.bar} />
    </span>
    <p className={styles.note}>
      Keep the app open. This usually takes a few seconds.
    </p>
  </main>
)
