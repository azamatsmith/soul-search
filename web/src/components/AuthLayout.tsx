import type { ReactNode } from 'react'
import styles from './AuthLayout.module.css'

export interface AuthLayoutProps {
  kicker?: string
  title?: string
  children: ReactNode
}

export const AuthLayout = ({ kicker, title, children }: AuthLayoutProps) => (
  <main className={styles.screen}>
    {title && (
      <header className={styles.header}>
        {kicker && <p className={styles.kicker}>{kicker}</p>}
        <h1 className={styles.title}>{title}</h1>
      </header>
    )}
    {children}
  </main>
)
