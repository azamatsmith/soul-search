import type { ReactNode } from 'react'
import styles from './FormError.module.css'

export interface FormErrorProps {
  children?: ReactNode
  title: string
}

export const FormError = ({ children, title }: FormErrorProps) => (
  <div className={styles.box} role="alert">
    <div className={styles.text}>
      <span className={styles.title}>{title}</span>
      {children && <span className={styles.body}>{children}</span>}
    </div>
  </div>
)
