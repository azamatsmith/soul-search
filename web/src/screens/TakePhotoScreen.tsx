import { ScreenTitle } from '../components/ScreenTitle'
import { useApiHealth } from '../hooks/useApiHealth'
import styles from './TakePhotoScreen.module.css'

export const TakePhotoScreen = () => {
  const status = useApiHealth(import.meta.env.VITE_API_URL)
  const label = status === 'checking' ? 'checking...' : status

  return (
    <>
      <ScreenTitle kicker="Soul Search" title="Take photo" />
      <p className={styles.status}>API: {label}</p>
    </>
  )
}
