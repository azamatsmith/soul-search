import { Navigate, Outlet } from 'react-router'
import { useSession } from '../hooks/useSession'
import { LoadingScreen } from './LoadingScreen'

export const RedirectIfSignedIn = () => {
  const session = useSession()
  if (session.status === 'loading') return <LoadingScreen />
  if (session.status === 'signed_in' || session.status === 'unreachable') {
    return <Navigate replace to="/" />
  }
  return <Outlet />
}
