import { Button } from '../Button'
import styles from './NotSentStep.module.css'

export interface NotSentStepProps {
  onLater: () => void
  onTryAgain: () => void
}

export const NotSentStep = ({ onLater, onTryAgain }: NotSentStepProps) => (
  <main className={styles.screen}>
    <div className={styles.body}>
      <span aria-hidden className={styles.alert}>
        !
      </span>
      <h1 className={styles.title}>Your photo didn't send</h1>
      <p className={styles.text}>
        Don't worry, it's saved on this phone. We'll send it on our own when you
        have signal.
      </p>
    </div>
    <div className={styles.actions}>
      <Button onClick={onTryAgain}>Try again now</Button>
      <Button onClick={onLater} variant="secondary">
        OK, send it later
      </Button>
    </div>
  </main>
)
