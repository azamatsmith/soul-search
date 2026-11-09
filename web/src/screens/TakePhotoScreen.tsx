import { AvatarButton } from '../components/AvatarButton'
import { ScreenTitle } from '../components/ScreenTitle'
import { useApiHealth } from '../hooks/useApiHealth'
import { useMeContext } from '../hooks/useMeContext'
import styles from './TakePhotoScreen.module.css'

export const TakePhotoScreen = () => {
  const { me } = useMeContext()
  const status = useApiHealth(import.meta.env.VITE_API_URL)
  const label = status === 'checking' ? 'checking...' : status

  return (
    <>
      <ScreenTitle
        action={<AvatarButton name={me.display_name} />}
        kicker="Soul Search"
        title="Take photo"
      />
      <p className={styles.status}>API: {label}</p>
    </>
  )
}
