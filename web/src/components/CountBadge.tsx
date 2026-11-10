import styles from './CountBadge.module.css'

export interface CountBadgeProps {
  count: number
}

export const CountBadge = ({ count }: CountBadgeProps) =>
  count > 0 && <span className={styles.badge}>{count}</span>
