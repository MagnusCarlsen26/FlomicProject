import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../context/useAuth'

function FullPageMessage({ title, subtitle }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 text-center shadow-sm">
        <h1 className="text-xl font-semibold text-slate-900">{title}</h1>
        {subtitle && <p className="mt-2 text-sm text-slate-600">{subtitle}</p>}
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

  if (allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
    const fallbackPath = user.role === 'admin' ? '/admin' : '/salesman'
    return <Navigate to={fallbackPath} replace />
  }

  return children || <Outlet />
}
