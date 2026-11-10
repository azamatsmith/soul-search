import { Button } from '../Button'
import { StepHeading } from './StepHeading'
import styles from './PhotoReview.module.css'

export interface PhotoReviewProps {
  onRetake: () => void
  onUse: () => void
  photoUrl: string
}

export const PhotoReview = ({
  onRetake,
  onUse,
  photoUrl,
}: PhotoReviewProps) => (
  <main className={styles.screen}>
    <StepHeading step="Step 1 of 2" title="Can you see the Soul?" />
    <img
      alt="The photo you just took"
      className={styles.photo}
      src={photoUrl}
    />
    <p className={styles.helper}>
      Make sure the whole car is in the photo and not blurry.
    </p>
    <Button onClick={onUse}>Use this photo</Button>
    <Button onClick={onRetake} variant="secondary">
      Take it again
    </Button>
  </main>
)
