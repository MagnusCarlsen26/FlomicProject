import { useAuth } from '../context/useAuth'

function ReadOnlyBlock({ title, children }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  )
}

export default function AdminPage() {
  const { user, signOut } = useAuth()

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-8">
      <div className="mx-auto w-full max-w-6xl space-y-6">
        <header className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium uppercase tracking-wide text-slate-500">Admin</p>
              <h1 className="text-2xl font-semibold text-slate-900">Salesmen Status Dashboard</h1>
              <p className="mt-1 text-sm text-slate-600">
                Signed in as {user?.name || user?.email || 'Unknown user'}
              </p>
            </div>
            <button
              type="button"
              onClick={signOut}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-900 transition hover:bg-slate-100"
            >
              Logout
            </button>
          </div>
        </header>

        <ReadOnlyBlock title="Filters (Read-only shell)">
          <div className="grid gap-3 md:grid-cols-3">
            <input
              type="text"
              placeholder="Search salesperson"
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              disabled
            />
            <input type="week" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" disabled />
            <select className="rounded-lg border border-slate-300 px-3 py-2 text-sm" disabled>
              <option>Status</option>
            </select>
          </div>
        </ReadOnlyBlock>

        <ReadOnlyBlock title="Salesmen Overview (Read-only shell)">
          <div className="rounded-lg border border-dashed border-slate-300 p-4 text-sm text-slate-600">
            Expandable grouped entries placeholder for planning, actual output, and current status.
          </div>
        </ReadOnlyBlock>
      </div>
    </div>
  )
}
