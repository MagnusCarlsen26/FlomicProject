import { Navigate, Route, Routes } from 'react-router-dom'
import ProtectedRoute from './components/ProtectedRoute'
import AppShell from './components/layout/AppShell'
import PageEnter from './components/motion/PageEnter'
import { useAuth } from './context/useAuth'
import LoginPage from './pages/LoginPage'
import SalesmanPage from './pages/SalesmanPage'
import AdminInsightsPage from './pages/AdminInsightsPage'
import AdminSalesmenStatusPage from './pages/AdminSalesmenStatusPage'
import AdminStage1PlanActualPage from './pages/AdminStage1PlanActualPage'
import AdminStage2ActivityCompliancePage from './pages/AdminStage2ActivityCompliancePage'
import AdminStage3PlannedNotVisitedPage from './pages/AdminStage3PlannedNotVisitedPage'
import AdminStage4EnquiryEffectivenessPage from './pages/AdminStage4EnquiryEffectivenessPage'
import { getDefaultRoute } from './utils/roles'

function LoadingScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <PageEnter>
        <div className="glass-card w-full max-w-md rounded-3xl p-7 text-center">
          <h1 className="text-xl font-semibold text-text-primary">Loading app</h1>
          <p className="mt-2 text-sm text-text-secondary">Checking authentication state...</p>
        </div>
      </PageEnter>
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

  return <Navigate to={getDefaultRoute(user)} replace />
}

function LoginRoute() {
  const { status, user } = useAuth()

  if (status === 'loading') {
    return <LoadingScreen />
  }

  if (user) {
    return <Navigate to={getDefaultRoute(user)} replace />
  }

  return <LoginPage />
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<RoleHomeRedirect />} />
      <Route path="/login" element={<LoginRoute />} />

      <Route element={<ProtectedRoute allowedRoles={['salesman', 'admin']} />}>
        <Route element={<AppShell />}>
          <Route path="/salesman" element={<SalesmanPage />} />
        </Route>
      </Route>

      <Route element={<ProtectedRoute allowedRoles={['admin']} />}>
        <Route element={<AppShell />}>
          <Route path="/admin" element={<Navigate to="/admin/stage1-plan-actual" replace />} />
          <Route path="/admin/stage1-plan-actual" element={<AdminStage1PlanActualPage />} />
          <Route path="/admin/stage2-activity-compliance" element={<AdminStage2ActivityCompliancePage />} />
          <Route path="/admin/stage3-planned-not-visited" element={<AdminStage3PlannedNotVisitedPage />} />
          <Route path="/admin/stage4-enquiry-effectiveness" element={<AdminStage4EnquiryEffectivenessPage />} />
          <Route path="/admin/insights" element={<AdminInsightsPage />} />
          <Route path="/admin/salesmen-status" element={<AdminSalesmenStatusPage />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
