import { useEffect } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router'
import type { MeOutletContext } from '../hooks/useMeContext'
import { useMe } from '../hooks/useMe'
import { useSession } from '../hooks/useSession'
import { useTextSize } from '../hooks/useTextSize'
import { supabase } from '../lib/supabase'
import { AuthLayout } from './AuthLayout'
import { Button } from './Button'
import { FormError } from './FormError'

const WELCOME_PATH = '/welcome'

export const RequireAuth = () => {
  const session = useSession()
  const userId = session.status === 'signed_in' ? session.session.user.id : null
  const { status, me, error, setMe, retry } = useMe(userId)
  const { pathname } = useLocation()
  const revoked = error === 'not_allowed' || error === 'unauthenticated'

  useTextSize(me?.text_size ?? 'standard')

  useEffect(() => {
    if (revoked) void supabase.auth.signOut({ scope: 'local' })
  }, [revoked])

  if (session.status === 'signed_out') {
    return <Navigate to="/sign-in" replace />
  }
  if (status === 'error' && !revoked) {
    return (
      <AuthLayout>
        <FormError title="We couldn't reach Soul Search.">
          Check your connection and try again.
        </FormError>
        <Button onClick={retry}>Try again</Button>
      </AuthLayout>
    )
  }
  if (!me) return null
  if (!me.display_name && pathname !== WELCOME_PATH) {
    return <Navigate to={WELCOME_PATH} replace />
  }
  if (me.display_name && pathname === WELCOME_PATH) {
    return <Navigate to="/" replace />
  }

  const context: MeOutletContext = { me, setMe }
  return <Outlet context={context} />
}
