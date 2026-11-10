import styles from './StepHeading.module.css'

export interface StepHeadingProps {
  size?: 'h1' | 'h2'
  step: string
  title: string
}

export const StepHeading = ({ size = 'h1', step, title }: StepHeadingProps) => (
  <div className={styles.heading}>
    <span className={styles.step}>{step}</span>
    <h1
      className={
        size === 'h1' ? styles.title : `${styles.title} ${styles.small}`
      }
    >
      {title}
    </h1>
  </div>
)
