import { useLocation } from 'react-router-dom'
import { useAuth } from '../context/useAuth'

export default function LoginPage() {
  const location = useLocation()
  const { error, refreshSession } = useAuth()
  const fromPath = location.state?.from?.pathname

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-100 to-white px-4 py-12">
      <div className="mx-auto w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-medium uppercase tracking-wide text-slate-500">Flomic</p>
        <h1 className="mt-2 text-2xl font-semibold text-slate-900">Sign in</h1>
        <p className="mt-2 text-sm text-slate-600">
          Phase 1 routing scaffold is active. Google sign-in wiring arrives in Phase 2.
        </p>

        {fromPath && (
          <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            You need to sign in to access <span className="font-medium">{fromPath}</span>.
          </div>
        )}

        {error && (
          <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
            Session check error: {error}
          </div>
        )}

        <button
          type="button"
          disabled
          className="mt-6 w-full cursor-not-allowed rounded-lg border border-slate-300 bg-slate-100 px-4 py-3 text-sm font-medium text-slate-500"
        >
          Continue with Google (Phase 2)
        </button>

        <button
          type="button"
          onClick={refreshSession}
          className="mt-3 w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-sm font-medium text-slate-900 transition hover:bg-slate-50"
        >
          Retry session check
        </button>
      </div>
    </div>
  )
}
