import { formatCountdown, useCountdown } from '../hooks/useCountdown'
import { Button } from './Button'

export interface LockoutCountdownProps {
  lockedUntil: string
  onRetry: () => void
}

export const LockoutCountdown = ({
  lockedUntil,
  onRetry,
}: LockoutCountdownProps) => {
  const secondsLeft = useCountdown(lockedUntil)

  if (secondsLeft > 0) {
    return <Button disabled>Try again in {formatCountdown(secondsLeft)}</Button>
  }

  return <Button onClick={onRetry}>Email me a new code</Button>
}
