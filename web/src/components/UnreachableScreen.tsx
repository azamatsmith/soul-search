import { AuthLayout } from './AuthLayout'
import { Button } from './Button'
import { ConnectionError } from './ConnectionError'

export interface UnreachableScreenProps {
  onRetry: () => void
}

export const UnreachableScreen = ({ onRetry }: UnreachableScreenProps) => (
  <AuthLayout>
    <ConnectionError kind="unreachable" />
    <Button onClick={onRetry}>Try again</Button>
  </AuthLayout>
)
