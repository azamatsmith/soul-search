import { useRef, type ChangeEvent } from 'react'
import { useNavigate } from 'react-router'
import { CameraBlocked } from '../components/capture/CameraBlocked'
import { CameraIntro } from '../components/capture/CameraIntro'
import { CameraViewfinder } from '../components/capture/CameraViewfinder'
import { ClaimForm } from '../components/capture/ClaimForm'
import { NotSentStep } from '../components/capture/NotSentStep'
import { PhotoReview } from '../components/capture/PhotoReview'
import { SavedStep } from '../components/capture/SavedStep'
import { SendingStep } from '../components/capture/SendingStep'
import { FormError } from '../components/FormError'
import { useApiResource } from '../hooks/useApiResource'
import { useCameraStream } from '../hooks/useCameraStream'
import { useCapture } from '../hooks/useCapture'
import { useLocation } from '../hooks/useLocation'
import { useMeContext } from '../hooks/useMeContext'
import { useSendSighting } from '../hooks/useSendSighting'
import { getPeriod } from '../lib/api'
import { fileToJpeg, frameToJpeg } from '../lib/photo'
import styles from './CaptureScreen.module.css'

export const CaptureScreen = () => {
  const navigate = useNavigate()
  const capture = useCapture()
  const camera = useCameraStream(capture.step === 'camera', capture.attempt)
  const location = useLocation(capture.step !== 'intro')
  const period = useApiResource(['period'], getPeriod)
  const nativeCamera = useRef<HTMLInputElement>(null)
  const { me } = useMeContext()
  const sender = useSendSighting(me.id)

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
    const { category, claimType, photo } = capture
    if (!photo || !claimType) return
    await sender.send({
      categories: claimType === 'special' && category ? [category] : [],
      claimType,
      id: photo.id,
      location,
      photo: photo.blob,
      takenAt: photo.takenAt,
    })
  }

  const handleSnapAnother = () => {
    sender.reset()
    capture.startOver()
  }

  const blocked = camera.status === 'denied' || camera.status === 'unavailable'
  const photoUrl = capture.photo?.url ?? ''

  if (sender.status === 'sending')
    return <SendingStep photoUrl={photoUrl} progress={sender.progress} />
  if (sender.status === 'failed') {
    return <NotSentStep onLater={goHome} onTryAgain={sender.retry} />
  }
  if (sender.status === 'saved' && sender.saved) {
    return (
      <SavedStep
        challengeName={period.data?.name ?? null}
        claimType={sender.saved.sighting.claim_type}
        onDone={goHome}
        onSnapAnother={handleSnapAnother}
        periodPoints={sender.saved.period_points}
        points={sender.saved.sighting.points}
      />
    )
  }

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
          category={capture.category}
          claimType={capture.claimType}
          onCategoryChange={capture.setCategory}
          onClaimTypeChange={capture.chooseClaimType}
          onSend={handleSend}
          photoUrl={capture.photo.url}
          rules={period.data.rules}
        />
      )}
      {capture.step === 'claim' && period.status === 'error' && (
        <div className={styles.message}>
          <FormError title="Couldn't load the point values">
            Check your Wi-Fi or signal, then try again.
          </FormError>
        </div>
      )}
      {sender.status === 'rejected' && (
        <div className={styles.message}>
          <FormError title="This photo can't be used">
            Please take it again.
          </FormError>
        </div>
      )}
    </div>
  )
}
