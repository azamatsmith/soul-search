import { Link } from 'react-router'
import { initialOf } from '../lib/initialOf'
import styles from './AvatarButton.module.css'

export interface AvatarButtonProps {
  name: string | null
}

export const AvatarButton = ({ name }: AvatarButtonProps) => (
  <Link aria-label="Settings" className={styles.button} to="/settings">
    <span aria-hidden className={styles.avatar}>
      {initialOf(name)}
    </span>
  </Link>
)
