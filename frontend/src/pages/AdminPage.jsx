import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import PageSurface from '../components/layout/PageSurface'
import PageEnter from '../components/motion/PageEnter'
import Alert from '../components/ui/Alert'
import Button from '../components/ui/Button'
import DataTableFrame from '../components/ui/DataTableFrame'
import GlassCard from '../components/ui/GlassCard'
import Input from '../components/ui/Input'
import InsightCard from '../components/admin/InsightCard'
import MultiSelect from '../components/ui/MultiSelect'
import { getAdminStage1PlanActual, getAdminStage2ActivityCompliance } from '../services/api'
import { POLL_INTERVAL_MS, formatDateTime, formatPercent, getErrorMessage } from './adminUtils'

function formatCallType(callType) {
  if (!callType) {
    return 'Unknown'
  }
  return callType.toUpperCase()
}

function formatCustomerType(customerType) {
  if (customerType === 'targeted_budgeted') {
    return 'Targeted (Budgeted)'
  }
  if (customerType === 'existing') {
    return 'Existing'
  }
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

function Stage1Section() {
  const [loading, setLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [error, setError] = useState(null)
  const [successMessage, setSuccessMessage] = useState(null)
  const [data, setData] = useState(null)
  const [lastPolledAt, setLastPolledAt] = useState(null)
  const [query, setQuery] = useState('')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [week, setWeek] = useState('')
  const [month, setMonth] = useState('')
  const [salesmen, setSalesmen] = useState([])
  const [callType, setCallType] = useState('')
  const [customerType, setCustomerType] = useState('')
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
        const response = await getAdminStage1PlanActual(filters)
        if (fetchId !== fetchCounterRef.current) {
          return
        }
        setData(response || null)
        setError(null)
        setLastPolledAt(new Date().toISOString())
        if (!silent && showSuccess) {
          setSuccessMessage('Stage 1 data refreshed.')
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
      callType: callType || undefined,
      customerType: customerType || undefined,
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
    setCallType('')
    setCustomerType('')
    setMainTeam('')
    setTeam('')
    setSubTeam('')
    setAppliedFilters({})
  }

  const dailyTrend = data?.dailyTrend || []
  const weeklySummary = data?.weeklySummary || []
  const monthlyRollup = data?.monthlyRollup || []
  const filteredTeamOptions = useMemo(() => {
    const allTeams = data?.filterOptions?.team || []
    if (!mainTeam) {
      return allTeams
    }

    const salesRows = data?.hierarchyRollups?.salesperson || []
    const teamSet = new Set()
    salesRows.forEach((row) => {
      if (row.mainTeam === mainTeam && row.team) {
        teamSet.add(row.team)
      }
    })
    return Array.from(teamSet).sort((a, b) => a.localeCompare(b))
  }, [data, mainTeam])
  const filteredSubTeamOptions = useMemo(() => {
    if (!team) {
      return data?.filterOptions?.subTeam || []
    }
    return data?.filterOptions?.teamHierarchy?.[team] || []
  }, [data, team])
  const filteredSalesmenOptions = useMemo(() => {
    const allSalesmen = data?.filterOptions?.salesmen || []
    if (subTeam) {
      return data?.filterOptions?.subTeamSalesmenMap?.[subTeam] || []
    }
    if (team) {
      return data?.filterOptions?.teamSalesmenMap?.[team] || []
    }
    if (mainTeam) {
      return data?.filterOptions?.mainTeamSalesmenMap?.[mainTeam] || []
    }
    return allSalesmen
  }, [data, mainTeam, team, subTeam])

  useEffect(() => {
    if (!team) {
      return
    }
    if (!filteredTeamOptions.includes(team)) {
      setTeam('')
      setSubTeam('')
    }
  }, [filteredTeamOptions, team])

  useEffect(() => {
    if (!subTeam) {
      return
    }
    if (!filteredSubTeamOptions.includes(subTeam)) {
      setSubTeam('')
    }
  }, [filteredSubTeamOptions, subTeam])

  useEffect(() => {
    if (!salesmen.length) {
      return
    }
    const allowedIds = new Set(filteredSalesmenOptions.map((option) => option.id))
    const nextSalesmen = salesmen.filter((id) => allowedIds.has(id))
    if (nextSalesmen.length !== salesmen.length) {
      setSalesmen(nextSalesmen)
    }
  }, [filteredSalesmenOptions, salesmen])

  const callTypeRows = (data?.breakdowns?.callType || []).map((row) => ({
    ...row,
    label: formatCallType(row.callType),
  }))
  const customerTypeRows = (data?.breakdowns?.customerType || []).map((row) => ({
    ...row,
    label: formatCustomerType(row.customerType),
  }))
  const topOver = data?.topPerformers?.overAchievers || []
  const topUnder = data?.topPerformers?.underAchievers || []
  const drilldownRows = useMemo(() => (data?.drilldownRows || []).slice(0, 50), [data])

  return (
    <div className="space-y-4">
      <GlassCard className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-primary">Stage 1</p>
            <h2 className="mt-1 text-2xl font-bold text-text-primary">Plan vs Actual</h2>
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
            <label className="text-xs font-semibold uppercase tracking-wider text-text-muted">Search</label>
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Name or email" />
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
              options={filteredSalesmenOptions}
              selected={salesmen}
              onChange={setSalesmen}
              placeholder="All salespeople"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-text-muted">Call Type</label>
            <select className="input-core" value={callType} onChange={(e) => setCallType(e.target.value)}>
              <option value="">All</option>
              {(data?.filterOptions?.callType || []).map((item) => (
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
              {(data?.filterOptions?.customerType || []).map((item) => (
                <option key={item} value={item}>
                  {formatCustomerType(item)}
                </option>
              ))}
            </select>
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
              {(data?.filterOptions?.mainTeam || []).map((item) => (
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
          <div className="flex items-end gap-2">
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
        <h2 className="text-sm font-semibold uppercase tracking-wide text-text-muted">Stage 1 KPIs</h2>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <InsightCard title="Planned Visits" value={String(data?.totals?.plannedVisits || 0)} />
          <InsightCard title="Actual Visits" value={String(data?.totals?.actualVisits || 0)} />
          <InsightCard title="Variance" value={String(data?.totals?.variance || 0)} />
          <InsightCard title="Achievement" value={formatPercent(data?.totals?.achievementRate || 0)} />
        </div>
      </GlassCard>

      <GlassCard className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-text-muted">Daily Trend</h2>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={dailyTrend}>
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
          <MetricsTable rows={weeklySummary} labelKey="isoWeek" labelTitle="Week" />
        </GlassCard>
        <GlassCard className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-text-muted">Monthly Rollup</h2>
          <MetricsTable rows={monthlyRollup} labelKey="month" labelTitle="Month" />
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

      <div className="grid gap-4">
        <GlassCard className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-text-muted">Salesperson Rollup</h2>
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
                {(data?.hierarchyRollups?.salesperson || []).map((row) => (
                  <tr key={row.id}>
                    <td>{row.name || row.email}</td>
                    <td>{row.mainTeam}</td>
                    <td>{row.team}</td>
                    <td>{row.subTeam}</td>
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

        <div className="grid gap-4 xl:grid-cols-3">
          <GlassCard className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-text-muted">Main Team Rollup</h2>
            <MetricsTable rows={data?.hierarchyRollups?.mainTeam || []} labelKey="label" labelTitle="Main Team" />
          </GlassCard>
          <GlassCard className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-text-muted">Team Rollup</h2>
            <MetricsTable rows={data?.hierarchyRollups?.team || []} labelKey="label" labelTitle="Team" />
          </GlassCard>
          <GlassCard className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-text-muted">Sub Team Rollup</h2>
            <MetricsTable rows={data?.hierarchyRollups?.subTeam || []} labelKey="label" labelTitle="Sub Team" />
          </GlassCard>
        </div>
      </div>

      <GlassCard className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-text-muted">Row-Level Drilldown (Top 50)</h2>
        <DataTableFrame>
          <table className="table-core min-w-full text-sm">
            <thead>
              <tr>
                <th>Date</th>
                <th>Week</th>
                <th>Salesperson</th>
                <th>Main Team</th>
                <th>Team</th>
                <th>Sub Team</th>
                <th>Customer</th>
                <th>Location</th>
                <th>Call Type</th>
                <th>Customer Type</th>
                <th>Visited</th>
              </tr>
            </thead>
            <tbody>
              {drilldownRows.map((row, index) => (
                <tr key={`${row.date}-${row.salesman.id}-${index}`}>
                  <td>{row.date}</td>
                  <td>{row.isoWeek}</td>
                  <td>{row.salesman.name || row.salesman.email}</td>
                  <td>{row.salesman.mainTeam}</td>
                  <td>{row.salesman.team}</td>
                  <td>{row.salesman.subTeam}</td>
                  <td>{row.customerName || '-'}</td>
                  <td>{row.locationArea || '-'}</td>
                  <td>{formatCallType(row.callType)}</td>
                  <td>{formatCustomerType(row.customerType)}</td>
                  <td>{row.visited ? 'Yes' : 'No'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </DataTableFrame>
      </GlassCard>
    </div>
  )
}

function Stage2Section() {
  const [loading, setLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [error, setError] = useState(null)
  const [successMessage, setSuccessMessage] = useState(null)
  const [data, setData] = useState(null)
  const [lastPolledAt, setLastPolledAt] = useState(null)
  const [query, setQuery] = useState('')
  const [week, setWeek] = useState('')
  const [salesmen, setSalesmen] = useState([])
  const [mainTeam, setMainTeam] = useState('')
  const [team, setTeam] = useState('')
  const [subTeam, setSubTeam] = useState('')
  const [appliedFilters, setAppliedFilters] = useState({})
  const fetchCounterRef = useRef(0)

  const fetchData = useCallback(
    async ({ silent = false, showSuccess = false, filters = appliedFilters } = {}) => {
      const fetchId = fetchCounterRef.current + 1
      fetchCounterRef.current = fetchId

      if (!silent) setLoading(true)
      else setIsRefreshing(true)

      try {
        const response = await getAdminStage2ActivityCompliance(filters)
        if (fetchId !== fetchCounterRef.current) return
        setData(response || null)
        setError(null)
        setLastPolledAt(new Date().toISOString())
        if (!silent && showSuccess) setSuccessMessage('Stage 2 data refreshed.')
      } catch (e) {
        if (fetchId !== fetchCounterRef.current) return
        setError(getErrorMessage(e))
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
    return () => clearInterval(interval)
  }, [fetchData])

  const handleApplyFilters = () => {
    setAppliedFilters({
      q: query || undefined,
      week: week || undefined,
      salesmen,
      mainTeam: mainTeam || undefined,
      team: team || undefined,
      subTeam: subTeam || undefined,
    })
    setSuccessMessage('Filters applied.')
  }

  const handleResetFilters = () => {
    setQuery('')
    setWeek('')
    setSalesmen([])
    setMainTeam('')
    setTeam('')
    setSubTeam('')
    setAppliedFilters({})
  }

  const drilldownRows = useMemo(() => (data?.drilldown || []).slice(0, 50), [data])

  return (
    <div className="space-y-4">
      <GlassCard className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-primary">Stage 2</p>
            <h2 className="mt-1 text-2xl font-bold text-text-primary">Activity Compliance</h2>
            <p className="mt-1 text-sm text-text-secondary">
              Week {data?.week?.key || '-'} ({data?.week?.start} to {data?.week?.end})
            </p>
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
              options={data?.filterOptions?.salesmen || []}
              selected={salesmen}
              onChange={setSalesmen}
              placeholder="All salespeople"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-text-muted">Main Team</label>
            <select className="input-core" value={mainTeam} onChange={(e) => setMainTeam(e.target.value)}>
              <option value="">All</option>
              {(data?.filterOptions?.mainTeam || []).map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-text-muted">Team</label>
            <select className="input-core" value={team} onChange={(e) => setTeam(e.target.value)}>
              <option value="">All</option>
              {(data?.filterOptions?.team || []).map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-end gap-2">
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
        <h2 className="text-sm font-semibold uppercase tracking-wide text-text-muted">Compliance Overview</h2>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <InsightCard title="Compliant" value={String(data?.summary?.compliantCount || 0)} />
          <InsightCard title="Non-Compliant" value={String(data?.summary?.nonCompliantCount || 0)} />
          <InsightCard title="Critical Alerts" value={String(data?.summary?.alertBreakdown?.severity?.critical || 0)} />
          <InsightCard title="Warning Alerts" value={String(data?.summary?.alertBreakdown?.severity?.warning || 0)} />
        </div>
      </GlassCard>

      <GlassCard className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-text-muted">Salesperson Compliance</h2>
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
              {(data?.salespersonCards || []).map((card) => (
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
                    <div className="flex flex-col gap-1">
                      {card.alerts.map((alert, i) => (
                        <span key={i} className="text-[10px] leading-tight text-text-secondary">
                          • {alert.message}
                        </span>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </DataTableFrame>
      </GlassCard>

      <GlassCard className="space-y-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-text-muted">Admin Monitoring (JSV Target: 5/week)</h2>
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
              {(data?.adminCards || []).map((card) => {
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
                      <div className="flex flex-col gap-1">
                        {card.alerts.map((alert, i) => (
                          <span key={i} className="text-[10px] leading-tight text-text-secondary">
                            • {alert.message}
                          </span>
                        ))}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </DataTableFrame>
      </GlassCard>

      <GlassCard className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-text-muted">Row-Level Drilldown (Top 50)</h2>
        <DataTableFrame>
          <table className="table-core min-w-full text-sm">
            <thead>
              <tr>
                <th>Salesperson</th>
                <th>Date</th>
                <th>Type</th>
                <th>Customer</th>
              </tr>
            </thead>
            <tbody>
              {drilldownRows.map((row, index) => (
                <tr key={index}>
                  <td>{row.salesperson.name}</td>
                  <td>{row.date}</td>
                  <td>{row.type.toUpperCase()}</td>
                  <td>{row.customerName}</td>
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
          <p className="text-sm text-text-secondary">Unified dashboard for Stage 1 plan vs actual and Stage 2 activity compliance.</p>
        </GlassCard>

        <Stage1Section />
        <Stage2Section />
      </PageSurface>
    </PageEnter>
  )
}
