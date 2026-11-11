import { useState } from 'react'
import { Button } from './Button'
import styles from './DeleteChallenge.module.css'

export interface DeleteChallengeProps {
  busy: boolean
  name: string
  onConfirm: () => void
}

export const DeleteChallenge = ({
  busy,
  name,
  onConfirm,
}: DeleteChallengeProps) => {
  const [confirming, setConfirming] = useState(false)
  const handleAskClick = () => setConfirming(true)
  const handleKeepClick = () => setConfirming(false)

  if (!confirming) {
    return (
      <Button onClick={handleAskClick} variant="link">
        Delete challenge
      </Button>
    )
  }

  return (
    <div aria-label="Confirm delete" className={styles.confirm} role="group">
      <p className={styles.question}>
        Delete {name}? Its photos go back to their weeks.
      </p>
      <div className={styles.actions}>
        <Button disabled={busy} onClick={onConfirm} variant="danger">
          Delete
        </Button>
        <Button onClick={handleKeepClick} variant="secondary">
          Keep it
        </Button>
      </div>
    </div>
  )
}
