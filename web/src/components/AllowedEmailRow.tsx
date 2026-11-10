import { useState } from 'react'
import type { AllowedEmail } from '../lib/api'
import styles from './AllowedEmailRow.module.css'

export interface AllowedEmailRowProps {
  entry: AllowedEmail
  isMe: boolean
  onRemove: (email: string) => Promise<void>
}

export const AllowedEmailRow = ({
  entry,
  isMe,
  onRemove,
}: AllowedEmailRowProps) => {
  const [confirming, setConfirming] = useState(false)
  const [removing, setRemoving] = useState(false)
  const joined = entry.display_name !== null

  const remove = async () => {
    setRemoving(true)
    await onRemove(entry.email)
    setRemoving(false)
    setConfirming(false)
  }

  const handleRemoveClick = () => {
    if (joined) setConfirming(true)
    else void remove()
  }

  const handleKeepClick = () => setConfirming(false)

  const handleConfirmClick = () => {
    void remove()
  }

  return (
    <li className={styles.row}>
      <div className={styles.main}>
        <span className={styles.text}>
          <span className={styles.email}>{entry.email}</span>
          <span className={styles.meta}>
            <span className={joined ? styles.joined : styles.waiting}>
              {joined ? 'Joined' : 'Not signed in yet'}
            </span>
            {joined && (
              <span className={styles.name}>{entry.display_name}</span>
            )}
          </span>
        </span>
        {!isMe && !confirming && (
          <button
            className={styles.action}
            disabled={removing}
            onClick={handleRemoveClick}
            type="button"
          >
            Remove
          </button>
        )}
      </div>
      {confirming && (
        <div className={styles.confirm}>
          <p className={styles.warning}>
            {entry.display_name} will be signed out. Their photos and points
            stay.
          </p>
          <div className={styles.choices}>
            <button
              className={styles.action}
              disabled={removing}
              onClick={handleConfirmClick}
              type="button"
            >
              Yes, remove
            </button>
            <button
              className={styles.keep}
              disabled={removing}
              onClick={handleKeepClick}
              type="button"
            >
              Keep
            </button>
          </div>
        </div>
      )}
    </li>
  )
}
