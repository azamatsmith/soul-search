import { Button } from '../components/Button'
import { CameraButton } from '../components/CameraButton'
import { FormError } from '../components/FormError'
import { HomeHeader } from '../components/HomeHeader'
import { HomeHeaderPlaceholder } from '../components/HomeHeaderPlaceholder'
import { SummaryCard } from '../components/SummaryCard'
import { useApiResource } from '../hooks/useApiResource'
import { useMeContext } from '../hooks/useMeContext'
import { useNow } from '../hooks/useNow'
import { getPeriod, getStanding } from '../lib/api'
import styles from './TakePhotoScreen.module.css'

export const TakePhotoScreen = () => {
  const { me } = useMeContext()
  const now = useNow()
  const period = useApiResource(getPeriod)
  const standing = useApiResource(getStanding)
  const failed = period.status === 'error' || standing.status === 'error'

  const handleRetry = () => {
    if (period.status === 'error') period.retry()
    if (standing.status === 'error') standing.retry()
  }

  return (
    <div className={styles.screen}>
      <h1 className={styles.title}>Take photo</h1>
      {period.data && standing.data ? (
        <HomeHeader
          name={me.display_name}
          now={now}
          period={period.data}
          standing={standing.data}
        />
      ) : (
        <HomeHeaderPlaceholder name={me.display_name} />
      )}
      <div className={styles.center}>
        <CameraButton />
        <p className={styles.helper}>
          Spotted one? Tap the big button, point, and shoot.
        </p>
      </div>
      {failed && (
        <div className={styles.error}>
          <FormError title="Couldn't load your points">
            Check your Wi-Fi or signal, then try again. Your photos are safe.
          </FormError>
          <Button onClick={handleRetry}>Try again</Button>
        </div>
      )}
      {period.data && standing.data && (
        <SummaryCard period={period.data} standing={standing.data} />
      )}
    </div>
  )
}
