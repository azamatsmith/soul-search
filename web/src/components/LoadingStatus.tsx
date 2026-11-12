import { RollingCar } from './RollingCar'
import styles from './LoadingStatus.module.css'

export interface LoadingStatusProps {
  label: string
}

export const LoadingStatus = ({ label }: LoadingStatusProps) => (
  <div className={styles.status} role="status">
    <RollingCar size="small" />
    {label}
  </div>
)
