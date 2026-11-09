import { Navigate, Outlet } from 'react-router'
import { useSession } from '../hooks/useSession'

export const RedirectIfSignedIn = () => {
  const session = useSession()
  if (session.status === 'loading') return null
  if (session.status === 'signed_in' || session.status === 'unreachable') {
    return <Navigate to="/" replace />
  }
  return <Outlet />
}
