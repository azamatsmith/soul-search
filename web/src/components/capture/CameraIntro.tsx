import { isAndroid } from '../../lib/platform'
import { Button } from '../Button'
import styles from './CameraIntro.module.css'

export interface CameraIntroProps {
  onContinue: () => void
  onNotNow: () => void
}

export const CameraIntro = ({ onContinue, onNotNow }: CameraIntroProps) => (
  <main className={styles.screen}>
    <div className={styles.body}>
      <span aria-hidden className={styles.icon}>
        <span className={styles.glyph}>
          <span className={styles.lens} />
        </span>
      </span>
      <h1 className={styles.title}>Soul Search needs your camera</h1>
      <p className={styles.why}>
        So you can take photos of the Souls you spot. We only use it when you
        tap Take photo.
      </p>
      <p className={styles.next}>
        Next, your {isAndroid() ? 'phone' : 'iPhone'} will ask. Tap <b>Allow</b>
        .
      </p>
    </div>
    <Button onClick={onContinue}>Continue</Button>
    <Button onClick={onNotNow} variant="link">
      Not now
    </Button>
  </main>
)
