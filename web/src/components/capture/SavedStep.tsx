import { pointsText } from '../../lib/claim'
import { Button } from '../Button'
import styles from './SavedStep.module.css'

export interface SavedStepProps {
  challengeName: string | null
  claimType: 'regular' | 'special'
  falseCall: number
  onDone: () => void
  onSnapAnother: () => void
  periodPoints: number
  points: number
}

const totalText = (points: number, challengeName: string | null) => {
  const unit = points === 1 ? 'point' : 'points'
  return challengeName
    ? `You have ${points} ${challengeName} ${unit}.`
    : `You have ${points} ${unit} this week.`
}

export const SavedStep = ({
  challengeName,
  claimType,
  falseCall,
  onDone,
  onSnapAnother,
  periodPoints,
  points,
}: SavedStepProps) => (
  <main className={styles.screen}>
    <div className={styles.body}>
      <span aria-hidden className={styles.check}>
        ✓
      </span>
      <h1 className={styles.kicker}>
        {claimType === 'special' ? 'Special Soul saved' : 'Soul saved'}
      </h1>
      <span className={styles.points}>+{points}</span>
      <p className={styles.total}>{totalText(periodPoints, challengeName)}</p>
      <p className={styles.note}>
        We'll double-check the photo. If it isn't a Kia Soul, it becomes a{' '}
        {pointsText(falseCall)} in Sightings.
      </p>
    </div>
    <div className={styles.actions}>
      <Button className={styles.again} onClick={onSnapAnother}>
        Snap another Soul
      </Button>
      <Button className={styles.done} onClick={onDone} variant="secondary">
        Done
      </Button>
    </div>
  </main>
)
