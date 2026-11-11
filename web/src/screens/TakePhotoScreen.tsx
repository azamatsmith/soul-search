import { CameraButton } from '../components/CameraButton'
import { HomeHeader } from '../components/HomeHeader'
import { HomeHeaderPlaceholder } from '../components/HomeHeaderPlaceholder'
import { LoadError } from '../components/LoadError'
import { SummaryCard } from '../components/SummaryCard'
import { useApiResource } from '../hooks/useApiResource'
import { useMeContext } from '../hooks/useMeContext'
import { useNow } from '../hooks/useNow'
import { getPeriod, getStanding } from '../lib/api'
import styles from './TakePhotoScreen.module.css'

export const TakePhotoScreen = () => {
  const { me } = useMeContext()
  const now = useNow()
  const period = useApiResource(['period'], getPeriod)
  const standing = useApiResource(['standing'], getStanding)
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
          <LoadError onRetry={handleRetry} thing="your points" />
        </div>
      )}
      {period.data && standing.data && (
        <SummaryCard period={period.data} standing={standing.data} />
      )}
    </div>
  )
}
