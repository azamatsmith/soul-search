import { useRef, useState, type ChangeEvent } from 'react'
import { useNavigate } from 'react-router'
import { CameraBlocked } from '../components/capture/CameraBlocked'
import { CameraIntro } from '../components/capture/CameraIntro'
import { CameraViewfinder } from '../components/capture/CameraViewfinder'
import { ClaimForm } from '../components/capture/ClaimForm'
import { PhotoReview } from '../components/capture/PhotoReview'
import { FormError } from '../components/FormError'
import { useApiResource } from '../hooks/useApiResource'
import { useCameraStream } from '../hooks/useCameraStream'
import { useCapture } from '../hooks/useCapture'
import { useLocation } from '../hooks/useLocation'
import { getPeriod, postSighting } from '../lib/api'
import { fileToJpeg, frameToJpeg } from '../lib/photo'
import styles from './CaptureScreen.module.css'

export const CaptureScreen = () => {
  const navigate = useNavigate()
  const capture = useCapture()
  const camera = useCameraStream(capture.step === 'camera', capture.attempt)
  const location = useLocation(capture.step !== 'intro')
  const period = useApiResource(getPeriod)
  const nativeCamera = useRef<HTMLInputElement>(null)
  const [sending, setSending] = useState(false)
  const [sendFailed, setSendFailed] = useState(false)

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

  const handleSend = async () => {
    const { categories, claimType, photo } = capture
    if (!photo || !claimType) return
    setSending(true)
    setSendFailed(false)
    const result = await postSighting({
      categories: claimType === 'special' ? categories : [],
      claimType,
      id: photo.id,
      location,
      photo: photo.blob,
      takenAt: photo.takenAt,
    })
    setSending(false)
    if (result.ok) goHome()
    else setSendFailed(true)
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
      {capture.step === 'claim' && capture.photo && period.data && (
        <ClaimForm
          categories={capture.categories}
          claimType={capture.claimType}
          onCategoryToggle={capture.toggleCategory}
          onClaimTypeChange={capture.setClaimType}
          onSend={handleSend}
          photoUrl={capture.photo.url}
          rules={period.data.rules}
          sending={sending}
        />
      )}
      {capture.step === 'claim' && period.status === 'error' && (
        <div className={styles.message}>
          <FormError title="Couldn't load the point values">
            Check your Wi-Fi or signal, then try again.
          </FormError>
        </div>
      )}
      {sendFailed && (
        <div className={styles.message}>
          <FormError title="Your photo didn't send">
            Check your Wi-Fi or signal, then try again.
          </FormError>
        </div>
      )}
    </div>
  )
}
