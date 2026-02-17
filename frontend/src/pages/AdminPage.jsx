import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '../context/useAuth'
import { ApiError, getAdminInsights, getAdminSalesmenStatus } from '../services/api'
import { contactTypeLabel, customerTypeLabel, visitedLabel } from '../constants/weeklyReportFields'
import InsightCard from '../components/admin/InsightCard'
import InsightsCharts from '../components/admin/InsightsCharts'
import LocationProductivityTable from '../components/admin/LocationProductivityTable'
import SalespersonProductivityTable from '../components/admin/SalespersonProductivityTable'
import CustomerProductivityTable from '../components/admin/CustomerProductivityTable'

const POLL_INTERVAL_MS = 30000

function getErrorMessage(error) {
  if (error instanceof ApiError) {
    return error.message
  }

  if (error instanceof Error) {
    return error.message
  }

  return 'Request failed'
}

function formatDateTime(value) {
  if (!value) {
    return 'Not updated yet'
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return 'Invalid date'
  }

  return date.toLocaleString()
}

function formatPercent(value) {
  return `${((value || 0) * 100).toFixed(1)}%`
}

function formatSheetDate(dateKey) {
  if (!dateKey) {
    return '-'
  }

  const date = new Date(`${dateKey}T00:00:00.000Z`)
  if (Number.isNaN(date.getTime())) {
    return dateKey
  }

  return date.toLocaleDateString(undefined, {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

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

export default function AdminPage() {
  const { signOut } = useAuth()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [successMessage, setSuccessMessage] = useState(null)
  const [entries, setEntries] = useState([])
  const [total, setTotal] = useState(0)
  const [weekInfo, setWeekInfo] = useState(null)
  const [insights, setInsights] = useState(null)
  const [lastPolledAt, setLastPolledAt] = useState(null)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const fetchCounterRef = useRef(0)

  const fetchDashboard = useCallback(
    async ({ silent = false } = {}) => {
      const fetchId = fetchCounterRef.current + 1
      fetchCounterRef.current = fetchId

      if (!silent) {
        setLoading(true)
      } else {
        setIsRefreshing(true)
      }

      try {
        const [statusData, insightsData] = await Promise.all([getAdminSalesmenStatus(), getAdminInsights()])

        if (fetchId !== fetchCounterRef.current) {
          return
        }

        setEntries(statusData?.entries || [])
        setTotal(statusData?.total || 0)
        setWeekInfo(statusData?.week || null)
        setInsights(insightsData || null)

        setLastPolledAt(new Date().toISOString())
        if (!silent) {
          setSuccessMessage('Dashboard refreshed.')
        }
        setError(null)
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
    [],
  )

  useEffect(() => {
    fetchDashboard()
  }, [fetchDashboard])

  useEffect(() => {
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        fetchDashboard({ silent: true })
      }
    }, POLL_INTERVAL_MS)

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchDashboard({ silent: true })
      }
    }

    document.addEventListener('visibilitychange', onVisibilityChange)

    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [fetchDashboard])

  const headerSubtitle = useMemo(() => {
    if (!insights?.range) {
      return 'Read-only dashboard'
    }

    return `Insights range ${insights.range.from} to ${insights.range.to} (${insights.range.timezone})`
  }, [insights])

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-8">
      <div className="mx-auto w-full max-w-7xl space-y-6">
        <header className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium uppercase tracking-wide text-slate-500">Admin</p>
              <h1 className="text-2xl font-semibold text-slate-900">Salesmen Dashboard</h1>
              <p className="mt-1 text-sm text-slate-600">{headerSubtitle}</p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => fetchDashboard()}
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

        <section className="space-y-5">
          <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div>
              <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-600">Execution</h3>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <InsightCard title="Visit Completion Rate" value={formatPercent(insights?.kpis?.visitCompletionRate?.value)} />
              <InsightCard title="Total Planned Visits" value={String(insights?.totals?.plannedVisits || 0)} />
              <InsightCard
                title="Avg Visits per Week"
                value={(insights?.kpis?.averageVisitsPerWeekPerSalesperson?.value || 0).toFixed(2)}
              />
              <InsightCard title="Most Productive Day" value={insights?.kpis?.mostProductiveDay?.day || 'N/A'} />
            </div>

            <div className="border-t border-slate-200 pt-4">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-600">Conversion & Efficiency</h3>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <InsightCard title="Enquiry to Shipment" value={formatPercent(insights?.kpis?.enquiryToShipmentConversionRate?.value)} />
              <InsightCard title="Enquiries per Visit" value={(insights?.kpis?.enquiriesPerVisit?.value || 0).toFixed(2)} />
              <InsightCard title="Shipments per Visit" value={(insights?.kpis?.shipmentsPerVisit?.value || 0).toFixed(2)} />
              <InsightCard
                title="Avg Enquiry to Shipment Days"
                value={
                  insights?.kpis?.averageDaysEnquiryToShipment === null
                    ? 'N/A'
                    : (insights?.kpis?.averageDaysEnquiryToShipment || 0).toFixed(1)
                }
              />
            </div>
          </div>

          <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-600">Visual Trends</h3>
            <InsightsCharts charts={insights?.charts} />
          </div>

          <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-600">Productivity Tables</h3>
            <div className="grid gap-4 xl:grid-cols-2">
              <details className="rounded-xl border border-slate-200 bg-white p-4">
                <summary className="cursor-pointer text-sm font-semibold uppercase tracking-wide text-slate-600">
                  Geographic Productivity
                </summary>
                <div className="mt-3">
                  <LocationProductivityTable rows={insights?.tables?.locationProductivity} />
                </div>
              </details>
              <details className="rounded-xl border border-slate-200 bg-white p-4">
                <summary className="cursor-pointer text-sm font-semibold uppercase tracking-wide text-slate-600">
                  Salesperson Productivity
                </summary>
                <div className="mt-3">
                  <SalespersonProductivityTable rows={insights?.tables?.salespersonProductivity} />
                </div>
              </details>
              <details className="rounded-xl border border-slate-200 bg-white p-4">
                <summary className="cursor-pointer text-sm font-semibold uppercase tracking-wide text-slate-600">
                  Customer Productivity
                </summary>
                <div className="mt-3">
                  <CustomerProductivityTable rows={insights?.tables?.customerProductivity} />
                </div>
              </details>
            </div>
          </div>

          {insights?.notes?.length > 0 && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              {insights.notes.join(' ')}
            </div>
          )}
        </section>

        <section className="space-y-3">
          {loading && <p className="text-sm text-slate-600">Loading dashboard...</p>}

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
