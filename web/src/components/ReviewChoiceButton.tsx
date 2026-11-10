import type { ReviewChoice } from '../lib/reviewCopy'
import styles from './ReviewChoiceButton.module.css'

export interface ReviewChoiceButtonProps {
  choice: ReviewChoice
  disabled: boolean
  onChoose: (choice: ReviewChoice) => void
}

export const ReviewChoiceButton = ({
  choice,
  disabled,
  onChoose,
}: ReviewChoiceButtonProps) => {
  const handleClick = () => onChoose(choice)

  return (
    <button
      className={`${styles.choice} ${styles[choice.tone]}`}
      disabled={disabled}
      onClick={handleClick}
      type="button"
    >
      <span className={styles.label}>{choice.label}</span>
      <span className={styles.hint}>{choice.hint}</span>
    </button>
  )
}
