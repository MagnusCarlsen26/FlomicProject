import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import PageSurface from '../components/layout/PageSurface'
import PageEnter from '../components/motion/PageEnter'
import RevealCard from '../components/motion/RevealCard'
import StaggerGroup from '../components/motion/StaggerGroup'
import InsightCard from '../components/admin/InsightCard'
import InsightsCharts from '../components/admin/InsightsCharts'
import LocationProductivityTable from '../components/admin/LocationProductivityTable'
import SalespersonProductivityTable from '../components/admin/SalespersonProductivityTable'
import CustomerProductivityTable from '../components/admin/CustomerProductivityTable'
import Alert from '../components/ui/Alert'
import Button from '../components/ui/Button'
import GlassCard from '../components/ui/GlassCard'
import Input from '../components/ui/Input'
import MultiSelect from '../components/ui/MultiSelect'
import { getAdminInsights, getAdminSalesmen } from '../services/api'
import { POLL_INTERVAL_MS, formatDateTime, formatPercent, getErrorMessage } from './adminUtils'

export default function AdminInsightsPage() {
  const [loading, setLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [error, setError] = useState(null)
  const [successMessage, setSuccessMessage] = useState(null)
  const [insights, setInsights] = useState(null)
  const [lastPolledAt, setLastPolledAt] = useState(null)
  
  // Filter States
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [selectedSalesmen, setSelectedSalesmen] = useState([])
  const [salesmenOptions, setSalesmenOptions] = useState([])
  const [appliedFilters, setAppliedFilters] = useState({ from: '', to: '', salesmen: [] })

  const fetchCounterRef = useRef(0)

  const fetchInsights = useCallback(
    async ({ silent = false, showSuccess = false, filters = appliedFilters } = {}) => {
      const fetchId = fetchCounterRef.current + 1
      fetchCounterRef.current = fetchId

      if (!silent) {
        setLoading(true)
      } else {
        setIsRefreshing(true)
      }

      try {
        const insightsData = await getAdminInsights({
          from: filters.from || undefined,
          to: filters.to || undefined,
          salesmen: filters.salesmen.length > 0 ? filters.salesmen : undefined
        })

        if (fetchId !== fetchCounterRef.current) {
          return
        }

        setInsights(insightsData || null)
        setLastPolledAt(new Date().toISOString())
        setError(null)
        if (!silent && showSuccess) {
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
    [appliedFilters],
  )

  const fetchSalesmen = useCallback(async () => {
    try {
      const data = await getAdminSalesmen()
      setSalesmenOptions(data.salesmen || [])
    } catch (e) {
      console.error('Failed to fetch salesmen', e)
    }
  }, [])

  useEffect(() => {
    fetchSalesmen()
  }, [fetchSalesmen])

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

  const handleApplyFilters = () => {
    const newFilters = {
      from: fromDate,
      to: toDate,
      salesmen: selectedSalesmen
    }
    setAppliedFilters(newFilters)
    setSuccessMessage('Filters applied.')
    setTimeout(() => setSuccessMessage(null), 3000)
  }

  const handleResetFilters = () => {
    setFromDate('')
    setToDate('')
    setSelectedSalesmen([])
    setAppliedFilters({ from: '', to: '', salesmen: [] })
  }

  const headerSubtitle = useMemo(() => {
    if (!insights?.range) {
      return 'Read-only dashboard'
    }

    return `Insights range ${insights.range.from} to ${insights.range.to} (${insights.range.timezone})`
  }, [insights])

  return (
    <PageEnter>
      <PageSurface>
        <GlassCard className="relative z-30">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.16em] text-primary">Admin</p>
              <h1 className="mt-1 text-2xl font-bold text-text-primary">Insights</h1>
              <p className="mt-1 text-sm text-text-secondary">{headerSubtitle}</p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                onClick={() => fetchInsights({ showSuccess: true })}
                disabled={loading || isRefreshing}
              >
                {loading || isRefreshing ? 'Refreshing...' : 'Refresh'}
              </Button>
            </div>
          </div>

          <p className="mt-3 text-sm text-text-secondary">Last refresh: {formatDateTime(lastPolledAt)}</p>

          <div className="relative z-20 mt-6 grid grid-cols-1 gap-4 rounded-2xl border border-border bg-surface/50 p-4 sm:grid-cols-2 lg:grid-cols-4 items-end">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-text-muted">From Date</label>
              <Input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-text-muted">To Date</label>
              <Input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-text-muted">Salesmen</label>
              <MultiSelect
                options={salesmenOptions}
                selected={selectedSalesmen}
                onChange={setSelectedSalesmen}
                placeholder="All Salesmen"
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={handleApplyFilters} className="flex-1">Apply</Button>
              <Button variant="secondary" onClick={handleResetFilters}>Reset</Button>
            </div>
          </div>

          <div className="mt-4 space-y-3">
            {error ? <Alert tone="error">{error}</Alert> : null}
            {successMessage && !error ? <Alert tone="success">{successMessage}</Alert> : null}
          </div>
        </GlassCard>

        <section className="space-y-5">
          <GlassCard className="space-y-4">
            <div>
              <h3 className="text-sm font-semibold uppercase tracking-wide text-text-muted">Execution</h3>
            </div>
            <StaggerGroup className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <RevealCard>
                <InsightCard title="Visit Completion Rate" value={formatPercent(insights?.kpis?.visitCompletionRate?.value)} />
              </RevealCard>
              <RevealCard>
                <InsightCard title="Total Planned Visits" value={String(insights?.totals?.plannedVisits || 0)} />
              </RevealCard>
              <RevealCard>
                <InsightCard
                  title="Avg Visits per Week"
                  value={(insights?.kpis?.averageVisitsPerWeekPerSalesperson?.value || 0).toFixed(2)}
                />
              </RevealCard>
              <RevealCard>
                <InsightCard title="Most Productive Day" value={insights?.kpis?.mostProductiveDay?.day || 'N/A'} />
              </RevealCard>
            </StaggerGroup>

            <div className="border-t border-border pt-4">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-text-muted">Conversion & Efficiency</h3>
            </div>

            <StaggerGroup className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <RevealCard>
                <InsightCard title="Enquiry to Shipment" value={formatPercent(insights?.kpis?.enquiryToShipmentConversionRate?.value)} />
              </RevealCard>
              <RevealCard>
                <InsightCard title="Enquiries per Visit" value={(insights?.kpis?.enquiriesPerVisit?.value || 0).toFixed(2)} />
              </RevealCard>
              <RevealCard>
                <InsightCard title="Shipments per Visit" value={(insights?.kpis?.shipmentsPerVisit?.value || 0).toFixed(2)} />
              </RevealCard>
              <RevealCard>
                <InsightCard
                  title="Avg Enquiry to Shipment Days"
                  value={
                    insights?.kpis?.averageDaysEnquiryToShipment === null
                      ? 'N/A'
                      : (insights?.kpis?.averageDaysEnquiryToShipment || 0).toFixed(1)
                  }
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
            <div className="flex flex-col gap-6">
              <details className="rounded-2xl border border-border bg-surface p-4">
                <summary className="cursor-pointer text-sm font-semibold uppercase tracking-wide text-text-muted">
                  Geographic Productivity
                </summary>
                <div className="mt-3">
                  <LocationProductivityTable rows={insights?.tables?.locationProductivity} />
                </div>
              </details>
              <details className="rounded-2xl border border-border bg-surface p-4">
                <summary className="cursor-pointer text-sm font-semibold uppercase tracking-wide text-text-muted">
                  Salesperson Productivity
                </summary>
                <div className="mt-3">
                  <SalespersonProductivityTable rows={insights?.tables?.salespersonProductivity} />
                </div>
              </details>
              <details className="rounded-2xl border border-border bg-surface p-4">
                <summary className="cursor-pointer text-sm font-semibold uppercase tracking-wide text-text-muted">
                  Customer Productivity
                </summary>
                <div className="mt-3">
                  <CustomerProductivityTable rows={insights?.tables?.customerProductivity} />
                </div>
              </details>
            </div>
          </GlassCard>

          {insights?.notes?.length > 0 ? <Alert tone="warning">{insights.notes.join(' ')}</Alert> : null}
        </section>
      </PageSurface>
    </PageEnter>
  )
}
