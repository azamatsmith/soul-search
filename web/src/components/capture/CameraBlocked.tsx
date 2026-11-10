import { isAndroid } from '../../lib/platform'
import { Button } from '../Button'
import styles from './CameraBlocked.module.css'

export interface CameraBlockedProps {
  onNativeCamera: () => void
  onTryAgain: () => void
  reason: 'denied' | 'unavailable'
}

const IPHONE_STEPS = [
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

const ANDROID_STEPS = [
  <>
    Open the <b>Chrome</b> app
  </>,
  <>
    Tap <b>⋮</b>, then <b>Settings</b>, then <b>Site settings</b>
  </>,
  <>
    Tap <b>Camera</b>, find Soul Search and choose <b>Allow</b>
  </>,
  <>Come back here and try again</>,
]

const IPHONE_COPY = {
  camera: 'the iPhone camera',
  settings: 'your iPhone settings',
  steps: IPHONE_STEPS,
}

const ANDROID_COPY = {
  camera: "your phone's camera",
  settings: 'your phone settings',
  steps: ANDROID_STEPS,
}

export const CameraBlocked = ({
  onNativeCamera,
  onTryAgain,
  reason,
}: CameraBlockedProps) => {
  const copy = isAndroid() ? ANDROID_COPY : IPHONE_COPY
  const nativeCameraLabel = `Use ${copy.camera} instead`

  return (
    <main className={styles.screen}>
      {reason === 'denied' ? (
        <>
          <h1 className={styles.title}>The camera is turned off</h1>
          <p className={styles.intro}>
            You can turn it back on in {copy.settings}:
          </p>
          <ol className={styles.steps}>
            {copy.steps.map((step, index) => (
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
            You can still take the photo with {copy.camera}.
          </p>
        </>
      )}
      <div className={styles.spacer} />
      <Button onClick={onNativeCamera}>{nativeCameraLabel}</Button>
      <Button onClick={onTryAgain} variant="secondary">
        {reason === 'denied' ? 'I turned it on. Try again' : 'Try again'}
      </Button>
    </main>
  )
}
