import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis, PieChart, Pie, Cell } from 'recharts'
import PageSurface from '../components/layout/PageSurface'
import PageEnter from '../components/motion/PageEnter'
import Alert from '../components/ui/Alert'
import Button from '../components/ui/Button'
import DataTableFrame from '../components/ui/DataTableFrame'
import GlassCard from '../components/ui/GlassCard'
import Input from '../components/ui/Input'
import InsightCard from '../components/admin/InsightCard'
import MultiSelect from '../components/ui/MultiSelect'
import { getAdminStage3PlannedNotVisited } from '../services/api'
import { POLL_INTERVAL_MS, formatDateTime, formatPercent, getErrorMessage } from './adminUtils'
import { notVisitedReasonCategoryLabel } from '../constants/weeklyReportFields'

const COLORS = ['#60a5fa', '#34d399', '#fbbf24', '#f87171', '#a78bfa', '#94a3b8']

export default function AdminStage3PlannedNotVisitedPage() {
  const [loading, setLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [error, setError] = useState(null)
  const [successMessage, setSuccessMessage] = useState(null)
  const [data, setData] = useState(null)
  const [lastPolledAt, setLastPolledAt] = useState(null)

  // Filters
  const [query, setQuery] = useState('')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [week, setWeek] = useState('')
  const [month, setMonth] = useState('')
  const [salesmen, setSalesmen] = useState([])
  const [reasonCategory, setReasonCategory] = useState('')
  const [customer, setCustomer] = useState('')
  const [mainTeam, setMainTeam] = useState('')
  const [team, setTeam] = useState('')
  const [subTeam, setSubTeam] = useState('')
  const [appliedFilters, setAppliedFilters] = useState({})

  const fetchCounterRef = useRef(0)

  const fetchData = useCallback(
    async ({ silent = false, showSuccess = false, filters = appliedFilters } = {}) => {
      const fetchId = fetchCounterRef.current + 1
      fetchCounterRef.current = fetchId

      if (!silent) {
        setLoading(true)
      } else {
        setIsRefreshing(true)
      }

      try {
        const response = await getAdminStage3PlannedNotVisited(filters)
        if (fetchId !== fetchCounterRef.current) return
        setData(response || null)
        setError(null)
        setLastPolledAt(new Date().toISOString())
        if (!silent && showSuccess) {
          setSuccessMessage('Dashboard refreshed.')
        }
      } catch (e) {
        if (fetchId !== fetchCounterRef.current) return
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
    [appliedFilters]
  )

  useEffect(() => {
    fetchData()
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

  const handleApplyFilters = () => {
    const nextFilters = {
      q: query || undefined,
      from: week || month ? undefined : fromDate || undefined,
      to: week || month ? undefined : toDate || undefined,
      week: week || undefined,
      month: month || undefined,
      salesmen,
      reasonCategory: reasonCategory || undefined,
      customer: customer || undefined,
      mainTeam: mainTeam || undefined,
      team: team || undefined,
      subTeam: subTeam || undefined,
    }
    setAppliedFilters(nextFilters)
    setSuccessMessage('Filters applied.')
  }

  const handleResetFilters = () => {
    setQuery('')
    setFromDate('')
    setToDate('')
    setWeek('')
    setMonth('')
    setSalesmen([])
    setReasonCategory('')
    setCustomer('')
    setMainTeam('')
    setTeam('')
    setSubTeam('')
    setAppliedFilters({})
  }

  const weeklyTrend = data?.weeklyTrend || []
  const reasonDistribution = (data?.reasonDistribution || []).map(item => ({
    name: notVisitedReasonCategoryLabel(item.reasonCategory),
    value: item.count
  }))
  const salespersonRates = data?.salespersonRates || []
  const topRepeatedCustomers = data?.topRepeatedCustomers || []
  const drilldownRows = useMemo(() => data?.drilldownRows || [], [data])

  return (
    <PageEnter>
      <PageSurface>
        <GlassCard className="space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.16em] text-primary">Admin</p>
              <h1 className="mt-1 text-2xl font-bold text-text-primary">Stage 3: Planned but Not Visited</h1>
              <p className="mt-1 text-sm text-text-secondary">
                Range {data?.range?.from || '-'} to {data?.range?.to || '-'} ({data?.range?.timezone || '-'})
              </p>
            </div>
            <Button variant="secondary" onClick={() => fetchData({ showSuccess: true })} disabled={loading || isRefreshing}>
              {loading || isRefreshing ? 'Refreshing...' : 'Refresh'}
            </Button>
          </div>

          <p className="text-sm text-text-secondary">Last refresh: {formatDateTime(lastPolledAt)}</p>

          <div className="grid grid-cols-1 gap-4 rounded-2xl border border-border bg-surface/50 p-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-text-muted">Search Salesman</label>
              <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Name or email" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-text-muted">Customer Name</label>
              <Input value={customer} onChange={(e) => setCustomer(e.target.value)} placeholder="Filter customer..." />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-text-muted">From Date</label>
              <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} disabled={Boolean(week || month)} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-text-muted">To Date</label>
              <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} disabled={Boolean(week || month)} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-text-muted">Week</label>
              <Input type="week" value={week} onChange={(e) => setWeek(e.target.value)} disabled={Boolean(month)} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-text-muted">Month</label>
              <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} disabled={Boolean(week)} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-text-muted">Salespeople</label>
              <MultiSelect
                options={data?.filterOptions?.salesmen || []}
                selected={salesmen}
                onChange={setSalesmen}
                placeholder="All salespeople"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-text-muted">Reason Category</label>
              <select className="input-core" value={reasonCategory} onChange={(e) => setReasonCategory(e.target.value)}>
                <option value="">All Categories</option>
                {(data?.filterOptions?.reasonCategories || []).map((item) => (
                  <option key={item} value={item}>
                    {notVisitedReasonCategoryLabel(item)}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-text-muted">Main Team</label>
              <select className="input-core" value={mainTeam} onChange={(e) => setMainTeam(e.target.value)}>
                <option value="">All</option>
                {(data?.filterOptions?.mainTeam || []).map(item => <option key={item} value={item}>{item}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-text-muted">Team</label>
              <select className="input-core" value={team} onChange={(e) => setTeam(e.target.value)}>
                <option value="">All</option>
                {(data?.filterOptions?.team || []).map(item => <option key={item} value={item}>{item}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-text-muted">Sub Team</label>
              <select className="input-core" value={subTeam} onChange={(e) => setSubTeam(e.target.value)}>
                <option value="">All</option>
                {(data?.filterOptions?.subTeam || []).map(item => <option key={item} value={item}>{item}</option>)}
              </select>
            </div>
            <div className="flex items-end gap-2">
              <Button onClick={handleApplyFilters} className="flex-1">Apply</Button>
              <Button variant="secondary" onClick={handleResetFilters}>Reset</Button>
            </div>
          </div>

          <div className="space-y-3">
            {error ? <Alert tone="error">{error}</Alert> : null}
            {successMessage && !error ? <Alert tone="success">{successMessage}</Alert> : null}
          </div>
        </GlassCard>

        <div className="grid gap-4 sm:grid-cols-3">
          <InsightCard title="Planned Visits" value={String(data?.totals?.plannedVisits || 0)} />
          <InsightCard title="Missed Visits" value={String(data?.totals?.plannedButNotVisitedCount || 0)} />
          <InsightCard title="Non-Visit Rate" value={formatPercent(data?.totals?.nonVisitRate || 0)} />
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
          <GlassCard className="space-y-4">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-text-muted">Weekly Trend (Non-Visit Rate)</h2>
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
                    <td className="max-w-xs truncate" title={row.reason}>{row.reason}</td>
                    <td>
                      <Badge tone={row.visited === 'no' ? 'error' : 'success'}>
                        {row.visited === 'no' ? 'Not Visited' : row.visited}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </DataTableFrame>
        </GlassCard>
      </PageSurface>
    </PageEnter>
  )
}
