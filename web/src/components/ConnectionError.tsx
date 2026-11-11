import { CHECK_CONNECTION, SAVE_FAILED, UNREACHABLE } from '../lib/errorCopy'
import { FormError } from './FormError'

export interface ConnectionErrorProps {
  kind: 'save' | 'unreachable'
}

export const ConnectionError = ({ kind }: ConnectionErrorProps) => (
  <FormError title={kind === 'save' ? SAVE_FAILED : UNREACHABLE}>
    {CHECK_CONNECTION}
  </FormError>
)
