import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useAuth } from '../context/useAuth'
import { getAdminInsights } from '../services/api'
import InsightCard from '../components/admin/InsightCard'
import InsightsCharts from '../components/admin/InsightsCharts'
import LocationProductivityTable from '../components/admin/LocationProductivityTable'
import SalespersonProductivityTable from '../components/admin/SalespersonProductivityTable'
import AdminSectionTabs from '../components/admin/AdminSectionTabs'
import { POLL_INTERVAL_MS, formatDateTime, formatPercent, getDefaultRangeWeeks, getErrorMessage } from './adminUtils'

export default function AdminInsightsPage() {
  const { user, signOut } = useAuth()
  const defaultRange = useMemo(() => getDefaultRangeWeeks(), [])

  const [loading, setLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [error, setError] = useState(null)
  const [successMessage, setSuccessMessage] = useState(null)
  const [insights, setInsights] = useState(null)
  const [lastPolledAt, setLastPolledAt] = useState(null)
  const fetchCounterRef = useRef(0)

  const [query, setQuery] = useState('')
  const [fromWeek, setFromWeek] = useState(defaultRange.fromWeek)
  const [toWeek, setToWeek] = useState(defaultRange.toWeek)

  const fetchInsights = useCallback(
    async ({ silent = false } = {}) => {
      const fetchId = fetchCounterRef.current + 1
      fetchCounterRef.current = fetchId

      if (!silent) {
        setLoading(true)
      } else {
        setIsRefreshing(true)
      }

      try {
        const insightsData = await getAdminInsights({
          q: query || undefined,
          from: fromWeek || undefined,
          to: toWeek || undefined,
        })

        if (fetchId !== fetchCounterRef.current) {
          return
        }

        setInsights(insightsData || null)
        setLastPolledAt(new Date().toISOString())
        setError(null)
        if (!silent) {
          setSuccessMessage('Insights refreshed.')
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
    [query, fromWeek, toWeek],
  )

  useEffect(() => {
    fetchInsights()
  }, [fetchInsights])

  useEffect(() => {
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        fetchInsights({ silent: true })
      }
    }, POLL_INTERVAL_MS)

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchInsights({ silent: true })
      }
    }

    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [fetchInsights])

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
              <h1 className="text-2xl font-semibold text-slate-900">Insights</h1>
              <p className="mt-1 text-sm text-slate-600">{headerSubtitle}</p>
              <p className="mt-1 text-sm text-slate-600">
                Signed in as {user?.name || user?.email || 'Unknown user'}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => fetchInsights()}
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

          <div className="mt-4 grid gap-3 md:grid-cols-4">
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
              value={fromWeek}
              onChange={(event) => setFromWeek(event.target.value)}
            />
            <input
              type="week"
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              value={toWeek}
              onChange={(event) => setToWeek(event.target.value)}
            />
            <button
              type="button"
              onClick={() => fetchInsights()}
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white"
              disabled={loading || isRefreshing}
            >
              {loading ? 'Loading...' : 'Apply filters'}
            </button>
          </div>

          <div className="mt-3 text-sm text-slate-600">Last refresh: {formatDateTime(lastPolledAt)}</div>

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
          <div className="rounded-xl border border-slate-200 bg-slate-100 p-4">
            <h2 className="text-lg font-semibold text-slate-900">Insights Overview</h2>
            <p className="mt-1 text-sm text-slate-600">Key performance metrics, conversion, and productivity trends.</p>
          </div>

          <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div>
              <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-600">Execution</h3>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <InsightCard
                title="Visit Completion Rate"
                value={formatPercent(insights?.kpis?.visitCompletionRate?.value)}
                subtitle={`${insights?.kpis?.visitCompletionRate?.numerator || 0} / ${insights?.kpis?.visitCompletionRate?.denominator || 0}`}
              />
              <InsightCard
                title="Total Planned Visits"
                value={String(insights?.totals?.plannedVisits || 0)}
                subtitle={`Actual visits: ${insights?.totals?.actualVisits || 0}`}
              />
              <InsightCard
                title="Avg Visits per Week"
                value={(insights?.kpis?.averageVisitsPerWeekPerSalesperson?.value || 0).toFixed(2)}
                subtitle={`${insights?.kpis?.averageVisitsPerWeekPerSalesperson?.salespeopleWithActivity || 0} active salespeople`}
              />
              <InsightCard
                title="Most Productive Day"
                value={insights?.kpis?.mostProductiveDay?.day || 'N/A'}
                subtitle={`${insights?.kpis?.mostProductiveDay?.shipments || 0} shipments, ${insights?.kpis?.mostProductiveDay?.enquiries || 0} enquiries`}
              />
            </div>

            <div className="border-t border-slate-200 pt-4">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-600">Conversion & Efficiency</h3>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <InsightCard
                title="Enquiry to Shipment"
                value={formatPercent(insights?.kpis?.enquiryToShipmentConversionRate?.value)}
                subtitle={`${insights?.totals?.shipments || 0} shipments from ${insights?.totals?.enquiries || 0} enquiries`}
              />
              <InsightCard
                title="Enquiries per Visit"
                value={(insights?.kpis?.enquiriesPerVisit?.value || 0).toFixed(2)}
                subtitle={`${insights?.kpis?.enquiriesPerVisit?.numerator || 0} enquiries / ${insights?.kpis?.enquiriesPerVisit?.denominator || 0} visits`}
              />
              <InsightCard
                title="Shipments per Visit"
                value={(insights?.kpis?.shipmentsPerVisit?.value || 0).toFixed(2)}
                subtitle={`${insights?.kpis?.shipmentsPerVisit?.numerator || 0} shipments / ${insights?.kpis?.shipmentsPerVisit?.denominator || 0} visits`}
              />
              <InsightCard
                title="Avg Enquiry to Shipment Days"
                value={
                  insights?.kpis?.averageDaysEnquiryToShipment === null
                    ? 'N/A'
                    : (insights?.kpis?.averageDaysEnquiryToShipment || 0).toFixed(1)
                }
                subtitle={`Samples: ${insights?.kpis?.averageDaysEnquiryToShipmentSamples || 0}`}
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
              <div className="space-y-2 rounded-xl border border-slate-200 bg-white p-4">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-600">Geographic Productivity</h3>
                <LocationProductivityTable rows={insights?.tables?.locationProductivity} />
              </div>
              <div className="space-y-2 rounded-xl border border-slate-200 bg-white p-4">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-600">Salesperson Productivity</h3>
                <SalespersonProductivityTable rows={insights?.tables?.salespersonProductivity} />
              </div>
            </div>
          </div>

          {insights?.notes?.length > 0 && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              {insights.notes.join(' ')}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
