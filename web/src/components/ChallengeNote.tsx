import { useId } from 'react'
import type { Period } from '../lib/api'
import { noteBody } from '../lib/noteCopy'
import styles from './ChallengeNote.module.css'

export interface ChallengeNoteProps {
  now: number
  period: Period
}

export const ChallengeNote = ({ now, period }: ChallengeNoteProps) => {
  const titleId = useId()

  return (
    <div aria-labelledby={titleId} className={styles.note} role="note">
      <h2 className={styles.title} id={titleId}>
        <span className={styles.live}>LIVE</span>{' '}
        <span className={styles.name}>{period.name ?? 'A challenge'}</span>
      </h2>
      <p className={styles.body}>{noteBody(period, now)}</p>
    </div>
  )
}
