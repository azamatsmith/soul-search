import { Navigate, Outlet } from 'react-router'
import { useMeContext } from '../hooks/useMeContext'

export const RequireAdmin = () => {
  const context = useMeContext()
  if (!context.me.is_admin) return <Navigate replace to="/" />
  return <Outlet context={context} />
}
