import { AuthLayout } from './AuthLayout'
import { Button } from './Button'
import { FormError } from './FormError'

export interface UnreachableScreenProps {
  onRetry: () => void
}

export const UnreachableScreen = ({ onRetry }: UnreachableScreenProps) => (
  <AuthLayout>
    <FormError title="We couldn't reach Soul Search.">
      Check your connection and try again.
    </FormError>
    <Button onClick={onRetry}>Try again</Button>
  </AuthLayout>
)
