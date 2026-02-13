import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../context/useAuth'
import { getDefaultRoute, hasAnyRole } from '../utils/roles'

function FullPageMessage({ title, subtitle }) {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="glass-card w-full max-w-md rounded-3xl p-6 text-center">
        <h1 className="text-xl font-semibold text-text-primary">{title}</h1>
        {subtitle ? <p className="mt-2 text-sm text-text-secondary">{subtitle}</p> : null}
      </div>
    </div>
  )
}

export default function ProtectedRoute({ allowedRoles = [], children }) {
  const location = useLocation()
  const { status, user } = useAuth()

  if (status === 'loading') {
    return <FullPageMessage title="Checking session" subtitle="Please wait..." />
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  if (!hasAnyRole(user, allowedRoles)) {
    return <Navigate to={getDefaultRoute(user)} replace />
  }

  return children || <Outlet />
}
