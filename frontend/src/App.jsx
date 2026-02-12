import { Navigate, Route, Routes } from 'react-router-dom'
import ProtectedRoute from './components/ProtectedRoute'
import { useAuth } from './context/useAuth'
import LoginPage from './pages/LoginPage'
import SalesmanPage from './pages/SalesmanPage'
import AdminInsightsPage from './pages/AdminInsightsPage'
import AdminSalesmenStatusPage from './pages/AdminSalesmenStatusPage'

function LoadingScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="rounded-xl border border-slate-200 bg-white p-6 text-center shadow-sm">
        <h1 className="text-lg font-semibold text-slate-900">Loading app</h1>
        <p className="mt-2 text-sm text-slate-600">Checking authentication state...</p>
      </div>
    </div>
  )
}

function RoleHomeRedirect() {
  const { status, user } = useAuth()

  if (status === 'loading') {
    return <LoadingScreen />
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  return <Navigate to={user.role === 'admin' ? '/admin/insights' : '/salesman'} replace />
}

function LoginRoute() {
  const { status, user } = useAuth()

  if (status === 'loading') {
    return <LoadingScreen />
  }

  if (user) {
    return <Navigate to={user.role === 'admin' ? '/admin/insights' : '/salesman'} replace />
  }

  return <LoginPage />
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<RoleHomeRedirect />} />
      <Route path="/login" element={<LoginRoute />} />

      <Route element={<ProtectedRoute allowedRoles={['salesman', 'admin']} />}>
        <Route path="/salesman" element={<SalesmanPage />} />
      </Route>

      <Route element={<ProtectedRoute allowedRoles={['admin']} />}>
        <Route path="/admin" element={<Navigate to="/admin/insights" replace />} />
        <Route path="/admin/insights" element={<AdminInsightsPage />} />
        <Route path="/admin/salesmen-status" element={<AdminSalesmenStatusPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
