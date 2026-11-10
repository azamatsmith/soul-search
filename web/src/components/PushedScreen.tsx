import { ChevronLeft } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router'
import styles from './PushedScreen.module.css'

export interface PushedScreenProps {
  backLabel: string
  backTo: string
  children: ReactNode
  title: string
}

export const PushedScreen = ({
  backLabel,
  backTo,
  children,
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
      <h1 className={styles.title}>{title}</h1>
      {children}
    </main>
  </div>
)
