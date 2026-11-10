import { ChevronLeft } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router'
import styles from './PushedScreen.module.css'

export interface PushedScreenProps {
  backLabel: string
  backTo: string
  children: ReactNode
  kicker?: string
  title: string
}

export const PushedScreen = ({
  backLabel,
  backTo,
  children,
  kicker,
  title,
}: PushedScreenProps) => (
  <div className={styles.screen}>
    <nav className={styles.nav}>
      <Link className={styles.back} to={backTo}>
        <ChevronLeft aria-hidden className={styles.backIcon} />
        {backLabel}
      </Link>
    </nav>
    <main className={styles.content}>
      <header className={styles.heading}>
        {kicker && <p className={styles.kicker}>{kicker}</p>}
        <h1 className={styles.title}>{title}</h1>
      </header>
      {children}
    </main>
  </div>
)
