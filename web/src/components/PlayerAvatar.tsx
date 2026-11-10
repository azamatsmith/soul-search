import { avatarTone } from '../lib/avatarTone'
import { initialOf } from '../lib/initialOf'
import styles from './PlayerAvatar.module.css'

export interface PlayerAvatarProps {
  id: string
  name: string
}

export const PlayerAvatar = ({ id, name }: PlayerAvatarProps) => {
  const tone = avatarTone(id)
  return (
    <span
      aria-hidden="true"
      className={`${styles.avatar} ${styles[tone]}`}
      data-tone={tone}
    >
      {initialOf(name)}
    </span>
  )
}
