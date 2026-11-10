import { useEffect, useState } from 'react'
import { hasSeenCameraIntro, markCameraIntroSeen } from '../lib/camera'

export type CaptureStep = 'intro' | 'camera' | 'review' | 'claim'

export interface CapturedPhoto {
  blob: Blob
  id: string
  takenAt: string
  url: string
}

export const useCapture = () => {
  const [step, setStep] = useState<CaptureStep>(() =>
    hasSeenCameraIntro() ? 'camera' : 'intro',
  )
  const [attempt, setAttempt] = useState(0)
  const [photo, setPhoto] = useState<CapturedPhoto | null>(null)

  useEffect(() => {
    if (!photo) return
    return () => URL.revokeObjectURL(photo.url)
  }, [photo])

  const continueFromIntro = () => {
    markCameraIntroSeen()
    setStep('camera')
  }

  const retryCamera = () => {
    setAttempt((count) => count + 1)
    setStep('camera')
  }

  const keepPhoto = (blob: Blob) => {
    setPhoto({
      blob,
      id: crypto.randomUUID(),
      takenAt: new Date().toISOString(),
      url: URL.createObjectURL(blob),
    })
    setStep('review')
  }

  const retake = () => {
    setPhoto(null)
    setStep('camera')
  }

  const choosePhoto = () => setStep('claim')

  return {
    attempt,
    continueFromIntro,
    keepPhoto,
    photo,
    retake,
    retryCamera,
    step,
    choosePhoto,
  }
}
