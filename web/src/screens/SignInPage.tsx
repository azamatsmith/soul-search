import { useSignIn } from '../hooks/useSignIn'
import { CodeScreen } from './CodeScreen'
import { SignInScreen } from './SignInScreen'

export const SignInPage = () => {
  const { state, submitEmail, submitCode, resendCode, changeEmail } =
    useSignIn()

  if (state.step === 'email') {
    return (
      <SignInScreen
        error={state.error}
        onSubmit={submitEmail}
        sending={state.sending}
      />
    )
  }

  return (
    <CodeScreen
      onChangeEmail={changeEmail}
      onResend={resendCode}
      onSubmitCode={submitCode}
      state={state}
    />
  )
}
