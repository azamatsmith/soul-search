import { Link } from 'react-router'
import styles from './EmptyState.module.css'

export interface EmptyStateProps {
  body: string
  title: string
}

export const EmptyState = ({ body, title }: EmptyStateProps) => (
  <div className={styles.empty}>
    <span aria-hidden="true" className={styles.mark}>
      S
    </span>
    <h2 className={styles.title}>{title}</h2>
    <p className={styles.body}>{body}</p>
    <Link className={styles.action} to="/capture">
      Take a photo
    </Link>
  </div>
)
