import { useId } from 'react'
import type { Period } from '../lib/api'
import { noteBody, noteTitle } from '../lib/noteCopy'
import styles from './ChallengeNote.module.css'

export interface ChallengeNoteProps {
  now: number
  period: Period
}

export const ChallengeNote = ({ now, period }: ChallengeNoteProps) => {
  const titleId = useId()

  return (
    <section aria-labelledby={titleId} className={styles.note}>
      <h2 className={styles.title} id={titleId}>
        {noteTitle(period.name ?? 'A challenge')}
      </h2>
      <p className={styles.body}>{noteBody(period, now)}</p>
    </section>
  )
}
