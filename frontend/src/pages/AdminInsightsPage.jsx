import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import FilterBar from '../components/layout/FilterBar'
import PageSurface from '../components/layout/PageSurface'
import PageEnter from '../components/motion/PageEnter'
import RevealCard from '../components/motion/RevealCard'
import StaggerGroup from '../components/motion/StaggerGroup'
import InsightCard from '../components/admin/InsightCard'
import InsightsCharts from '../components/admin/InsightsCharts'
import LocationProductivityTable from '../components/admin/LocationProductivityTable'
import SalespersonProductivityTable from '../components/admin/SalespersonProductivityTable'
import AdminSectionTabs from '../components/admin/AdminSectionTabs'
import Alert from '../components/ui/Alert'
import Button from '../components/ui/Button'
import GlassCard from '../components/ui/GlassCard'
import Input from '../components/ui/Input'
import { useAuth } from '../context/useAuth'
import { getAdminInsights } from '../services/api'
import { POLL_INTERVAL_MS, formatDateTime, formatPercent, getDefaultRangeWeeks, getErrorMessage } from './adminUtils'

export default function AdminInsightsPage() {
  const { user } = useAuth()
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
    <PageEnter>
      <PageSurface>
        <GlassCard>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.16em] text-primary">Admin</p>
              <h1 className="mt-1 text-2xl font-bold text-text-primary">Insights</h1>
              <p className="mt-1 text-sm text-text-secondary">{headerSubtitle}</p>
              <p className="mt-1 text-sm text-text-secondary">Signed in as {user?.name || user?.email || 'Unknown user'}</p>
            </div>
            <Button variant="secondary" onClick={() => fetchInsights()} disabled={loading || isRefreshing}>
              {loading || isRefreshing ? 'Refreshing...' : 'Refresh'}
            </Button>
          </div>

          <div className="mt-4">
            <AdminSectionTabs />
          </div>

          <div className="mt-4">
            <FilterBar>
              <Input
                type="text"
                placeholder="Search salesperson"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
              <Input type="week" value={fromWeek} onChange={(event) => setFromWeek(event.target.value)} />
              <Input type="week" value={toWeek} onChange={(event) => setToWeek(event.target.value)} />
              <Button onClick={() => fetchInsights()} disabled={loading || isRefreshing}>
                {loading ? 'Loading...' : 'Apply filters'}
              </Button>
            </FilterBar>
          </div>

          <p className="mt-3 text-sm text-text-secondary">Last refresh: {formatDateTime(lastPolledAt)}</p>

          <div className="mt-4 space-y-3">
            {error ? <Alert tone="error">{error}</Alert> : null}
            {successMessage && !error ? <Alert tone="success">{successMessage}</Alert> : null}
          </div>
        </GlassCard>

        <section className="space-y-5">
          <GlassCard>
            <h2 className="text-lg font-semibold text-text-primary">Insights Overview</h2>
            <p className="mt-1 text-sm text-text-secondary">Key performance metrics, conversion, and productivity trends.</p>
          </GlassCard>

          <GlassCard className="space-y-4">
            <div>
              <h3 className="text-sm font-semibold uppercase tracking-wide text-text-muted">Execution</h3>
            </div>
            <StaggerGroup className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <RevealCard>
                <InsightCard
                  title="Visit Completion Rate"
                  value={formatPercent(insights?.kpis?.visitCompletionRate?.value)}
                  subtitle={`${insights?.kpis?.visitCompletionRate?.numerator || 0} / ${insights?.kpis?.visitCompletionRate?.denominator || 0}`}
                />
              </RevealCard>
              <RevealCard>
                <InsightCard
                  title="Total Planned Visits"
                  value={String(insights?.totals?.plannedVisits || 0)}
                  subtitle={`Actual visits: ${insights?.totals?.actualVisits || 0}`}
                />
              </RevealCard>
              <RevealCard>
                <InsightCard
                  title="Avg Visits per Week"
                  value={(insights?.kpis?.averageVisitsPerWeekPerSalesperson?.value || 0).toFixed(2)}
                  subtitle={`${insights?.kpis?.averageVisitsPerWeekPerSalesperson?.salespeopleWithActivity || 0} active salespeople`}
                />
              </RevealCard>
              <RevealCard>
                <InsightCard
                  title="Most Productive Day"
                  value={insights?.kpis?.mostProductiveDay?.day || 'N/A'}
                  subtitle={`${insights?.kpis?.mostProductiveDay?.shipments || 0} shipments, ${insights?.kpis?.mostProductiveDay?.enquiries || 0} enquiries`}
                />
              </RevealCard>
            </StaggerGroup>

            <div className="border-t border-border pt-4">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-text-muted">Conversion & Efficiency</h3>
            </div>

            <StaggerGroup className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <RevealCard>
                <InsightCard
                  title="Enquiry to Shipment"
                  value={formatPercent(insights?.kpis?.enquiryToShipmentConversionRate?.value)}
                  subtitle={`${insights?.totals?.shipments || 0} shipments from ${insights?.totals?.enquiries || 0} enquiries`}
                />
              </RevealCard>
              <RevealCard>
                <InsightCard
                  title="Enquiries per Visit"
                  value={(insights?.kpis?.enquiriesPerVisit?.value || 0).toFixed(2)}
                  subtitle={`${insights?.kpis?.enquiriesPerVisit?.numerator || 0} enquiries / ${insights?.kpis?.enquiriesPerVisit?.denominator || 0} visits`}
                />
              </RevealCard>
              <RevealCard>
                <InsightCard
                  title="Shipments per Visit"
                  value={(insights?.kpis?.shipmentsPerVisit?.value || 0).toFixed(2)}
                  subtitle={`${insights?.kpis?.shipmentsPerVisit?.numerator || 0} shipments / ${insights?.kpis?.shipmentsPerVisit?.denominator || 0} visits`}
                />
              </RevealCard>
              <RevealCard>
                <InsightCard
                  title="Avg Enquiry to Shipment Days"
                  value={
                    insights?.kpis?.averageDaysEnquiryToShipment === null
                      ? 'N/A'
                      : (insights?.kpis?.averageDaysEnquiryToShipment || 0).toFixed(1)
                  }
                  subtitle={`Samples: ${insights?.kpis?.averageDaysEnquiryToShipmentSamples || 0}`}
                />
              </RevealCard>
            </StaggerGroup>
          </GlassCard>

          <GlassCard className="space-y-3">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-text-muted">Visual Trends</h3>
            <InsightsCharts charts={insights?.charts} />
          </GlassCard>

          <GlassCard className="space-y-3">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-text-muted">Productivity Tables</h3>
            <div className="grid gap-4 xl:grid-cols-2">
              <div className="space-y-2 rounded-2xl border border-border bg-surface p-4">
                <h4 className="text-sm font-semibold uppercase tracking-wide text-text-muted">Geographic Productivity</h4>
                <LocationProductivityTable rows={insights?.tables?.locationProductivity} />
              </div>
              <div className="space-y-2 rounded-2xl border border-border bg-surface p-4">
                <h4 className="text-sm font-semibold uppercase tracking-wide text-text-muted">Salesperson Productivity</h4>
                <SalespersonProductivityTable rows={insights?.tables?.salespersonProductivity} />
              </div>
            </div>
          </GlassCard>

          {insights?.notes?.length > 0 ? <Alert tone="warning">{insights.notes.join(' ')}</Alert> : null}
        </section>
      </PageSurface>
    </PageEnter>
  )
}
