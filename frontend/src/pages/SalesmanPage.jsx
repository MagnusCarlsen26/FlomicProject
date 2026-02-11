import { useAuth } from '../context/useAuth'

function SectionCard({ title, description, children }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
      <p className="mt-1 text-sm text-slate-600">{description}</p>
      <div className="mt-4">{children}</div>
    </section>
  )
}

export default function SalesmanPage() {
  const { user, signOut } = useAuth()

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-8">
      <div className="mx-auto w-full max-w-5xl space-y-6">
        <header className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium uppercase tracking-wide text-slate-500">Salesman</p>
              <h1 className="text-2xl font-semibold text-slate-900">Current Week Workspace</h1>
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

        <SectionCard
          title="Planning"
          description="Current week planning table shell. Data integration arrives in Phase 3."
        >
          <div className="rounded-lg border border-dashed border-slate-300 p-4 text-sm text-slate-600">
            Planning rows placeholder
          </div>
          <button
            type="button"
            className="mt-4 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white"
          >
            Submit weekly plan
          </button>
        </SectionCard>

        <SectionCard
          title="Actual Output"
          description="Current week actual output table shell. Edit restrictions will be backend-enforced in Phase 3."
        >
          <div className="rounded-lg border border-dashed border-slate-300 p-4 text-sm text-slate-600">
            Actual output rows placeholder
          </div>
          <button
            type="button"
            className="mt-4 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white"
          >
            Save actuals
          </button>
        </SectionCard>
      </div>
    </div>
  )
}
