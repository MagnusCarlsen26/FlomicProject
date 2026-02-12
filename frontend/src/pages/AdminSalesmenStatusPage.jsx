import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '../context/useAuth'
import { getAdminSalesmenStatus } from '../services/api'
import { contactTypeLabel, customerTypeLabel, visitedLabel } from '../constants/weeklyReportFields'
import AdminSectionTabs from '../components/admin/AdminSectionTabs'
import { POLL_INTERVAL_MS, formatDateTime, formatSheetDate, getDefaultRangeWeeks, getErrorMessage } from './adminUtils'

function PlanningRowsTable({ rows }) {
  if (!rows?.length) {
    return <p className="rounded-lg border border-dashed border-slate-300 p-3 text-sm text-slate-600">No rows</p>
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200">
      <table className="min-w-full divide-y divide-slate-200 text-sm">
        <thead className="bg-slate-50">
          <tr>
            <th className="px-3 py-2 text-left font-medium text-slate-600">Week</th>
            <th className="px-3 py-2 text-left font-medium text-slate-600">Date</th>
            <th className="px-3 py-2 text-left font-medium text-slate-600">Customer</th>
            <th className="px-3 py-2 text-left font-medium text-slate-600">Location</th>
            <th className="px-3 py-2 text-left font-medium text-slate-600">Type</th>
            <th className="px-3 py-2 text-left font-medium text-slate-600">Contact</th>
            <th className="px-3 py-2 text-left font-medium text-slate-600">If JSV, with whom</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200 bg-white">
          {rows.map((row, index) => (
            <tr key={`${row.date || 'planning'}-${index}`}>
              <td className="px-3 py-2 text-slate-800">{row.isoWeek ?? '-'}</td>
              <td className="px-3 py-2 text-slate-800">{formatSheetDate(row.date)}</td>
              <td className="px-3 py-2 text-slate-800">{row.customerName || '-'}</td>
              <td className="px-3 py-2 text-slate-800">{row.locationArea || '-'}</td>
              <td className="px-3 py-2 text-slate-800">{customerTypeLabel(row.customerType)}</td>
              <td className="px-3 py-2 text-slate-800">{contactTypeLabel(row.contactType)}</td>
              <td className="px-3 py-2 text-slate-700">{row.jsvWithWhom || '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function ActualOutputRowsTable({ rows }) {
  if (!rows?.length) {
    return <p className="rounded-lg border border-dashed border-slate-300 p-3 text-sm text-slate-600">No rows</p>
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200">
      <table className="min-w-full divide-y divide-slate-200 text-sm">
        <thead className="bg-slate-50">
          <tr>
            <th className="px-3 py-2 text-left font-medium text-slate-600">Week</th>
            <th className="px-3 py-2 text-left font-medium text-slate-600">Date</th>
            <th className="px-3 py-2 text-left font-medium text-slate-600">Visited</th>
            <th className="px-3 py-2 text-left font-medium text-slate-600">Reason not visited</th>
            <th className="px-3 py-2 text-left font-medium text-slate-600">Enquiries</th>
            <th className="px-3 py-2 text-left font-medium text-slate-600">Shipments</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200 bg-white">
          {rows.map((row, index) => (
            <tr key={`${row.date || 'actual'}-${index}`}>
              <td className="px-3 py-2 text-slate-800">{row.isoWeek ?? '-'}</td>
              <td className="px-3 py-2 text-slate-800">{formatSheetDate(row.date)}</td>
              <td className="px-3 py-2 text-slate-800">{visitedLabel(row.visited)}</td>
              <td className="px-3 py-2 text-slate-700">{row.notVisitedReason || '-'}</td>
              <td className="px-3 py-2 text-slate-800">{row.enquiriesReceived ?? 0}</td>
              <td className="px-3 py-2 text-slate-800">{row.shipmentsConverted ?? 0}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function AdminSalesmenStatusPage() {
  const { user, signOut } = useAuth()
  const defaultRange = useMemo(() => getDefaultRangeWeeks(), [])

  const [loading, setLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [error, setError] = useState(null)
  const [successMessage, setSuccessMessage] = useState(null)
  const [entries, setEntries] = useState([])
  const [total, setTotal] = useState(0)
  const [weekInfo, setWeekInfo] = useState(null)
  const [lastPolledAt, setLastPolledAt] = useState(null)
  const fetchCounterRef = useRef(0)

  const [query, setQuery] = useState('')
  const [week, setWeek] = useState(defaultRange.toWeek)

  const fetchStatus = useCallback(
    async ({ silent = false } = {}) => {
      const fetchId = fetchCounterRef.current + 1
      fetchCounterRef.current = fetchId

      if (!silent) {
        setLoading(true)
      } else {
        setIsRefreshing(true)
      }

      try {
        const statusData = await getAdminSalesmenStatus({
          q: query || undefined,
          week: week || undefined,
        })

        if (fetchId !== fetchCounterRef.current) {
          return
        }

        setEntries(statusData?.entries || [])
        setTotal(statusData?.total || 0)
        setWeekInfo(statusData?.week || null)
        setLastPolledAt(new Date().toISOString())
        setError(null)
        if (!silent) {
          setSuccessMessage('Salesman status refreshed.')
        }
      } catch (e) {
        if (fetchId !== fetchCounterRef.current) {
          return
        }
        setSuccessMessage(null)
        setError(getErrorMessage(e))
      } finally {
        if (!silent) {
          setLoading(false)
        } else {
          setIsRefreshing(false)
        }
      }
    },
    [query, week],
  )

  useEffect(() => {
    fetchStatus()
  }, [fetchStatus])

  useEffect(() => {
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        fetchStatus({ silent: true })
      }
    }, POLL_INTERVAL_MS)

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchStatus({ silent: true })
      }
    }

    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [fetchStatus])

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-8">
      <div className="mx-auto w-full max-w-7xl space-y-6">
        <header className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium uppercase tracking-wide text-slate-500">Admin</p>
              <h1 className="text-2xl font-semibold text-slate-900">Salesman Status</h1>
              <p className="mt-1 text-sm text-slate-600">Detailed planning and actual output by salesperson.</p>
              <p className="mt-1 text-sm text-slate-600">
                Signed in as {user?.name || user?.email || 'Unknown user'}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => fetchStatus()}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-900 transition hover:bg-slate-100"
                disabled={loading || isRefreshing}
              >
                {loading || isRefreshing ? 'Refreshing...' : 'Refresh'}
              </button>
              <button
                type="button"
                onClick={signOut}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-900 transition hover:bg-slate-100"
              >
                Logout
              </button>
            </div>
          </div>

          <div className="mt-4">
            <AdminSectionTabs />
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <input
              type="text"
              placeholder="Search salesperson"
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            <input
              type="week"
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              value={week}
              onChange={(event) => setWeek(event.target.value)}
            />
            <button
              type="button"
              onClick={() => fetchStatus()}
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white"
              disabled={loading || isRefreshing}
            >
              {loading ? 'Loading...' : 'Apply filters'}
            </button>
          </div>

          <div className="mt-3 text-sm text-slate-600">
            Showing {total} salesmen. Last refresh: {formatDateTime(lastPolledAt)}
          </div>

          {error && (
            <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
              {error}
            </div>
          )}

          {successMessage && !error && (
            <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
              {successMessage}
            </div>
          )}
        </header>

        <section className="space-y-3">
          {loading && <p className="text-sm text-slate-600">Loading status...</p>}

          {!loading && entries.length === 0 && (
            <div className="rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-600 shadow-sm">
              No salesmen found for the selected filters.
            </div>
          )}

          {entries.map((entry) => (
            <details key={entry.salesman.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-base font-semibold text-slate-900">{entry.salesman.name || entry.salesman.email}</p>
                  <p className="text-sm text-slate-600">{entry.salesman.email}</p>
                </div>
              </summary>

              <div className="mt-4 grid gap-4 xl:grid-cols-1">
                <div className="space-y-2">
                  <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-600">Planning</h2>
                  <p className="text-xs text-slate-500">Submitted: {formatDateTime(entry.planning.submittedAt)}</p>
                  <PlanningRowsTable rows={entry.planning.rows} />
                </div>

                <div className="space-y-2">
                  <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-600">Actual Output</h2>
                  <p className="text-xs text-slate-500">Updated: {formatDateTime(entry.actualOutput.updatedAt)}</p>
                  <ActualOutputRowsTable rows={entry.actualOutput.rows} />
                </div>
              </div>
            </details>
          ))}
        </section>

        {weekInfo && (
          <p className="text-xs text-slate-500">Detail table week: {weekInfo.startDate} to {weekInfo.endDate}</p>
        )}
      </div>
    </div>
  )
}
