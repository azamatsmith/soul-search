import { Button } from '../Button'
import styles from './CameraBlocked.module.css'

export interface CameraBlockedProps {
  onNativeCamera: () => void
  onTryAgain: () => void
  reason: 'denied' | 'unavailable'
}

const STEPS = [
  <>
    Open the <b>Settings</b> app
  </>,
  <>
    Tap <b>Apps</b>, then <b>Safari</b>
  </>,
  <>
    Tap <b>Camera</b> and choose <b>Allow</b>
  </>,
  <>Come back here and try again</>,
]

export const CameraBlocked = ({
  onNativeCamera,
  onTryAgain,
  reason,
}: CameraBlockedProps) => (
  <main className={styles.screen}>
    {reason === 'denied' ? (
      <>
        <h1 className={styles.title}>The camera is turned off</h1>
        <p className={styles.intro}>
          You can turn it back on in your iPhone settings:
        </p>
        <ol className={styles.steps}>
          {STEPS.map((step, index) => (
            <li className={styles.step} key={index}>
              <span aria-hidden className={styles.number}>
                {index + 1}
              </span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
      </>
    ) : (
      <>
        <h1 className={styles.title}>The camera didn't start</h1>
        <p className={styles.intro}>
          You can still take the photo with the iPhone camera.
        </p>
      </>
    )}
    <div className={styles.spacer} />
    <Button onClick={onNativeCamera}>Use the iPhone camera instead</Button>
    <Button onClick={onTryAgain} variant="secondary">
      {reason === 'denied' ? 'I turned it on. Try again' : 'Try again'}
    </Button>
  </main>
)
