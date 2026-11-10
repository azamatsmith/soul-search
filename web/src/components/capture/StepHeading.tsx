import styles from './StepHeading.module.css'

export interface StepHeadingProps {
  step: string
  title: string
}

export const StepHeading = ({ step, title }: StepHeadingProps) => (
  <div className={styles.heading}>
    <span className={styles.step}>{step}</span>
    <h1 className={styles.title}>{title}</h1>
  </div>
)
