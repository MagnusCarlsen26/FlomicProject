import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { getAdminStage3PlannedNotVisited } from '../../services/api'
import { notVisitedReasonCategoryLabel } from '../../constants/weeklyReportFields'
import { POLL_INTERVAL_MS, formatDateTime, formatPercent, getErrorMessage } from '../../pages/adminUtils'
import InsightCard from './InsightCard'
import Alert from '../ui/Alert'
import Badge from '../ui/Badge'
import DataTableFrame from '../ui/DataTableFrame'
import GlassCard from '../ui/GlassCard'

const COLORS = ['#60a5fa', '#34d399', '#fbbf24', '#f87171', '#a78bfa', '#94a3b8']

export default function Stage3PlannedNotVisitedSection() {
  const [error, setError] = useState(null)
  const [data, setData] = useState(null)
  const [lastPolledAt, setLastPolledAt] = useState(null)
  const [appliedFilters] = useState({})

  const fetchCounterRef = useRef(0)

  const fetchData = useCallback(
    async ({ filters = appliedFilters } = {}) => {
      const fetchId = fetchCounterRef.current + 1
      fetchCounterRef.current = fetchId

      try {
        const response = await getAdminStage3PlannedNotVisited(filters)
        if (fetchId !== fetchCounterRef.current) return
        setData(response || null)
        setError(null)
        setLastPolledAt(new Date().toISOString())
      } catch (e) {
        if (fetchId !== fetchCounterRef.current) return
        setError(getErrorMessage(e))
      }
    },
    [appliedFilters],
  )

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchData()
    }, 0)
    return () => clearTimeout(timer)
  }, [fetchData])

  useEffect(() => {
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        fetchData({ silent: true })
      }
    }, POLL_INTERVAL_MS)

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchData({ silent: true })
      }
    }

    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [fetchData])

  const weeklyTrend = data?.weeklyTrend || []
  const reasonDistribution = (data?.reasonDistribution || []).map((item) => ({
    name: notVisitedReasonCategoryLabel(item.reasonCategory),
    value: item.count,
  }))
  const salespersonRates = data?.salespersonRates || []
  const topRepeatedCustomers = data?.topRepeatedCustomers || []
  const drilldownRows = useMemo(() => data?.drilldownRows || [], [data])

  return (
    <div className="space-y-4">
      {error ? <Alert tone="error">{error}</Alert> : null}

      <div className="grid gap-4 sm:grid-cols-3">
        <InsightCard title="Stage 3 Planned Visits" value={String(data?.totals?.plannedVisits || 0)} />
        <InsightCard title="Missed Visits" value={String(data?.totals?.plannedButNotVisitedCount || 0)} />
        <InsightCard title="Non-Visit Rate" value={formatPercent(data?.totals?.nonVisitRate || 0)} />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <GlassCard className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-text-muted">Weekly Trend (Non-Visit Rate)</h2>
            <span className="text-xs text-text-secondary">Last refresh: {formatDateTime(lastPolledAt)}</span>
          </div>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weeklyTrend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="isoWeek" />
                <YAxis tickFormatter={formatPercent} />
                <Tooltip formatter={(val) => formatPercent(val)} />
                <Legend />
                <Bar dataKey="nonVisitRate" name="Non-Visit Rate" fill="#60a5fa" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </GlassCard>

        <GlassCard className="space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-text-muted">Reason Distribution</h2>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={reasonDistribution}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={5}
                  dataKey="value"
                  label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                >
                  {reasonDistribution.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </GlassCard>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <GlassCard className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-text-muted">Salesperson Non-Visit Rates</h2>
          <DataTableFrame>
            <table className="table-core min-w-full text-sm">
              <thead>
                <tr>
                  <th>Salesperson</th>
                  <th>Planned</th>
                  <th>Missed</th>
                  <th>Rate</th>
                </tr>
              </thead>
              <tbody>
                {salespersonRates.map((sr) => (
                  <tr key={sr.id}>
                    <td>{sr.name}</td>
                    <td>{sr.plannedVisits}</td>
                    <td>{sr.nonVisitedCount}</td>
                    <td className="font-semibold text-primary">{formatPercent(sr.nonVisitRate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </DataTableFrame>
        </GlassCard>

        <GlassCard className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-text-muted">Repeated Non-Visits (Last 8 Weeks)</h2>
            <Badge tone="warning">Threshold: &ge; 2 weeks</Badge>
          </div>
          <DataTableFrame>
            <table className="table-core min-w-full text-sm">
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Salesperson</th>
                  <th>Weeks</th>
                  <th>Latest Date</th>
                  <th>Dominant Reason</th>
                </tr>
              </thead>
              <tbody>
                {topRepeatedCustomers.map((hist, idx) => (
                  <tr key={idx}>
                    <td className="font-semibold">{hist.customerName}</td>
                    <td>{hist.salesmanName}</td>
                    <td>{hist.occurrences8w}</td>
                    <td>{hist.lastNonVisitDate}</td>
                    <td>{notVisitedReasonCategoryLabel(hist.dominantReasonCategory)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </DataTableFrame>
        </GlassCard>
      </div>

      <GlassCard className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-text-muted">Detailed Drilldown (Top 100)</h2>
        <DataTableFrame>
          <table className="table-core min-w-full text-sm">
            <thead>
              <tr>
                <th>Date</th>
                <th>Week</th>
                <th>Customer</th>
                <th>Salesperson</th>
                <th>Category</th>
                <th>Reason Text</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {drilldownRows.map((row, idx) => (
                <tr key={idx}>
                  <td>{row.date}</td>
                  <td>{row.isoWeek}</td>
                  <td>{row.customerName}</td>
                  <td>{row.salesmanName}</td>
                  <td>{notVisitedReasonCategoryLabel(row.category)}</td>
                  <td className="max-w-xs truncate" title={row.reason}>
                    {row.reason}
                  </td>
                  <td>
                    <Badge tone={row.visited === 'no' ? 'error' : 'success'}>{row.visited === 'no' ? 'Not Visited' : row.visited}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </DataTableFrame>
      </GlassCard>
    </div>
  )
}
