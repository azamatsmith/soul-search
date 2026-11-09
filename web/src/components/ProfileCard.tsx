import { initialOf } from '../lib/initialOf'
import styles from './ProfileCard.module.css'

export interface ProfileCardProps {
  email: string
  name: string
}

export const ProfileCard = ({ email, name }: ProfileCardProps) => (
  <div className={styles.card}>
    <span aria-hidden className={styles.avatar}>
      {initialOf(name)}
    </span>
    <span className={styles.text}>
      <span className={styles.name}>{name}</span>
      <span className={styles.email}>{email}</span>
    </span>
  </div>
)
