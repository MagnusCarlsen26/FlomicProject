import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import InsightCard from '../components/admin/InsightCard'
import Stage3PlannedNotVisitedSection from '../components/admin/Stage3PlannedNotVisitedSection'
import PageSurface from '../components/layout/PageSurface'
import PageEnter from '../components/motion/PageEnter'
import Alert from '../components/ui/Alert'
import Button from '../components/ui/Button'
import DataTableFrame from '../components/ui/DataTableFrame'
import GlassCard from '../components/ui/GlassCard'
import Input from '../components/ui/Input'
import MultiSelect from '../components/ui/MultiSelect'
import { getAdminStage1PlanActual, getAdminStage2ActivityCompliance } from '../services/api'
import { POLL_INTERVAL_MS, formatDateTime, formatPercent, getErrorMessage } from './adminUtils'

function formatCallType(callType) {
  if (!callType) return 'Unknown'
  return callType.toUpperCase()
}

function formatCustomerType(customerType) {
  if (customerType === 'targeted_budgeted') return 'Targeted (Budgeted)'
  if (customerType === 'existing') return 'Existing'
  return 'Unknown'
}

function MetricsTable({ rows, labelKey, labelTitle }) {
  if (!rows?.length) {
    return <p className="rounded-xl border border-dashed border-border p-3 text-sm text-text-secondary">No data</p>
  }

  return (
    <DataTableFrame>
      <table className="table-core min-w-full text-sm">
        <thead>
          <tr>
            <th>{labelTitle}</th>
            <th>Planned</th>
            <th>Actual</th>
            <th>Variance</th>
            <th>Achievement</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={String(row.id || row[labelKey] || index)}>
              <td>{row[labelKey]}</td>
              <td>{row.plannedVisits}</td>
              <td>{row.actualVisits}</td>
              <td>{row.variance}</td>
              <td>{formatPercent(row.achievementRate)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </DataTableFrame>
  )
}

function StatusChip({ severity }) {
  const base = 'px-2 py-0.5 rounded-full text-xs font-bold uppercase'
  if (severity === 'critical') return <span className={`${base} bg-red-100 text-red-700`}>Critical</span>
  if (severity === 'warning') return <span className={`${base} bg-yellow-100 text-yellow-700`}>Warning</span>
  return <span className={`${base} bg-green-100 text-green-700`}>Compliant</span>
}

function AlertList({ alerts }) {
  if (!alerts?.length) return <span className="text-xs text-text-secondary">-</span>

  return (
    <div className="flex flex-col gap-1">
      {alerts.map((alert, index) => (
        <span key={index} className="text-[10px] leading-tight text-text-secondary">
          • {alert.message}
        </span>
      ))}
    </div>
  )
}

function DataWarning({ tone = 'warning', message }) {
  if (!message) return null
  return <Alert tone={tone}>{message}</Alert>
}

function UnifiedAdminSection() {
  const [loading, setLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [error, setError] = useState(null)
  const [successMessage, setSuccessMessage] = useState(null)
  const [combinedData, setCombinedData] = useState({ planActual: null, activityCompliance: null })
  const [dataErrors, setDataErrors] = useState({ planActual: null, activityCompliance: null })
  const [lastPolledAt, setLastPolledAt] = useState(null)

  const [query, setQuery] = useState('')
  const [week, setWeek] = useState('')
  const [salesmen, setSalesmen] = useState([])
  const [mainTeam, setMainTeam] = useState('')
  const [team, setTeam] = useState('')
  const [subTeam, setSubTeam] = useState('')

  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [month, setMonth] = useState('')
  const [callType, setCallType] = useState('')
  const [customerType, setCustomerType] = useState('')

  const [appliedFilters, setAppliedFilters] = useState({})
  const fetchCounterRef = useRef(0)

  const fetchData = useCallback(
    async ({ silent = false, showSuccess = false, filters = appliedFilters } = {}) => {
      const fetchId = fetchCounterRef.current + 1
      fetchCounterRef.current = fetchId

      if (!silent) setLoading(true)
      else setIsRefreshing(true)

      const stage1Filters = {
        q: filters.q,
        week: filters.week,
        salesmen: filters.salesmen,
        mainTeam: filters.mainTeam,
        team: filters.team,
        subTeam: filters.subTeam,
        from: filters.from,
        to: filters.to,
        month: filters.month,
        callType: filters.callType,
        customerType: filters.customerType,
      }
      const stage2Filters = {
        q: filters.q,
        week: filters.week,
        salesmen: filters.salesmen,
        mainTeam: filters.mainTeam,
        team: filters.team,
        subTeam: filters.subTeam,
      }

      try {
        const [planActualResult, activityResult] = await Promise.allSettled([
          getAdminStage1PlanActual(stage1Filters),
          getAdminStage2ActivityCompliance(stage2Filters),
        ])

        if (fetchId !== fetchCounterRef.current) return

        const nextErrors = { planActual: null, activityCompliance: null }
        const nextData = { planActual: null, activityCompliance: null }

        if (planActualResult.status === 'fulfilled') {
          nextData.planActual = planActualResult.value || null
        } else {
          nextErrors.planActual = getErrorMessage(planActualResult.reason)
        }

        if (activityResult.status === 'fulfilled') {
          nextData.activityCompliance = activityResult.value || null
        } else {
          nextErrors.activityCompliance = getErrorMessage(activityResult.reason)
        }

        setCombinedData(nextData)
        setDataErrors(nextErrors)
        setLastPolledAt(new Date().toISOString())

        if (nextErrors.planActual && nextErrors.activityCompliance) {
          setError('Unable to load dashboard data right now.')
          setSuccessMessage(null)
        } else {
          setError(null)
          if (!silent && showSuccess) setSuccessMessage('Dashboard data refreshed.')
        }
      } catch (e) {
        if (fetchId !== fetchCounterRef.current) return
        setError(getErrorMessage(e))
        setSuccessMessage(null)
      } finally {
        if (!silent) setLoading(false)
        else setIsRefreshing(false)
      }
    },
    [appliedFilters],
  )

  useEffect(() => {
    fetchData()
  }, [fetchData])

  useEffect(() => {
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') fetchData({ silent: true })
    }, POLL_INTERVAL_MS)

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') fetchData({ silent: true })
    }

    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [fetchData])

  const planActualData = combinedData.planActual
  const activityData = combinedData.activityCompliance

  const mergedFilterOptions = useMemo(() => {
    const source = planActualData?.filterOptions || activityData?.filterOptions || {}
    return {
      salesmen: source.salesmen || [],
      mainTeam: source.mainTeam || [],
      team: source.team || [],
      subTeam: source.subTeam || [],
      callType: source.callType || [],
      customerType: source.customerType || [],
      teamHierarchy: source.teamHierarchy || {},
      mainTeamSalesmenMap: source.mainTeamSalesmenMap || {},
      teamSalesmenMap: source.teamSalesmenMap || {},
      subTeamSalesmenMap: source.subTeamSalesmenMap || {},
    }
  }, [activityData, planActualData])

  const filteredTeamOptions = useMemo(() => {
    const allTeams = mergedFilterOptions.team
    if (!mainTeam) return allTeams

    const salesRows = planActualData?.hierarchyRollups?.salesperson || []
    if (!salesRows.length) return allTeams

    const teamSet = new Set()
    salesRows.forEach((row) => {
      if (row.mainTeam === mainTeam && row.team) teamSet.add(row.team)
    })
    return Array.from(teamSet).sort((a, b) => a.localeCompare(b))
  }, [mainTeam, mergedFilterOptions.team, planActualData])

  const filteredSubTeamOptions = useMemo(() => {
    if (!team) return mergedFilterOptions.subTeam
    return mergedFilterOptions.teamHierarchy[team] || []
  }, [mergedFilterOptions, team])

  const filteredSalesmenOptions = useMemo(() => {
    const allSalesmen = mergedFilterOptions.salesmen
    if (subTeam) return mergedFilterOptions.subTeamSalesmenMap[subTeam] || []
    if (team) return mergedFilterOptions.teamSalesmenMap[team] || []
    if (mainTeam) return mergedFilterOptions.mainTeamSalesmenMap[mainTeam] || []
    return allSalesmen
  }, [mergedFilterOptions, mainTeam, team, subTeam])

  useEffect(() => {
    if (!team) return
    if (!filteredTeamOptions.includes(team)) {
      setTeam('')
      setSubTeam('')
    }
  }, [filteredTeamOptions, team])

  useEffect(() => {
    if (!subTeam) return
    if (!filteredSubTeamOptions.includes(subTeam)) {
      setSubTeam('')
    }
  }, [filteredSubTeamOptions, subTeam])

  useEffect(() => {
    if (!salesmen.length) return
    const allowedIds = new Set(filteredSalesmenOptions.map((option) => option.id))
    const nextSalesmen = salesmen.filter((id) => allowedIds.has(id))
    if (nextSalesmen.length !== salesmen.length) setSalesmen(nextSalesmen)
  }, [filteredSalesmenOptions, salesmen])

  const handleApplyFilters = () => {
    const nextFilters = {
      q: query || undefined,
      week: week || undefined,
      salesmen,
      mainTeam: mainTeam || undefined,
      team: team || undefined,
      subTeam: subTeam || undefined,
      from: week || month ? undefined : fromDate || undefined,
      to: week || month ? undefined : toDate || undefined,
      month: month || undefined,
      callType: callType || undefined,
      customerType: customerType || undefined,
    }

    setAppliedFilters(nextFilters)
    setSuccessMessage('Filters applied.')
  }

  const handleResetFilters = () => {
    setQuery('')
    setWeek('')
    setSalesmen([])
    setMainTeam('')
    setTeam('')
    setSubTeam('')
    setFromDate('')
    setToDate('')
    setMonth('')
    setCallType('')
    setCustomerType('')
    setAppliedFilters({})
    setSuccessMessage(null)
  }

  const callTypeRows = (planActualData?.breakdowns?.callType || []).map((row) => ({
    ...row,
    label: formatCallType(row.callType),
  }))
  const customerTypeRows = (planActualData?.breakdowns?.customerType || []).map((row) => ({
    ...row,
    label: formatCustomerType(row.customerType),
  }))

  const topOver = planActualData?.topPerformers?.overAchievers || []
  const topUnder = planActualData?.topPerformers?.underAchievers || []
  const visitDrilldownRows = useMemo(() => (planActualData?.drilldownRows || []).slice(0, 25), [planActualData])
  const activityDrilldownRows = useMemo(() => (activityData?.drilldown || []).slice(0, 25), [activityData])

  return (
    <div className="space-y-4">
      <GlassCard className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-text-primary">Operations Overview</h2>
            <p className="mt-1 text-sm text-text-secondary">Unified performance and compliance monitoring dashboard.</p>
          </div>
          <Button variant="secondary" onClick={() => fetchData({ showSuccess: true })} disabled={loading || isRefreshing}>
            {loading || isRefreshing ? 'Refreshing...' : 'Refresh'}
          </Button>
        </div>

        <p className="text-sm text-text-secondary">Last refresh: {formatDateTime(lastPolledAt)}</p>

        <div className="grid grid-cols-1 gap-4 rounded-2xl border border-border bg-surface/50 p-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-text-muted">Search</label>
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Name or email" />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-text-muted">Week</label>
            <Input type="week" value={week} onChange={(e) => setWeek(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-text-muted">Salespeople</label>
            <MultiSelect
              options={filteredSalesmenOptions}
              selected={salesmen}
              onChange={setSalesmen}
              placeholder="All salespeople"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-text-muted">Main Team</label>
            <select
              className="input-core"
              value={mainTeam}
              onChange={(e) => {
                setMainTeam(e.target.value)
                setTeam('')
                setSubTeam('')
                setSalesmen([])
              }}
            >
              <option value="">All</option>
              {mergedFilterOptions.mainTeam.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-text-muted">Team</label>
            <select
              className="input-core"
              value={team}
              onChange={(e) => {
                setTeam(e.target.value)
                setSubTeam('')
                setSalesmen([])
              }}
            >
              <option value="">All</option>
              {filteredTeamOptions.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-text-muted">Sub Team</label>
            <select
              className="input-core"
              value={subTeam}
              onChange={(e) => {
                setSubTeam(e.target.value)
                setSalesmen([])
              }}
            >
              <option value="">All</option>
              {filteredSubTeamOptions.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 rounded-2xl border border-border bg-surface/40 p-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-text-muted">From Date</label>
            <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} disabled={Boolean(week || month)} />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-text-muted">To Date</label>
            <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} disabled={Boolean(week || month)} />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-text-muted">Month</label>
            <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} disabled={Boolean(week)} />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-text-muted">Call Type</label>
            <select className="input-core" value={callType} onChange={(e) => setCallType(e.target.value)}>
              <option value="">All</option>
              {mergedFilterOptions.callType.map((item) => (
                <option key={item} value={item}>
                  {formatCallType(item)}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-text-muted">Customer Type</label>
            <select className="input-core" value={customerType} onChange={(e) => setCustomerType(e.target.value)}>
              <option value="">All</option>
              {mergedFilterOptions.customerType.map((item) => (
                <option key={item} value={item}>
                  {formatCustomerType(item)}
                </option>
              ))}
            </select>
          </div>

          <div className="sm:col-span-2 lg:col-span-3 xl:col-span-5 flex items-end gap-2">
            <Button onClick={handleApplyFilters} className="flex-1">
              Apply
            </Button>
            <Button variant="secondary" onClick={handleResetFilters}>
              Reset
            </Button>
          </div>
        </div>

        <div className="space-y-3">
          {error ? <Alert tone="error">{error}</Alert> : null}
          {successMessage && !error ? <Alert tone="success">{successMessage}</Alert> : null}
        </div>
      </GlassCard>

      <GlassCard className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-text-muted">Visit Performance</h2>
          <DataWarning message={dataErrors.planActual} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <InsightCard title="Planned Visits" value={String(planActualData?.totals?.plannedVisits || 0)} />
          <InsightCard title="Actual Visits" value={String(planActualData?.totals?.actualVisits || 0)} />
          <InsightCard title="Variance" value={String(planActualData?.totals?.variance || 0)} />
          <InsightCard title="Achievement" value={formatPercent(planActualData?.totals?.achievementRate || 0)} />
        </div>
      </GlassCard>

      <GlassCard className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-text-muted">Compliance Snapshot</h2>
          <DataWarning message={dataErrors.activityCompliance} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <InsightCard title="Compliant" value={String(activityData?.summary?.compliantCount || 0)} />
          <InsightCard title="Non-Compliant" value={String(activityData?.summary?.nonCompliantCount || 0)} />
          <InsightCard title="Critical Alerts" value={String(activityData?.summary?.alertBreakdown?.severity?.critical || 0)} />
          <InsightCard title="Warning Alerts" value={String(activityData?.summary?.alertBreakdown?.severity?.warning || 0)} />
        </div>
      </GlassCard>

      <GlassCard className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-text-muted">Daily Trend</h2>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={planActualData?.dailyTrend || []}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Legend />
              <Bar dataKey="plannedVisits" name="Planned" fill="#60a5fa" />
              <Bar dataKey="actualVisits" name="Actual" fill="#34d399" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </GlassCard>

      <div className="grid gap-4 xl:grid-cols-2">
        <GlassCard className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-text-muted">Weekly Summary</h2>
          <MetricsTable rows={planActualData?.weeklySummary || []} labelKey="isoWeek" labelTitle="Week" />
        </GlassCard>
        <GlassCard className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-text-muted">Monthly Rollup</h2>
          <MetricsTable rows={planActualData?.monthlyRollup || []} labelKey="month" labelTitle="Month" />
        </GlassCard>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <GlassCard className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-text-muted">Call Type Split</h2>
          <MetricsTable rows={callTypeRows} labelKey="label" labelTitle="Call Type" />
        </GlassCard>
        <GlassCard className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-text-muted">Customer Type Split</h2>
          <MetricsTable rows={customerTypeRows} labelKey="label" labelTitle="Customer Type" />
        </GlassCard>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <GlassCard className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-text-muted">Top Over-Achievers</h2>
          <MetricsTable rows={topOver} labelKey="name" labelTitle="Salesperson" />
        </GlassCard>
        <GlassCard className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-text-muted">Top Under-Achievers</h2>
          <MetricsTable rows={topUnder} labelKey="name" labelTitle="Salesperson" />
        </GlassCard>
      </div>

      <GlassCard className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-text-muted">Salesperson Performance Rollup</h2>
        <DataTableFrame>
          <table className="table-core min-w-full text-sm">
            <thead>
              <tr>
                <th>Salesperson</th>
                <th>Main Team</th>
                <th>Team</th>
                <th>Sub Team</th>
                <th>Planned</th>
                <th>Actual</th>
                <th>Variance</th>
                <th>Achievement</th>
              </tr>
            </thead>
            <tbody>
              {(planActualData?.hierarchyRollups?.salesperson || []).map((row) => (
                <tr key={row.id}>
                  <td>{row.name || row.email}</td>
                  <td>{row.mainTeam || '-'}</td>
                  <td>{row.team || '-'}</td>
                  <td>{row.subTeam || '-'}</td>
                  <td>{row.plannedVisits}</td>
                  <td>{row.actualVisits}</td>
                  <td>{row.variance}</td>
                  <td>{formatPercent(row.achievementRate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </DataTableFrame>
      </GlassCard>

      <div className="grid gap-4 xl:grid-cols-2">
        <GlassCard className="space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-text-muted">Compliance by Salesperson</h2>
          <DataTableFrame>
            <table className="table-core min-w-full text-sm">
              <thead>
                <tr>
                  <th>Salesperson</th>
                  <th>Team</th>
                  <th>Total Calls</th>
                  <th>NC</th>
                  <th>JSV</th>
                  <th>FC</th>
                  <th>SC</th>
                  <th>Status</th>
                  <th>Alerts</th>
                </tr>
              </thead>
              <tbody>
                {(activityData?.salespersonCards || []).map((card) => (
                  <tr key={card.salesman.id}>
                    <td>{card.salesman.name}</td>
                    <td>{card.salesman.team}</td>
                    <td>{card.stats.totalCalls}</td>
                    <td>{card.stats.ncCount}</td>
                    <td>{card.stats.jsvCount}</td>
                    <td>{card.stats.fcCount}</td>
                    <td>{card.stats.scCount}</td>
                    <td>
                      <StatusChip severity={card.alerts.length > 0 ? card.alerts[0].severity : 'compliant'} />
                    </td>
                    <td>
                      <AlertList alerts={card.alerts} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </DataTableFrame>
        </GlassCard>

        <GlassCard className="space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-text-muted">Admin Monitoring</h2>
          <DataTableFrame>
            <table className="table-core min-w-full text-sm">
              <thead>
                <tr>
                  <th>Admin</th>
                  <th>Total JSV</th>
                  <th>Status</th>
                  <th>Top Contributor</th>
                  <th>Alerts</th>
                </tr>
              </thead>
              <tbody>
                {(activityData?.adminCards || []).map((card) => {
                  const top = [...card.salespersonBreakdown].sort((a, b) => b.sharePct - a.sharePct)[0]
                  return (
                    <tr key={card.admin.id}>
                      <td>{card.admin.name}</td>
                      <td>{card.jsvCount}</td>
                      <td>
                        <StatusChip
                          severity={
                            card.alerts.find((a) => a.severity === 'critical')
                              ? 'critical'
                              : card.alerts.length > 0
                                ? 'warning'
                                : 'compliant'
                          }
                        />
                      </td>
                      <td>{top ? `${top.name} (${Math.round(top.sharePct * 100)}%)` : '-'}</td>
                      <td>
                        <AlertList alerts={card.alerts} />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </DataTableFrame>
        </GlassCard>
      </div>

      <GlassCard className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-text-muted">Recent Activity / Drilldown</h2>
        <DataTableFrame>
          <table className="table-core min-w-full text-sm">
            <thead>
              <tr>
                <th>Source</th>
                <th>Date</th>
                <th>Week</th>
                <th>Salesperson</th>
                <th>Team</th>
                <th>Customer</th>
                <th>Type</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {visitDrilldownRows.map((row, index) => (
                <tr key={`visit-${row.date}-${row.salesman?.id || index}`}>
                  <td>Visits</td>
                  <td>{row.date || '-'}</td>
                  <td>{row.isoWeek || '-'}</td>
                  <td>{row.salesman?.name || row.salesman?.email || '-'}</td>
                  <td>{row.salesman?.team || '-'}</td>
                  <td>{row.customerName || '-'}</td>
                  <td>{formatCallType(row.callType)}</td>
                  <td>{row.visited ? 'Visited' : 'Planned only'}</td>
                </tr>
              ))}
              {activityDrilldownRows.map((row, index) => (
                <tr key={`activity-${row.salesperson?.id || index}-${row.date || index}`}>
                  <td>Compliance</td>
                  <td>{row.date || '-'}</td>
                  <td>{week || '-'}</td>
                  <td>{row.salesperson?.name || '-'}</td>
                  <td>{row.salesperson?.team || '-'}</td>
                  <td>{row.customerName || '-'}</td>
                  <td>{String(row.type || '-').toUpperCase()}</td>
                  <td>{row.type ? 'Logged' : '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </DataTableFrame>
      </GlassCard>
    </div>
  )
}

export default function AdminPage() {
  return (
    <PageEnter>
      <PageSurface>
        <GlassCard className="space-y-2">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-primary">Admin</p>
          <h1 className="text-2xl font-bold text-text-primary">Operations Hub</h1>
          <p className="text-sm text-text-secondary">Unified dashboard for performance, productivity, and compliance tracking.</p>
        </GlassCard>

        <UnifiedAdminSection />
        <Stage3PlannedNotVisitedSection />
      </PageSurface>
    </PageEnter>
  )
}
