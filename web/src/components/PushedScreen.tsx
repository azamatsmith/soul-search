import { ChevronLeft } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router'
import styles from './PushedScreen.module.css'

export interface PushedScreenProps {
  backLabel: string
  backTo: string
  children: ReactNode
  inTabs?: boolean
  kicker?: string
  title: string
}

export const PushedScreen = ({
  backLabel,
  backTo,
  children,
  inTabs = false,
  kicker,
  title,
}: PushedScreenProps) => {
  const Content = inTabs ? 'div' : 'main'
  const screenClass = inTabs
    ? `${styles.screen} ${styles.inTabs}`
    : styles.screen

  return (
    <div className={screenClass}>
      <nav className={styles.nav}>
        <Link className={styles.back} to={backTo}>
          <ChevronLeft aria-hidden className={styles.backIcon} />
          {backLabel}
        </Link>
      </nav>
      <Content className={styles.content}>
        <header className={styles.heading}>
          {kicker && <p className={styles.kicker}>{kicker}</p>}
          <h1 className={styles.title}>{title}</h1>
        </header>
        {children}
      </Content>
    </div>
  )
}
