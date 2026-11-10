import { Link } from 'react-router'
import { initialOf } from '../lib/initialOf'
import styles from './AvatarButton.module.css'

export interface AvatarButtonProps {
  name: string | null
}

export const AvatarButton = ({ name }: AvatarButtonProps) => (
  <Link
    aria-label="Settings and profile"
    className={styles.button}
    to="/settings"
  >
    <span aria-hidden>{initialOf(name)}</span>
  </Link>
)
