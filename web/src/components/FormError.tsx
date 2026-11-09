import type { ReactNode } from 'react'
import styles from './FormError.module.css'

export interface FormErrorProps {
  title: string
  children?: ReactNode
}

export const FormError = ({ title, children }: FormErrorProps) => (
  <div role="alert" className={styles.box}>
    <span className={styles.icon} aria-hidden="true">
      !
    </span>
    <div className={styles.text}>
      <span className={styles.title}>{title}</span>
      {children && <span className={styles.body}>{children}</span>}
    </div>
  </div>
)
