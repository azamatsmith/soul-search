import styles from './ScreenTitle.module.css'

interface ScreenTitleProps {
  kicker: string
  title: string
}

export const ScreenTitle = ({ kicker, title }: ScreenTitleProps) => (
  <header className={styles.header}>
    <p className={styles.kicker}>{kicker}</p>
    <h1 className={styles.title}>{title}</h1>
  </header>
)
