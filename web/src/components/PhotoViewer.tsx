import { useId, useRef, useState } from 'react'
import { useModalLayer } from '../hooks/useModalLayer'
import { usePinchZoom } from '../hooks/usePinchZoom'
import { useStatusBarColor } from '../hooks/useStatusBarColor'
import {
  type LogCard,
  viewerClaimLine,
  viewerNote,
  viewerTime,
} from '../lib/sightingsCopy'
import styles from './PhotoViewer.module.css'
import { StatusChip } from './StatusChip'

export interface PhotoViewerProps {
  card: LogCard
  onClose: () => void
}

export const PhotoViewer = ({ card, onClose }: PhotoViewerProps) => {
  const closeRef = useRef<HTMLButtonElement>(null)
  const nameId = useId()
  const [loadedUrl, setLoadedUrl] = useState<string | null>(null)
  const zoom = usePinchZoom()
  useModalLayer(closeRef, onClose)
  useStatusBarColor('--c-camera')

  const fullUrl = card.fullPhotoUrl ?? card.photoUrl
  const loaded = loadedUrl === fullUrl
  const note = viewerNote(card)

  const handleFullLoad = () => setLoadedUrl(fullUrl)

  return (
    <div
      aria-labelledby={nameId}
      aria-modal="true"
      className={styles.viewer}
      role="dialog"
    >
      <div className={styles.bar}>
        <button
          className={styles.close}
          onClick={onClose}
          ref={closeRef}
          type="button"
        >
          Close
        </button>
      </div>
      <div className={styles.frame} {...zoom.handlers}>
        <div className={styles.stage} style={zoom.style}>
          {!loaded && card.photoUrl && (
            <img alt="" className={styles.photo} src={card.photoUrl} />
          )}
          {fullUrl && (
            <img
              alt={`Photo from ${card.name}`}
              className={loaded ? styles.photo : styles.loading}
              draggable={false}
              onLoad={handleFullLoad}
              src={fullUrl}
            />
          )}
        </div>
      </div>
      <div className={styles.panel}>
        <div className={styles.top}>
          <span className={styles.name} id={nameId}>
            {card.name}
          </span>
          <span className={styles.time}>{viewerTime(card.takenAt)}</span>
        </div>
        <span className={styles.claim}>{viewerClaimLine(card)}</span>
        <StatusChip card={card} />
        {note && (
          <p className={`${styles.note} ${styles[card.kind]}`} role="note">
            {note}
          </p>
        )}
      </div>
    </div>
  )
}
