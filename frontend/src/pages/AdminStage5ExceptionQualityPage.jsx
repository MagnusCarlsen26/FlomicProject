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
import {
  getAdminStage5ExceptionQuality,
  updateAdminStage5ExceptionStatus,
} from '../services/api'
import { POLL_INTERVAL_MS, formatDateTime, getErrorMessage } from './adminUtils'

function StatusBadge({ value }) {
  const base = 'rounded-full px-2 py-0.5 text-xs font-semibold uppercase'
  if (value === 'resolved') return <span className={`${base} bg-emerald-100 text-emerald-700`}>Resolved</span>
  if (value === 'ignored') return <span className={`${base} bg-slate-200 text-slate-700`}>Ignored</span>
  if (value === 'in_review') return <span className={`${base} bg-yellow-100 text-yellow-700`}>In Review</span>
  return <span className={`${base} bg-red-100 text-red-700`}>Open</span>
}

export default function AdminStage5ExceptionQualityPage() {
  const [loading, setLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [error, setError] = useState(null)
  const [successMessage, setSuccessMessage] = useState(null)
  const [data, setData] = useState(null)
  const [lastPolledAt, setLastPolledAt] = useState(null)

  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [salesmen, setSalesmen] = useState([])
  const [team, setTeam] = useState('')
  const [admin, setAdmin] = useState('')
  const [rule, setRule] = useState('')
  const [status, setStatus] = useState('')
  const [ageingBucket, setAgeingBucket] = useState('')
  const [customer, setCustomer] = useState('')
  const [appliedFilters, setAppliedFilters] = useState({})

  const [statusDraftByCaseId, setStatusDraftByCaseId] = useState({})
  const [noteDraftByCaseId, setNoteDraftByCaseId] = useState({})
  const [updatingCaseId, setUpdatingCaseId] = useState('')

  const fetchCounterRef = useRef(0)

  const fetchData = useCallback(
    async ({ silent = false, showSuccess = false, filters = appliedFilters } = {}) => {
      const fetchId = fetchCounterRef.current + 1
      fetchCounterRef.current = fetchId

      if (!silent) setLoading(true)
      else setIsRefreshing(true)

      try {
        const response = await getAdminStage5ExceptionQuality(filters)
        if (fetchId !== fetchCounterRef.current) return

        setData(response || null)
        setError(null)
        setLastPolledAt(new Date().toISOString())

        if (!silent && showSuccess) {
          setSuccessMessage('Stage 5 data refreshed.')
        }
      } catch (e) {
        if (fetchId !== fetchCounterRef.current) return
        setSuccessMessage(null)
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
      from: fromDate || undefined,
      to: toDate || undefined,
      salesmen,
      team: team || undefined,
      admin: admin || undefined,
      rule: rule || undefined,
      status: status || undefined,
      ageingBucket: ageingBucket || undefined,
      customer: customer || undefined,
    }

    setAppliedFilters(nextFilters)
    setSuccessMessage('Filters applied.')
  }

  const handleResetFilters = () => {
    setFromDate('')
    setToDate('')
    setSalesmen([])
    setTeam('')
    setAdmin('')
    setRule('')
    setStatus('')
    setAgeingBucket('')
    setCustomer('')
    setAppliedFilters({})
  }

  const handleUpdateStatus = async (row) => {
    const caseId = row.id
    const nextStatus = statusDraftByCaseId[caseId] || row.status
    const note = noteDraftByCaseId[caseId] || ''

    setUpdatingCaseId(caseId)
    try {
      await updateAdminStage5ExceptionStatus(caseId, {
        status: nextStatus,
        note,
      })
      setSuccessMessage('Exception status updated.')
      setError(null)
      await fetchData({ silent: true })
    } catch (e) {
      setSuccessMessage(null)
      setError(getErrorMessage(e))
    } finally {
      setUpdatingCaseId('')
    }
  }

  const rows = useMemo(() => (data?.exceptions?.rows || []).slice(0, 150), [data])
  const trendRows = data?.summary?.resolvedVsOpenTrend || []

  return (
    <PageEnter>
      <PageSurface>
        <GlassCard className="space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.16em] text-primary">Admin</p>
              <h1 className="mt-1 text-2xl font-bold text-text-primary">Stage 5: Exception & Quality Monitoring</h1>
              <p className="mt-1 text-sm text-text-secondary">
                Range {data?.range?.from || '-'} to {data?.range?.to || '-'} ({data?.range?.timezone || '-'})
              </p>
            </div>
            <Button variant="secondary" onClick={() => fetchData({ showSuccess: true })} disabled={loading || isRefreshing}>
              {loading || isRefreshing ? 'Refreshing...' : 'Refresh'}
            </Button>
          </div>

          <p className="text-sm text-text-secondary">Last refresh: {formatDateTime(lastPolledAt)}</p>

          <div className="grid grid-cols-1 gap-4 rounded-2xl border border-border bg-surface/50 p-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-text-muted">From Date</label>
              <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-text-muted">To Date</label>
              <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
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
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-text-muted">Admin Owner</label>
              <select className="input-core" value={admin} onChange={(e) => setAdmin(e.target.value)}>
                <option value="">All</option>
                {(data?.filterOptions?.admin || []).map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-text-muted">Rule</label>
              <select className="input-core" value={rule} onChange={(e) => setRule(e.target.value)}>
                <option value="">All</option>
                {(data?.filterOptions?.rule || []).map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-text-muted">Status</label>
              <select className="input-core" value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="">All</option>
                {(data?.filterOptions?.status || []).map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-text-muted">Ageing Bucket</label>
              <select className="input-core" value={ageingBucket} onChange={(e) => setAgeingBucket(e.target.value)}>
                <option value="">All</option>
                {(data?.filterOptions?.ageingBucket || []).map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-text-muted">Customer</label>
              <Input value={customer} onChange={(e) => setCustomer(e.target.value)} placeholder="Customer name" />
            </div>
            <div className="flex items-end gap-2 xl:col-span-2">
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

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <InsightCard title="Open Exceptions" value={String(data?.summary?.openRows || 0)} />
          <InsightCard title="EX-01 Open" value={String(data?.summary?.openByRule?.['EX-01'] || 0)} />
          <InsightCard title="EX-02 Open" value={String(data?.summary?.openByRule?.['EX-02'] || 0)} />
          <InsightCard title="EX-03 Open" value={String(data?.summary?.openByRule?.['EX-03'] || 0)} />
          <InsightCard title="EX-04 Open" value={String(data?.summary?.openByRule?.['EX-04'] || 0)} />
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <InsightCard title="Ageing 0-7" value={String(data?.summary?.ageingBuckets?.['0-7'] || 0)} />
          <InsightCard title="Ageing 8-14" value={String(data?.summary?.ageingBuckets?.['8-14'] || 0)} />
          <InsightCard title="Ageing 15+" value={String(data?.summary?.ageingBuckets?.['15+'] || 0)} />
        </div>

        <GlassCard className="space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-text-muted">Resolved vs Open Trend</h2>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={trendRows}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="week" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="opened" fill="#dc2626" name="Opened" />
                <Bar dataKey="resolved" fill="#16a34a" name="Resolved" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </GlassCard>

        <GlassCard className="space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-text-muted">Owner Backlog</h2>
          <DataTableFrame>
            <table className="table-core min-w-full text-sm">
              <thead>
                <tr>
                  <th>Owner</th>
                  <th>Team</th>
                  <th>Open Cases</th>
                </tr>
              </thead>
              <tbody>
                {(data?.summary?.ownerBacklog || []).map((row) => (
                  <tr key={row.ownerId}>
                    <td>{row.ownerName}</td>
                    <td>{row.team}</td>
                    <td>{row.open}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </DataTableFrame>
        </GlassCard>

        <GlassCard className="space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-text-muted">Exception Queue</h2>
          <DataTableFrame>
            <table className="table-core min-w-full text-sm">
              <thead>
                <tr>
                  <th>Rule</th>
                  <th>Customer</th>
                  <th>Salesperson</th>
                  <th>Team</th>
                  <th>First Seen</th>
                  <th>Latest Seen</th>
                  <th>Ageing</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <div className="font-semibold">{row.ruleId}</div>
                      <div className="text-xs text-text-secondary">{row.ruleLabel}</div>
                    </td>
                    <td>{row.customerName}</td>
                    <td>{row.salesmanName}</td>
                    <td>{row.team}</td>
                    <td>{row.firstSeenDate}</td>
                    <td>{row.latestSeenDate}</td>
                    <td>{row.ageingDays}d ({row.ageingBucket})</td>
                    <td>
                      <StatusBadge value={row.status} />
                    </td>
                    <td>
                      <div className="space-y-2">
                        <select
                          className="input-core min-w-[120px]"
                          value={statusDraftByCaseId[row.id] || row.status}
                          onChange={(e) => setStatusDraftByCaseId((prev) => ({ ...prev, [row.id]: e.target.value }))}
                        >
                          {(data?.filterOptions?.status || []).map((item) => (
                            <option key={item} value={item}>
                              {item}
                            </option>
                          ))}
                        </select>
                        <Input
                          value={noteDraftByCaseId[row.id] || ''}
                          onChange={(e) => setNoteDraftByCaseId((prev) => ({ ...prev, [row.id]: e.target.value }))}
                          placeholder="Note (optional)"
                        />
                        <Button
                          size="sm"
                          onClick={() => handleUpdateStatus(row)}
                          disabled={updatingCaseId === row.id}
                        >
                          {updatingCaseId === row.id ? 'Updating...' : 'Update'}
                        </Button>
                      </div>
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
