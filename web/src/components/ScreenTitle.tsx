import type { ReactNode } from 'react'
import styles from './ScreenTitle.module.css'

interface ScreenTitleProps {
  action?: ReactNode
  kicker?: string
  title: string
}

export const ScreenTitle = ({ action, kicker, title }: ScreenTitleProps) => (
  <header className={styles.header}>
    <div className={styles.text}>
      {kicker && <p className={styles.kicker}>{kicker}</p>}
      <h1 className={styles.title}>{title}</h1>
    </div>
    {action}
  </header>
)
