import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import PageSurface from '../components/layout/PageSurface'
import PageEnter from '../components/motion/PageEnter'
import Alert from '../components/ui/Alert'
import Button from '../components/ui/Button'
import DataTableFrame from '../components/ui/DataTableFrame'
import GlassCard from '../components/ui/GlassCard'
import Input from '../components/ui/Input'
import InsightCard from '../components/admin/InsightCard'
import MultiSelect from '../components/ui/MultiSelect'
import { getAdminStage2ActivityCompliance } from '../services/api'
import { POLL_INTERVAL_MS, formatDateTime, formatPercent, getErrorMessage } from './adminUtils'

function StatusChip({ severity }) {
  const base = 'px-2 py-0.5 rounded-full text-xs font-bold uppercase'
  if (severity === 'critical') return <span className={`${base} bg-red-100 text-red-700`}>Critical</span>
  if (severity === 'warning') return <span className={`${base} bg-yellow-100 text-yellow-700`}>Warning</span>
  return <span className={`${base} bg-green-100 text-green-700`}>Compliant</span>
}

export default function AdminStage2ActivityCompliancePage() {
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
    <PageEnter>
      <PageSurface>
        <GlassCard className="space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.16em] text-primary">Admin</p>
              <h1 className="mt-1 text-2xl font-bold text-text-primary">Stage 2: Activity Compliance</h1>
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
                {(data?.filterOptions?.mainTeam || []).map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-text-muted">Team</label>
              <select className="input-core" value={team} onChange={(e) => setTeam(e.target.value)}>
                <option value="">All</option>
                {(data?.filterOptions?.team || []).map((item) => <option key={item} value={item}>{item}</option>)}
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
                          <span key={i} className="text-[10px] text-text-secondary leading-tight">• {alert.message}</span>
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
                  const top = [...card.salespersonBreakdown].sort((a,b) => b.sharePct - a.sharePct)[0];
                  return (
                    <tr key={card.admin.id}>
                      <td>{card.admin.name}</td>
                      <td>{card.jsvCount}</td>
                      <td>
                        <StatusChip severity={card.alerts.find(a => a.severity === 'critical') ? 'critical' : (card.alerts.length > 0 ? 'warning' : 'compliant')} />
                      </td>
                      <td>{top ? `${top.name} (${Math.round(top.sharePct * 100)}%)` : '-'}</td>
                      <td>
                        <div className="flex flex-col gap-1">
                          {card.alerts.map((alert, i) => (
                            <span key={i} className="text-[10px] text-text-secondary leading-tight">• {alert.message}</span>
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
      </PageSurface>
    </PageEnter>
  )
}
