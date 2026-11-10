import { useRef, type ChangeEvent } from 'react'
import { useNavigate } from 'react-router'
import { CameraBlocked } from '../components/capture/CameraBlocked'
import { CameraIntro } from '../components/capture/CameraIntro'
import { CameraViewfinder } from '../components/capture/CameraViewfinder'
import { PhotoReview } from '../components/capture/PhotoReview'
import { useCameraStream } from '../hooks/useCameraStream'
import { useCapture } from '../hooks/useCapture'
import { fileToJpeg, frameToJpeg } from '../lib/photo'
import styles from './CaptureScreen.module.css'

export const CaptureScreen = () => {
  const navigate = useNavigate()
  const capture = useCapture()
  const camera = useCameraStream(capture.step === 'camera', capture.attempt)
  const nativeCamera = useRef<HTMLInputElement>(null)

  const goHome = () => navigate('/')
  const openNativeCamera = () => nativeCamera.current?.click()

  const handleShutter = async (video: HTMLVideoElement) => {
    capture.keepPhoto(await frameToJpeg(video))
  }

  const handleNativePhoto = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (file) capture.keepPhoto(await fileToJpeg(file))
  }

  const blocked = camera.status === 'denied' || camera.status === 'unavailable'

  return (
    <div
      className={
        capture.step === 'camera' && !blocked ? styles.dark : styles.light
      }
    >
      <input
        accept="image/*"
        capture="environment"
        className={styles.nativeCamera}
        data-testid="native-camera"
        onChange={handleNativePhoto}
        ref={nativeCamera}
        tabIndex={-1}
        type="file"
      />
      {capture.step === 'intro' && (
        <CameraIntro onContinue={capture.continueFromIntro} onNotNow={goHome} />
      )}
      {capture.step === 'camera' &&
        (blocked ? (
          <CameraBlocked
            onNativeCamera={openNativeCamera}
            onTryAgain={capture.retryCamera}
            reason={camera.status === 'denied' ? 'denied' : 'unavailable'}
          />
        ) : (
          <CameraViewfinder
            onCancel={goHome}
            onShutter={handleShutter}
            stream={camera.stream}
          />
        ))}
      {capture.step === 'review' && capture.photo && (
        <PhotoReview
          onRetake={capture.retake}
          onUse={capture.choosePhoto}
          photoUrl={capture.photo.url}
        />
      )}
    </div>
  )
}
