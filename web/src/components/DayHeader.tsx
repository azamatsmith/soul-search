import styles from './DayHeader.module.css'

export interface DayHeaderProps {
  children: string
}

export const DayHeader = ({ children }: DayHeaderProps) => (
  <h2 className={styles.header}>
    <span className={styles.label}>{children}</span>
    <span aria-hidden="true" className={styles.rule} />
  </h2>
)
