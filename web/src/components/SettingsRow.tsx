import { ChevronRight } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router'
import styles from './SettingsRow.module.css'

export interface SettingsRowProps {
  subtitle: string
  title: string
  to?: string
  trailing?: ReactNode
}

export const SettingsRow = ({
  subtitle,
  title,
  to,
  trailing,
}: SettingsRowProps) => {
  const body = (
    <>
      <span className={styles.text}>
        <span className={styles.title}>{title}</span>
        <span className={styles.subtitle}>{subtitle}</span>
      </span>
      {trailing}
      {to && <ChevronRight aria-hidden className={styles.chevron} />}
    </>
  )

  return to ? (
    <Link className={styles.row} to={to}>
      {body}
    </Link>
  ) : (
    <div className={styles.row}>{body}</div>
  )
}
