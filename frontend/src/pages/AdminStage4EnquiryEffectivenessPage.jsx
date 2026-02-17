import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import PageSurface from '../components/layout/PageSurface'
import PageEnter from '../components/motion/PageEnter'
import Alert from '../components/ui/Alert'
import Button from '../components/ui/Button'
import DataTableFrame from '../components/ui/DataTableFrame'
import GlassCard from '../components/ui/GlassCard'
import Input from '../components/ui/Input'
import InsightCard from '../components/admin/InsightCard'
import MultiSelect from '../components/ui/MultiSelect'
import { getAdminStage4EnquiryEffectiveness } from '../services/api'
import { POLL_INTERVAL_MS, formatDateTime, formatPercent, getErrorMessage } from './adminUtils'

function formatCallType(value) {
  if (!value) return '-'
  return String(value).toUpperCase()
}

function formatCustomerType(value) {
  if (value === 'targeted_budgeted') return 'Targeted (Budgeted)'
  if (value === 'existing') return 'Existing'
  return '-'
}

function SeverityBadge({ severity }) {
  const base = 'rounded-full px-2 py-0.5 text-xs font-semibold uppercase'
  if (severity === 'critical') return <span className={`${base} bg-red-100 text-red-700`}>Critical</span>
  if (severity === 'warning') return <span className={`${base} bg-yellow-100 text-yellow-700`}>Warning</span>
  return <span className={`${base} bg-emerald-100 text-emerald-700`}>None</span>
}

export default function AdminStage4EnquiryEffectivenessPage() {
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
  const [visitType, setVisitType] = useState('')
  const [customerType, setCustomerType] = useState('')
  const [location, setLocation] = useState('')
  const [admin, setAdmin] = useState('')

  const [minVisitsForLowEnquiry, setMinVisitsForLowEnquiry] = useState('12')
  const [minEnquiryPerVisit, setMinEnquiryPerVisit] = useState('0.25')
  const [minEnquiriesForLowConversion, setMinEnquiriesForLowConversion] = useState('6')
  const [minShipmentConversion, setMinShipmentConversion] = useState('0.20')

  const [appliedFilters, setAppliedFilters] = useState({})

  const fetchCounterRef = useRef(0)

  const fetchData = useCallback(
    async ({ silent = false, showSuccess = false, filters = appliedFilters } = {}) => {
      const fetchId = fetchCounterRef.current + 1
      fetchCounterRef.current = fetchId

      if (!silent) setLoading(true)
      else setIsRefreshing(true)

      try {
        const response = await getAdminStage4EnquiryEffectiveness(filters)
        if (fetchId !== fetchCounterRef.current) return

        setData(response || null)
        setError(null)
        setLastPolledAt(new Date().toISOString())

        if (!appliedFilters || Object.keys(appliedFilters).length === 0) {
          const defaults = response?.thresholdDefaults || {}
          setMinVisitsForLowEnquiry(String(defaults.minVisitsForLowEnquiry ?? 12))
          setMinEnquiryPerVisit(String(defaults.minEnquiryPerVisit ?? 0.25))
          setMinEnquiriesForLowConversion(String(defaults.minEnquiriesForLowConversion ?? 6))
          setMinShipmentConversion(String(defaults.minShipmentConversion ?? 0.2))
        }

        if (!silent && showSuccess) {
          setSuccessMessage('Stage 4 data refreshed.')
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
      visitType: visitType || undefined,
      customerType: customerType || undefined,
      location: location || undefined,
      admin: admin || undefined,
      minVisitsForLowEnquiry: minVisitsForLowEnquiry || undefined,
      minEnquiryPerVisit: minEnquiryPerVisit || undefined,
      minEnquiriesForLowConversion: minEnquiriesForLowConversion || undefined,
      minShipmentConversion: minShipmentConversion || undefined,
    }

    setAppliedFilters(nextFilters)
    setSuccessMessage('Filters applied.')
  }

  const handleResetFilters = () => {
    setFromDate('')
    setToDate('')
    setSalesmen([])
    setTeam('')
    setVisitType('')
    setCustomerType('')
    setLocation('')
    setAdmin('')

    const defaults = data?.thresholdDefaults || {}
    setMinVisitsForLowEnquiry(String(defaults.minVisitsForLowEnquiry ?? 12))
    setMinEnquiryPerVisit(String(defaults.minEnquiryPerVisit ?? 0.25))
    setMinEnquiriesForLowConversion(String(defaults.minEnquiriesForLowConversion ?? 6))
    setMinShipmentConversion(String(defaults.minShipmentConversion ?? 0.2))

    setAppliedFilters({})
  }

  const weeklyRows = data?.trends?.weekly || []
  const salespersonRows = data?.tables?.salesperson || []
  const hodRows = data?.tables?.hod || []
  const flagRows = useMemo(() => (data?.flags?.rows || []).slice(0, 100), [data])

  return (
    <PageEnter>
      <PageSurface>
        <GlassCard className="space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.16em] text-primary">Admin</p>
              <h1 className="mt-1 text-2xl font-bold text-text-primary">Stage 4: Enquiry Tracking & Visit Effectiveness</h1>
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
              <Input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-text-muted">To Date</label>
              <Input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} />
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
              <label className="text-xs font-semibold uppercase tracking-wider text-text-muted">HOD Team</label>
              <select className="input-core" value={team} onChange={(event) => setTeam(event.target.value)}>
                <option value="">All</option>
                {(data?.filterOptions?.team || []).map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-text-muted">Visit Type</label>
              <select className="input-core" value={visitType} onChange={(event) => setVisitType(event.target.value)}>
                <option value="">All</option>
                {(data?.filterOptions?.visitType || []).map((item) => (
                  <option key={item} value={item}>
                    {formatCallType(item)}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-text-muted">Customer Type</label>
              <select className="input-core" value={customerType} onChange={(event) => setCustomerType(event.target.value)}>
                <option value="">All</option>
                {(data?.filterOptions?.customerType || []).map((item) => (
                  <option key={item} value={item}>
                    {formatCustomerType(item)}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-text-muted">Location</label>
              <select className="input-core" value={location} onChange={(event) => setLocation(event.target.value)}>
                <option value="">All</option>
                {(data?.filterOptions?.location || []).map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-text-muted">Admin (JSV Owner)</label>
              <select className="input-core" value={admin} onChange={(event) => setAdmin(event.target.value)}>
                <option value="">All</option>
                {(data?.filterOptions?.admin || []).map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-text-muted">Min Visits (Low Enquiry)</label>
              <Input value={minVisitsForLowEnquiry} onChange={(event) => setMinVisitsForLowEnquiry(event.target.value)} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-text-muted">Min Enquiry/Visit</label>
              <Input value={minEnquiryPerVisit} onChange={(event) => setMinEnquiryPerVisit(event.target.value)} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-text-muted">Min Enquiries (Low Conversion)</label>
              <Input value={minEnquiriesForLowConversion} onChange={(event) => setMinEnquiriesForLowConversion(event.target.value)} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-text-muted">Min Shipment Conversion</label>
              <Input value={minShipmentConversion} onChange={(event) => setMinShipmentConversion(event.target.value)} />
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

        <GlassCard className="space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-text-muted">Effectiveness KPIs</h2>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <InsightCard title="Visit to Enquiry Ratio" value={formatPercent(data?.kpis?.visitToEnquiryRatio?.value)} />
            <InsightCard title="Enquiry to Shipment Ratio" value={formatPercent(data?.kpis?.enquiryToShipmentConversion?.value)} />
            <InsightCard title="Total Enquiries" value={String(data?.totals?.enquiries || 0)} />
            <InsightCard title="Total Shipments" value={String(data?.totals?.shipments || 0)} />
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <InsightCard title="Flags (Total)" value={String(data?.flags?.summary?.total || 0)} />
            <InsightCard title="High Visits, Low Enquiry" value={String(data?.flags?.summary?.byType?.high_visits_low_enquiry || 0)} />
            <InsightCard title="Low Conversion" value={String(data?.flags?.summary?.byType?.low_conversion || 0)} />
            <InsightCard title="Critical Flags" value={String(data?.flags?.summary?.bySeverity?.critical || 0)} />
          </div>
        </GlassCard>

        <GlassCard className="space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-text-muted">Weekly Trends</h2>
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={weeklyRows}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="week" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="actualVisits" fill="#2563eb" name="Visits" />
                  <Bar dataKey="enquiries" fill="#0f766e" name="Enquiries" />
                  <Bar dataKey="shipments" fill="#9333ea" name="Shipments" />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={weeklyRows}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="week" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="visitToEnquiryRatio" stroke="#0f766e" name="Visit to Enquiry" />
                  <Line type="monotone" dataKey="enquiryToShipmentConversion" stroke="#9333ea" name="Enquiry to Shipment" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </GlassCard>

        <GlassCard className="space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-text-muted">Salesperson Ranking</h2>
          <DataTableFrame>
            <table className="table-core min-w-full text-sm">
              <thead>
                <tr>
                  <th>Salesperson</th>
                  <th>Team</th>
                  <th>Actual Visits</th>
                  <th>Enquiries</th>
                  <th>Shipments</th>
                  <th>Visit to Enquiry</th>
                  <th>Enquiry to Shipment</th>
                  <th>Flags</th>
                </tr>
              </thead>
              <tbody>
                {salespersonRows.map((row) => (
                  <tr key={row.salespersonId}>
                    <td>{row.salespersonName}</td>
                    <td>{row.team}</td>
                    <td>{row.actualVisits}</td>
                    <td>{row.enquiries}</td>
                    <td>{row.shipments}</td>
                    <td>{formatPercent(row.visitToEnquiryRatio)}</td>
                    <td>{formatPercent(row.enquiryToShipmentConversion)}</td>
                    <td>
                      <div className="flex flex-wrap gap-1">
                        {row.flags.length === 0 ? <SeverityBadge severity="none" /> : null}
                        {row.flags.map((flag) => (
                          <SeverityBadge key={`${row.salespersonId}-${flag.type}`} severity={flag.severity} />
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
          <h2 className="text-sm font-semibold uppercase tracking-wide text-text-muted">HOD Team Roll-up</h2>
          <DataTableFrame>
            <table className="table-core min-w-full text-sm">
              <thead>
                <tr>
                  <th>HOD Team</th>
                  <th>Salespeople</th>
                  <th>Actual Visits</th>
                  <th>Enquiries</th>
                  <th>Shipments</th>
                  <th>Visit to Enquiry</th>
                  <th>Enquiry to Shipment</th>
                  <th>Flags</th>
                </tr>
              </thead>
              <tbody>
                {hodRows.map((row) => (
                  <tr key={row.hod}>
                    <td>{row.hod}</td>
                    <td>{row.salespeopleCount}</td>
                    <td>{row.actualVisits}</td>
                    <td>{row.enquiries}</td>
                    <td>{row.shipments}</td>
                    <td>{formatPercent(row.visitToEnquiryRatio)}</td>
                    <td>{formatPercent(row.enquiryToShipmentConversion)}</td>
                    <td>
                      <div className="flex flex-wrap gap-1">
                        {row.flags.length === 0 ? <SeverityBadge severity="none" /> : null}
                        {row.flags.map((flag) => (
                          <SeverityBadge key={`${row.hod}-${flag.type}`} severity={flag.severity} />
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
          <h2 className="text-sm font-semibold uppercase tracking-wide text-text-muted">Flagged Cohort</h2>
          <DataTableFrame>
            <table className="table-core min-w-full text-sm">
              <thead>
                <tr>
                  <th>Scope</th>
                  <th>Name</th>
                  <th>Team</th>
                  <th>Rule</th>
                  <th>Severity</th>
                  <th>Reason</th>
                </tr>
              </thead>
              <tbody>
                {flagRows.map((row, index) => (
                  <tr key={`${row.scope}-${row.id}-${row.type}-${index}`}>
                    <td>{row.scope === 'hod' ? 'HOD' : 'Salesperson'}</td>
                    <td>{row.name}</td>
                    <td>{row.team}</td>
                    <td>{row.label}</td>
                    <td><SeverityBadge severity={row.severity} /></td>
                    <td>{row.reason}</td>
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
