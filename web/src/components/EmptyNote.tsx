import type { ReactNode } from 'react'
import styles from './EmptyNote.module.css'

export interface EmptyNoteProps {
  children: ReactNode
}

export const EmptyNote = ({ children }: EmptyNoteProps) => (
  <p className={styles.note}>{children}</p>
)
