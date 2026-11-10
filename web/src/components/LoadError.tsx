import { Button } from './Button'
import { FormError } from './FormError'
import styles from './LoadError.module.css'

export interface LoadErrorProps {
  onRetry: () => void
  thing: string
}

export const LoadError = ({ onRetry, thing }: LoadErrorProps) => (
  <div className={styles.error}>
    <FormError title={`Couldn't load ${thing}`}>
      Check your Wi-Fi or signal, then try again. Your photos are safe.
    </FormError>
    <Button onClick={onRetry}>Try again</Button>
  </div>
)
