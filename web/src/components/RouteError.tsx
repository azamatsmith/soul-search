import { useEffect } from 'react'
import { useLocation, useNavigate, useRouteError } from 'react-router'
import { Button } from './Button'
import styles from './RouteError.module.css'

export interface RouteErrorProps {
  fullPage?: boolean
}

export const RouteError = ({ fullPage = false }: RouteErrorProps) => {
  const error = useRouteError()
  const location = useLocation()
  const navigate = useNavigate()
  const atHome = location.pathname === '/'

  useEffect(() => {
    console.error(`Screen crashed at ${location.pathname}`, error)
  }, [error, location.pathname])

  const handleTryAgain = () => {
    navigate(`${location.pathname}${location.search}`, { replace: true })
  }

  const handleGoHome = () => {
    navigate('/')
  }

  return (
    <div
      className={
        fullPage ? `${styles.screen} ${styles.fullPage}` : styles.screen
      }
    >
      <div className={styles.body}>
        <span aria-hidden className={styles.alert}>
          !
        </span>
        <h1 className={styles.title}>Something went wrong</h1>
        <p className={styles.text}>
          This screen hit a problem. Your photos are safe.
        </p>
      </div>
      <div className={styles.actions}>
        <Button onClick={handleTryAgain}>Try again</Button>
        {!atHome && (
          <Button onClick={handleGoHome} variant="secondary">
            Back to Home
          </Button>
        )}
      </div>
    </div>
  )
}
