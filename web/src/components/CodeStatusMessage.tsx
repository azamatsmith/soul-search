import type { CodeState } from '../hooks/useSignIn'
import { ConnectionError } from './ConnectionError'
import { FormError } from './FormError'
import { LoadingStatus } from './LoadingStatus'

export interface CodeStatusMessageProps {
  state: CodeState
}

const triesText = (triesLeft: number | null) => {
  if (triesLeft === null) return 'Check the email and try again.'
  const noun = triesLeft === 1 ? 'try' : 'tries'
  return `Check the email and try again. ${triesLeft} ${noun} left.`
}

export const CodeStatusMessage = ({ state }: CodeStatusMessageProps) => {
  switch (state.status) {
    case 'checking':
      return <LoadingStatus label="Checking your code…" />
    case 'wrong':
      return (
        <FormError title="That code isn't right.">
          {triesText(state.triesLeft)}
        </FormError>
      )
    case 'expired':
      return (
        <FormError title="Codes only work for 10 minutes.">
          Get a new one and we'll email it right away.
        </FormError>
      )
    case 'locked':
      return (
        <FormError title="Please wait 15 minutes.">
          For safety, sign-in is paused after 5 wrong codes. Then ask for a new
          code.
        </FormError>
      )
    case 'too_soon':
      return (
        <FormError title="A code is already on its way.">
          Wait a minute before asking for another one.
        </FormError>
      )
    case 'unavailable':
      return <ConnectionError kind="unreachable" />
    default:
      return null
  }
}
