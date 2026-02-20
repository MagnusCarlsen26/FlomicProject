import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { DndContext, KeyboardSensor, PointerSensor, TouchSensor, closestCenter, useSensor, useSensors } from '@dnd-kit/core'
import { SortableContext, arrayMove, rectSortingStrategy, sortableKeyboardCoordinates } from '@dnd-kit/sortable'
import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import DraggableSection from '../components/admin/DraggableSection'
import InsightCard from '../components/admin/InsightCard'
import PageSurface from '../components/layout/PageSurface'
import PageEnter from '../components/motion/PageEnter'
import { notVisitedReasonCategoryLabel } from '../constants/weeklyReportFields'
import { useAuth } from '../context/useAuth'
import Alert from '../components/ui/Alert'
import Badge from '../components/ui/Badge'
import Button from '../components/ui/Button'
import DataTableFrame from '../components/ui/DataTableFrame'
import GlassCard from '../components/ui/GlassCard'
import Input from '../components/ui/Input'
import MultiSelect from '../components/ui/MultiSelect'
import Select from '../components/ui/Select'
import { getAdminStage1PlanActual, getAdminStage2ActivityCompliance, getAdminStage3PlannedNotVisited } from '../services/api'
import {
  DEFAULT_FULL_ROW_SECTION_IDS,
  DEFAULT_LAYOUT,
  getFullRowStorageKey,
  getLayoutStorageKey,
  loadFullRowSections,
  loadLayout,
  migrateAnonymousLayoutToUser,
  normalizeLayout,
  saveFullRowSections,
  saveLayout,
} from '../utils/adminInsightsLayout'
import { formatDateTime, formatPercent, getErrorMessage } from './adminUtils'

const ADMIN_TABLE_FRAME_CLASS = 'max-h-[34rem] overflow-y-auto'
const INSIGHTS_SECTION_IDS = DEFAULT_LAYOUT
const STAGE3_COLORS = ['#60a5fa', '#34d399', '#fbbf24', '#f87171', '#a78bfa', '#94a3b8']

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
    <DataTableFrame className={ADMIN_TABLE_FRAME_CLASS}>
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
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [error, setError] = useState(null)
  const [successMessage, setSuccessMessage] = useState(null)
  const [combinedData, setCombinedData] = useState({ planActual: null, activityCompliance: null, stage3: null })
  const [dataErrors, setDataErrors] = useState({ planActual: null, activityCompliance: null, stage3: null })
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
  const migratedLayoutUsersRef = useRef(new Set())

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
        const [planActualResult, activityResult, stage3Result] = await Promise.allSettled([
          getAdminStage1PlanActual(stage1Filters),
          getAdminStage2ActivityCompliance(stage2Filters),
          getAdminStage3PlannedNotVisited(stage2Filters),
        ])

        if (fetchId !== fetchCounterRef.current) return

        const nextErrors = { planActual: null, activityCompliance: null, stage3: null }
        const nextData = { planActual: null, activityCompliance: null, stage3: null }

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

        if (stage3Result.status === 'fulfilled') {
          nextData.stage3 = stage3Result.value || null
        } else {
          nextErrors.stage3 = getErrorMessage(stage3Result.reason)
        }

        setCombinedData(nextData)
        setDataErrors(nextErrors)
        setLastPolledAt(new Date().toISOString())

        if (nextErrors.planActual && nextErrors.activityCompliance && nextErrors.stage3) {
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

  const planActualData = combinedData.planActual
  const activityData = combinedData.activityCompliance
  const stage3Data = combinedData.stage3

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

  const visitDrilldownRows = useMemo(() => (planActualData?.drilldownRows || []).slice(0, 25), [planActualData])
  const activityDrilldownRows = useMemo(() => (activityData?.drilldown || []).slice(0, 25), [activityData])
  const stage3WeeklyTrend = useMemo(() => stage3Data?.weeklyTrend || [], [stage3Data])
  const stage3ReasonDistribution = (stage3Data?.reasonDistribution || []).map((item) => ({
    name: notVisitedReasonCategoryLabel(item.reasonCategory),
    value: item.count,
  }))
  const stage3SalespersonRates = useMemo(() => stage3Data?.salespersonRates || [], [stage3Data])
  const stage3TopRepeatedCustomers = useMemo(() => stage3Data?.topRepeatedCustomers || [], [stage3Data])
  const stage3DrilldownRows = useMemo(() => stage3Data?.drilldownRows || [], [stage3Data])
  const sectionDescriptors = useMemo(
    () => [
      {
        id: 'visit-performance',
        render: () => (
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
        ),
      },
      {
        id: 'compliance-snapshot',
        render: () => (
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
        ),
      },
      {
        id: 'daily-trend',
        render: () => (
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
        ),
      },
      {
        id: 'weekly-summary',
        render: () => (
          <GlassCard className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-text-muted">Weekly Summary</h2>
            <MetricsTable rows={planActualData?.weeklySummary || []} labelKey="isoWeek" labelTitle="Week" />
          </GlassCard>
        ),
      },
      {
        id: 'monthly-rollup',
        render: () => (
          <GlassCard className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-text-muted">Monthly Rollup</h2>
            <MetricsTable rows={planActualData?.monthlyRollup || []} labelKey="month" labelTitle="Month" />
          </GlassCard>
        ),
      },
      {
        id: 'call-type-split',
        render: () => (
          <GlassCard className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-text-muted">Call Type Split</h2>
            <MetricsTable rows={callTypeRows} labelKey="label" labelTitle="Call Type" />
          </GlassCard>
        ),
      },
      {
        id: 'customer-type-split',
        render: () => (
          <GlassCard className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-text-muted">Customer Type Split</h2>
            <MetricsTable rows={customerTypeRows} labelKey="label" labelTitle="Customer Type" />
          </GlassCard>
        ),
      },
      {
        id: 'top-over-achievers',
        render: () => (
          <GlassCard className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-text-muted">Top Over-Achievers</h2>
            <MetricsTable rows={planActualData?.topPerformers?.overAchievers || []} labelKey="name" labelTitle="Salesperson" />
          </GlassCard>
        ),
      },
      {
        id: 'top-under-achievers',
        render: () => (
          <GlassCard className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-text-muted">Top Under-Achievers</h2>
            <MetricsTable rows={planActualData?.topPerformers?.underAchievers || []} labelKey="name" labelTitle="Salesperson" />
          </GlassCard>
        ),
      },
      {
        id: 'salesperson-rollup',
        render: () => (
          <GlassCard className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-text-muted">Salesperson Performance Rollup</h2>
            <DataTableFrame className={ADMIN_TABLE_FRAME_CLASS}>
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
        ),
      },
      {
        id: 'compliance-by-salesperson',
        render: () => (
          <GlassCard className="space-y-4">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-text-muted">Compliance by Salesperson</h2>
            <DataTableFrame className={ADMIN_TABLE_FRAME_CLASS}>
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
        ),
      },
      {
        id: 'admin-monitoring',
        render: () => (
          <GlassCard className="space-y-4">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-text-muted">Admin Monitoring</h2>
            <DataTableFrame className={ADMIN_TABLE_FRAME_CLASS}>
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
        ),
      },
      {
        id: 'recent-activity',
        render: () => (
          <GlassCard className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-text-muted">Recent Activity / Drilldown</h2>
            <DataTableFrame className={ADMIN_TABLE_FRAME_CLASS}>
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
        ),
      },
      {
        id: 'stage3-summary',
        render: () => (
          <GlassCard className="space-y-4">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-text-muted">Stage 3 Summary</h2>
              <DataWarning message={dataErrors.stage3} />
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <InsightCard title="Stage 3 Planned Visits" value={String(stage3Data?.totals?.plannedVisits || 0)} />
              <InsightCard title="Missed Visits" value={String(stage3Data?.totals?.plannedButNotVisitedCount || 0)} />
              <InsightCard title="Non-Visit Rate" value={formatPercent(stage3Data?.totals?.nonVisitRate || 0)} />
            </div>
          </GlassCard>
        ),
      },
      {
        id: 'stage3-weekly-trend',
        render: () => (
          <GlassCard className="space-y-4">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-text-muted">Weekly Trend (Non-Visit Rate)</h2>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stage3WeeklyTrend}>
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
        ),
      },
      {
        id: 'stage3-reason-distribution',
        render: () => (
          <GlassCard className="space-y-4">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-text-muted">Reason Distribution</h2>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={stage3ReasonDistribution}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={5}
                    dataKey="value"
                    label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                  >
                    {stage3ReasonDistribution.map((entry, index) => (
                      <Cell key={`stage3-reason-${entry.name}-${index}`} fill={STAGE3_COLORS[index % STAGE3_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </GlassCard>
        ),
      },
      {
        id: 'stage3-salesperson-non-visit-rates',
        render: () => (
          <GlassCard className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-text-muted">Salesperson Non-Visit Rates</h2>
            <DataTableFrame className={ADMIN_TABLE_FRAME_CLASS}>
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
                  {stage3SalespersonRates.map((sr) => (
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
        ),
      },
      {
        id: 'stage3-repeated-non-visits',
        render: () => (
          <GlassCard className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-text-muted">Repeated Non-Visits (Last 8 Weeks)</h2>
              <Badge tone="warning">Threshold: &ge; 2 weeks</Badge>
            </div>
            <DataTableFrame className={ADMIN_TABLE_FRAME_CLASS}>
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
                  {stage3TopRepeatedCustomers.map((hist, idx) => (
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
        ),
      },
      {
        id: 'stage3-detailed-drilldown',
        render: () => (
          <GlassCard className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-text-muted">Detailed Drilldown (Top 100)</h2>
            <DataTableFrame className={ADMIN_TABLE_FRAME_CLASS}>
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
                  {stage3DrilldownRows.map((row, idx) => (
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
        ),
      },
    ],
    [
      activityData,
      activityDrilldownRows,
      callTypeRows,
      customerTypeRows,
      dataErrors.activityCompliance,
      dataErrors.planActual,
      dataErrors.stage3,
      planActualData,
      stage3Data,
      stage3DrilldownRows,
      stage3ReasonDistribution,
      stage3SalespersonRates,
      stage3TopRepeatedCustomers,
      stage3WeeklyTrend,
      visitDrilldownRows,
      week,
    ],
  )
  const storageKey = useMemo(
    () => getLayoutStorageKey(user?.id || user?.email || 'anonymous'),
    [user?.email, user?.id],
  )
  const fullRowStorageKey = useMemo(
    () => getFullRowStorageKey(user?.id || user?.email || 'anonymous'),
    [user?.email, user?.id],
  )
  const [sectionOrder, setSectionOrder] = useState(DEFAULT_LAYOUT)
  const [fullRowSectionIds, setFullRowSectionIds] = useState([])
  const [isFullRowHydrated, setIsFullRowHydrated] = useState(false)
  const userStorageIdentity = user?.id || user?.email || null

  useEffect(() => {
    if (userStorageIdentity && !migratedLayoutUsersRef.current.has(userStorageIdentity)) {
      migrateAnonymousLayoutToUser({
        userStorageKey: storageKey,
        userFullRowStorageKey: fullRowStorageKey,
        availableIds: INSIGHTS_SECTION_IDS,
        fallbackOrder: DEFAULT_LAYOUT,
      })
      migratedLayoutUsersRef.current.add(userStorageIdentity)
    }

    let hasStoredLayout = false
    try {
      hasStoredLayout = Boolean(localStorage.getItem(storageKey))
    } catch {
      hasStoredLayout = false
    }

    setSectionOrder(loadLayout(storageKey, INSIGHTS_SECTION_IDS, DEFAULT_LAYOUT))
    setFullRowSectionIds(
      loadFullRowSections(
        fullRowStorageKey,
        INSIGHTS_SECTION_IDS,
        hasStoredLayout ? [] : DEFAULT_FULL_ROW_SECTION_IDS,
      ),
    )
    setIsFullRowHydrated(true)
  }, [fullRowStorageKey, storageKey, userStorageIdentity])

  useEffect(() => {
    if (!isFullRowHydrated) return
    const normalized = fullRowSectionIds.filter((id) => INSIGHTS_SECTION_IDS.includes(id))
    if (normalized.length !== fullRowSectionIds.length) {
      setFullRowSectionIds(normalized)
      return
    }
    saveFullRowSections(fullRowStorageKey, normalized)
  }, [fullRowSectionIds, fullRowStorageKey, isFullRowHydrated])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 120, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const orderedSectionIds = useMemo(
    () => normalizeLayout(sectionOrder, INSIGHTS_SECTION_IDS, DEFAULT_LAYOUT),
    [sectionOrder],
  )
  const sectionMap = useMemo(() => {
    const map = new Map()
    sectionDescriptors.forEach((section) => map.set(section.id, section))
    return map
  }, [sectionDescriptors])

  const handleDragEnd = ({ active, over }) => {
    if (!over || active.id === over.id) return
    setSectionOrder((prev) => {
      const current = normalizeLayout(prev, INSIGHTS_SECTION_IDS, DEFAULT_LAYOUT)
      const oldIndex = current.indexOf(String(active.id))
      const newIndex = current.indexOf(String(over.id))
      if (oldIndex < 0 || newIndex < 0) return current
      const next = arrayMove(current, oldIndex, newIndex)
      saveLayout(storageKey, next)
      return next
    })
  }

  const handleToggleFullRow = (sectionId) => {
    setFullRowSectionIds((prev) =>
      prev.includes(sectionId) ? prev.filter((id) => id !== sectionId) : [...prev, sectionId],
    )
  }

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
            <Select
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
            </Select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-text-muted">Team</label>
            <Select
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
            </Select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-text-muted">Sub Team</label>
            <Select
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
            </Select>
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
            <Select value={callType} onChange={(e) => setCallType(e.target.value)}>
              <option value="">All</option>
              {mergedFilterOptions.callType.map((item) => (
                <option key={item} value={item}>
                  {formatCallType(item)}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-text-muted">Customer Type</label>
            <Select value={customerType} onChange={(e) => setCustomerType(e.target.value)}>
              <option value="">All</option>
              {mergedFilterOptions.customerType.map((item) => (
                <option key={item} value={item}>
                  {formatCustomerType(item)}
                </option>
              ))}
            </Select>
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

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={orderedSectionIds} strategy={rectSortingStrategy}>
          <div className="grid gap-4 xl:grid-cols-2">
            {orderedSectionIds.map((sectionId) => {
              const section = sectionMap.get(sectionId)
              if (!section) return null
              return (
                <DraggableSection
                  key={sectionId}
                  id={sectionId}
                  className={fullRowSectionIds.includes(sectionId) ? 'h-full xl:col-span-2' : 'h-full'}
                  isFullRow={fullRowSectionIds.includes(sectionId)}
                  onToggleFullRow={handleToggleFullRow}
                >
                  {section.render()}
                </DraggableSection>
              )
            })}
          </div>
        </SortableContext>
      </DndContext>
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
      </PageSurface>
    </PageEnter>
  )
}
