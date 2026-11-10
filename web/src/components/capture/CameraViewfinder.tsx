import { useEffect, useRef } from 'react'
import styles from './CameraViewfinder.module.css'

export interface CameraViewfinderProps {
  onCancel: () => void
  onShutter: (video: HTMLVideoElement) => void
  stream: MediaStream | null
}

export const CameraViewfinder = ({
  onCancel,
  onShutter,
  stream,
}: CameraViewfinderProps) => {
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    const video = videoRef.current
    if (!video || !stream) return
    video.srcObject = stream
    video.play().catch(() => {})
    return () => {
      video.srcObject = null
    }
  }, [stream])

  const handleShutter = () => {
    if (videoRef.current) onShutter(videoRef.current)
  }

  return (
    <main className={styles.screen}>
      <h1 className={styles.title}>Take photo</h1>
      <p className={styles.hint}>Fit the whole car in the frame</p>
      <div className={styles.frame}>
        <video
          aria-label="Camera view"
          autoPlay
          className={styles.video}
          muted
          playsInline
          ref={videoRef}
        />
        <span aria-hidden className={`${styles.corner} ${styles.topLeft}`} />
        <span aria-hidden className={`${styles.corner} ${styles.topRight}`} />
        <span aria-hidden className={`${styles.corner} ${styles.bottomLeft}`} />
        <span
          aria-hidden
          className={`${styles.corner} ${styles.bottomRight}`}
        />
      </div>
      <div className={styles.controls}>
        <button className={styles.cancel} onClick={onCancel} type="button">
          Cancel
        </button>
        <button
          aria-label="Take photo"
          className={styles.shutter}
          disabled={!stream}
          onClick={handleShutter}
          type="button"
        />
      </div>
    </main>
  )
}
