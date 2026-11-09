import { useSignIn } from '../hooks/useSignIn'
import { CodeScreen } from './CodeScreen'
import { SignInScreen } from './SignInScreen'

export const SignInPage = () => {
  const { state, submitEmail, submitCode, resendCode, changeEmail } =
    useSignIn()

  if (state.step === 'email') {
    return (
      <SignInScreen
        sending={state.sending}
        error={state.error}
        onSubmit={submitEmail}
      />
    )
  }

  return (
    <CodeScreen
      state={state}
      onSubmitCode={submitCode}
      onResend={resendCode}
      onChangeEmail={changeEmail}
    />
  )
}
