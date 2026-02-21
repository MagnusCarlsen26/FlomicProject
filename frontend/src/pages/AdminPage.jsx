import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { DndContext, KeyboardSensor, PointerSensor, TouchSensor, closestCenter, useSensor, useSensors } from '@dnd-kit/core'
import { SortableContext, arrayMove, rectSortingStrategy, sortableKeyboardCoordinates } from '@dnd-kit/sortable'
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import DraggableSection from '../components/admin/DraggableSection'
import InsightCard from '../components/admin/InsightCard'
import PageSurface from '../components/layout/PageSurface'
import PageEnter from '../components/motion/PageEnter'
import { useAuth } from '../context/useAuth'
import { useTheme } from '../context/useTheme'
import Alert from '../components/ui/Alert'
import Button from '../components/ui/Button'
import DataTableFrame from '../components/ui/DataTableFrame'
import GlassCard from '../components/ui/GlassCard'
import Input from '../components/ui/Input'
import MultiSelect from '../components/ui/MultiSelect'
import Select from '../components/ui/Select'
import {
  getAdminInsightsPreferences,
  getAdminStage1PlanActual,
  getAdminStage2ActivityCompliance,
  getAdminStage3PlannedNotVisited,
  updateAdminInsightsPreferences,
} from '../services/api'
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
import { getChartTheme } from '../themeTokens'

const ADMIN_TABLE_FRAME_CLASS = 'max-h-[34rem] overflow-y-auto'
const INSIGHTS_SECTION_IDS = DEFAULT_LAYOUT
const SECTION_TITLES = {
  'visit-performance': 'Visit Performance',
  'compliance-snapshot': 'Compliance Snapshot',
  'daily-trend': 'Daily Trend',
  'weekly-monthly-summary': 'Weekly & Monthly Summary',
  'top-achievers-summary': 'Achivers',
  'call-type-split': 'Call Type Split',
  'customer-type-split': 'Customer Type Split',
  'compliance-by-salesperson': 'Subteam Member JSV Compliance',
  'enquiry-kpis': 'Enquiry KPIs',
  'more-insights': 'More Insights',
}

function formatCallType(callType) {
  if (!callType) return 'Unknown'
  return callType.toUpperCase()
}

function formatCustomerType(customerType) {
  if (customerType === 'targeted_budgeted' || customerType === 'target_budgeted') return 'Target (Budgeted)'
  if (customerType === 'new_customer_non_budgeted') return 'New Customer (Non Budgeted)'
  if (customerType === 'existing') return 'Existing'
  return 'Unknown'
}

function formatMonthDayLabel(dateValue) {
  if (!dateValue) return '-'
  const date = new Date(`${dateValue}T00:00:00.000Z`)
  if (Number.isNaN(date.getTime())) return dateValue
  const month = date.toLocaleDateString(undefined, { month: 'short', timeZone: 'UTC' })
  const day = date.toLocaleDateString(undefined, { day: 'numeric', timeZone: 'UTC' })
  return `${month} - ${day}`
}

function isoWeekToMondayDate(isoWeek) {
  const match = /^([0-9]{4})-W([0-9]{2})$/.exec(String(isoWeek || ''))
  if (!match) return null
  const year = Number(match[1])
  const week = Number(match[2])
  const jan4 = new Date(Date.UTC(year, 0, 4))
  const jan4Day = jan4.getUTCDay() || 7
  const week1Monday = new Date(jan4)
  week1Monday.setUTCDate(jan4.getUTCDate() + 1 - jan4Day)
  const monday = new Date(week1Monday)
  monday.setUTCDate(week1Monday.getUTCDate() + (week - 1) * 7)
  return monday
}

function formatIsoWeekAsMonthDay(isoWeek) {
  const monday = isoWeekToMondayDate(isoWeek)
  if (!monday) return isoWeek || '-'
  const month = monday.toLocaleDateString(undefined, { month: 'short', timeZone: 'UTC' })
  const day = monday.toLocaleDateString(undefined, { day: 'numeric', timeZone: 'UTC' })
  return `${month} - ${day}`
}

function formatMonthLabel(monthValue) {
  const match = /^([0-9]{4})-([0-9]{2})$/.exec(String(monthValue || ''))
  if (!match) return monthValue || '-'
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, 1))
  if (Number.isNaN(date.getTime())) return monthValue || '-'
  return date.toLocaleDateString(undefined, { month: 'short', timeZone: 'UTC' })
}

function formatRatio(value) {
  const normalized = Number(value || 0)
  return `${normalized.toFixed(2)}x`
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
  const base = 'px-2 py-0.5 rounded-full border text-xs font-bold uppercase'
  if (severity === 'critical') return <span className={`${base} border-error/40 bg-error-soft text-error`}>Critical</span>
  if (severity === 'warning') return <span className={`${base} border-warning/40 bg-warning-soft text-warning`}>Warning</span>
  return <span className={`${base} border-success/40 bg-success-soft text-success`}>Compliant</span>
}

function JsvProgressBar({ jsvCount }) {
  const threshold = 6
  const progress = Math.min(jsvCount / threshold, 1)
  const widthPct = Math.max(progress * 100, jsvCount === 0 ? 4 : 0)
  const toneClass = jsvCount >= threshold ? 'bg-success' : 'bg-error'

  return (
    <div className="space-y-1">
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-surface-3">
        <div className={`h-full rounded-full ${toneClass}`} style={{ width: `${widthPct}%` }} />
      </div>
      <div className="text-[11px] text-text-secondary">{`${jsvCount} / ${threshold}`}</div>
    </div>
  )
}

function DataWarning({ tone = 'warning', message }) {
  if (!message) return null
  return <Alert tone={tone}>{message}</Alert>
}

function CollapsibleInsightsTable({ title, trailing, children, defaultOpen = true }) {
  return (
    <details
      open={defaultOpen}
      className="group rounded-2xl border border-border bg-surface/60 p-0"
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 [&::-webkit-details-marker]:hidden">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-text-muted">{title}</h3>
        <div className="flex items-center gap-2">
          {trailing}
          <svg
            viewBox="0 0 24 24"
            className="h-4 w-4 text-text-secondary transition-transform group-open:rotate-180"
            fill="none"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path d="M6 10l6 6 6-6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      </summary>
      <div className="px-4 pb-4">{children}</div>
    </details>
  )
}

function UnifiedAdminSection() {
  const { user } = useAuth()
  const { resolvedTheme } = useTheme()
  const [loading, setLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [error, setError] = useState(null)
  const [successMessage, setSuccessMessage] = useState(null)
  const [combinedData, setCombinedData] = useState({ planActual: null, activityCompliance: null, stage3: null })
  const [dataErrors, setDataErrors] = useState({ planActual: null, activityCompliance: null, stage3: null })
  const [lastPolledAt, setLastPolledAt] = useState(null)

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
  const [moreInsightsSearch, setMoreInsightsSearch] = useState('')

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
  const normalizedMoreInsightsSearch = moreInsightsSearch.trim().toLowerCase()
  const filteredSalespersonRollupRows = useMemo(() => {
    const rows = planActualData?.hierarchyRollups?.salesperson || []
    if (!normalizedMoreInsightsSearch) return rows

    return rows.filter((row) =>
      Object.values(row || {}).some((value) => String(value ?? '').toLowerCase().includes(normalizedMoreInsightsSearch)),
    )
  }, [normalizedMoreInsightsSearch, planActualData])
  const filteredVisitDrilldownRows = useMemo(() => {
    if (!normalizedMoreInsightsSearch) return visitDrilldownRows
    return visitDrilldownRows.filter((row) =>
      JSON.stringify(row || {}).toLowerCase().includes(normalizedMoreInsightsSearch),
    )
  }, [normalizedMoreInsightsSearch, visitDrilldownRows])
  const filteredActivityDrilldownRows = useMemo(() => {
    if (!normalizedMoreInsightsSearch) return activityDrilldownRows
    return activityDrilldownRows.filter((row) =>
      JSON.stringify(row || {}).toLowerCase().includes(normalizedMoreInsightsSearch),
    )
  }, [activityDrilldownRows, normalizedMoreInsightsSearch])
  const dailyTrendRows = useMemo(
    () => (planActualData?.dailyTrend || []).map((row) => ({ ...row, dateLabel: formatMonthDayLabel(row.date) })),
    [planActualData],
  )
  const weeklySummaryRows = useMemo(
    () => (planActualData?.weeklySummary || []).map((row) => ({ ...row, weekLabel: formatIsoWeekAsMonthDay(row.isoWeek) })),
    [planActualData],
  )
  const monthlyRollupRows = useMemo(
    () => (planActualData?.monthlyRollup || []).map((row) => ({ ...row, monthLabel: formatMonthLabel(row.month) })),
    [planActualData],
  )
  const chartTheme = useMemo(() => getChartTheme(resolvedTheme), [resolvedTheme])
  const chartTooltipStyle = useMemo(
    () => ({
      backgroundColor: chartTheme.tooltip.bg,
      color: chartTheme.tooltip.text,
      border: `1px solid ${chartTheme.grid.subtle}`,
      borderRadius: '0.85rem',
      fontSize: '12px',
    }),
    [chartTheme],
  )
  const sectionDescriptors = useMemo(
    () => [
      {
        id: 'visit-performance',
        render: () => (
          <GlassCard className="space-y-4">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-text-muted">Visit Performance</h2>
              <div className="flex flex-wrap items-center gap-2">
                <DataWarning message={dataErrors.planActual} />
                <DataWarning message={dataErrors.stage3} />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
              <InsightCard title="Planned Visits" value={String(planActualData?.totals?.plannedVisits || 0)} variant="info" />
              <InsightCard title="Actual Visits" value={String(planActualData?.totals?.actualVisits || 0)} variant="success" />
              <InsightCard title="Achievement" value={formatPercent(planActualData?.totals?.achievementRate || 0)} variant="success" />
              <InsightCard title="Missed Visits" value={String(stage3Data?.totals?.plannedButNotVisitedCount || 0)} variant="danger" />
              <InsightCard title="Non-Visit Rate" value={formatPercent(stage3Data?.totals?.nonVisitRate || 0)} variant="warning" />
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
              <InsightCard title="Compliant" value={String(activityData?.summary?.compliantCount || 0)} variant="success" />
              <InsightCard title="Non-Compliant" value={String(activityData?.summary?.nonCompliantCount || 0)} variant="danger" />
              <InsightCard title="Critical Alerts" value={String(activityData?.summary?.alertBreakdown?.severity?.critical || 0)} variant="danger" />
              <InsightCard title="Warning Alerts" value={String(activityData?.summary?.alertBreakdown?.severity?.warning || 0)} variant="warning" />
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
                <LineChart data={dailyTrendRows}>
                  <CartesianGrid stroke={chartTheme.grid.subtle} strokeDasharray="3 3" />
                  <XAxis dataKey="dateLabel" tick={{ fill: chartTheme.axis.default }} interval={6} />
                  <YAxis allowDecimals={false} tick={{ fill: chartTheme.axis.default }} />
                  <Tooltip contentStyle={chartTooltipStyle} />
                  <Legend />
                  <Line dataKey="plannedVisits" name="Planned" stroke={chartTheme.status.neutral} strokeWidth={2} dot={false} />
                  <Line dataKey="actualVisits" name="Actual" stroke={chartTheme.series.secondary} strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </GlassCard>
        ),
      },
      {
        id: 'weekly-monthly-summary',
        render: () => (
          <GlassCard className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-text-muted">Weekly & Monthly Summary</h2>
            <div className="grid gap-4 xl:grid-cols-2">
              <div className="space-y-2">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-text-muted">Weekly Summary</h3>
                <MetricsTable rows={weeklySummaryRows} labelKey="weekLabel" labelTitle="Week" />
              </div>
              <div className="space-y-2">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-text-muted">Monthly Rollup</h3>
                <MetricsTable rows={monthlyRollupRows} labelKey="monthLabel" labelTitle="Month" />
              </div>
            </div>
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
        id: 'top-achievers-summary',
        render: () => (
          <GlassCard className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-text-muted">Achivers</h2>
            <div className="grid gap-4 xl:grid-cols-2">
              <div className="space-y-2 rounded-2xl border border-success/40 bg-success-soft/60 p-3">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-success">Top Over-Achievers</h3>
                <MetricsTable rows={planActualData?.topPerformers?.overAchievers || []} labelKey="name" labelTitle="Salesperson" />
              </div>
              <div className="space-y-2 rounded-2xl border border-error/40 bg-error-soft/60 p-3">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-error">Top Under-Achievers</h3>
                <MetricsTable rows={planActualData?.topPerformers?.underAchievers || []} labelKey="name" labelTitle="Salesperson" />
              </div>
            </div>
          </GlassCard>
        ),
      },
      {
        id: 'compliance-by-salesperson',
        render: () => (
          <GlassCard className="space-y-4">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-text-muted">Subteam Member JSV Compliance</h2>
            <DataTableFrame className={ADMIN_TABLE_FRAME_CLASS}>
              <table className="table-core min-w-full text-sm">
                <thead>
                  <tr>
                    <th>Sub Team</th>
                    <th>Team</th>
                    <th>Main Team</th>
                    <th>Weekly JSV</th>
                    <th>JSV Bar</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {(activityData?.subteamMemberCards || [])
                    .filter((card) => {
                      const subTeam = String(card?.member?.subTeam || '').trim()
                      return Boolean(subTeam) && subTeam.toLowerCase() !== 'unassigned'
                    })
                    .map((card) => (
                    <tr key={card.member.id}>
                      <td>{card.member.subTeam || '-'}</td>
                      <td>{card.member.team || '-'}</td>
                      <td>{card.member.mainTeam || '-'}</td>
                      <td>{card.stats.jsvCount}</td>
                      <td>
                        <JsvProgressBar jsvCount={card.stats.jsvCount || 0} />
                      </td>
                      <td>
                        <StatusChip severity={card.stats.isCompliant ? 'compliant' : 'critical'} />
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
        id: 'enquiry-kpis',
        render: () => (
          <GlassCard className="space-y-4">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-text-muted">Enquiry KPIs</h2>
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <InsightCard
                  title="Enquiries From Visits"
                  value={String(planActualData?.enquiryKpis?.enquiriesGeneratedFromVisits || 0)}
                  variant="info"
                />
                <InsightCard
                  title="Visit to Enquiry Ratio"
                  value={formatRatio(planActualData?.enquiryKpis?.visitToEnquiryConversionRatio || 0)}
                  subtitle={`${String(planActualData?.totals?.actualVisits || 0)} visits`}
                  variant="success"
                />
              </div>
            </div>
          </GlassCard>
        ),
      },
      {
        id: 'more-insights',
        render: () => (
          <GlassCard className="space-y-4">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-text-muted">More Insights</h2>
            <Input
              type="search"
              value={moreInsightsSearch}
              onChange={(event) => setMoreInsightsSearch(event.target.value)}
              placeholder="Search across all More Insights tables"
              aria-label="Search rows across More Insights tables"
            />

            <CollapsibleInsightsTable title="Salesperson Performance Rollup">
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
                    {filteredSalespersonRollupRows.map((row) => (
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
                    {!filteredSalespersonRollupRows.length ? (
                      <tr>
                        <td colSpan={8} className="py-4 text-center text-text-secondary">
                          No matching rows found.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </DataTableFrame>
            </CollapsibleInsightsTable>

            <CollapsibleInsightsTable title="Recent Logs">
              <DataTableFrame className={ADMIN_TABLE_FRAME_CLASS}>
                <table className="table-core min-w-full text-sm">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Week</th>
                      <th>Salesperson</th>
                      <th>Team</th>
                      <th>Sub Team</th>
                      <th>Customer</th>
                      <th>Type</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredVisitDrilldownRows.map((row, index) => (
                      <tr key={`visit-${row.date}-${row.salesman?.id || index}`}>
                        <td>{row.date || '-'}</td>
                        <td>{row.isoWeek || '-'}</td>
                        <td>{row.salesman?.name || row.salesman?.email || '-'}</td>
                        <td>{row.salesman?.team || '-'}</td>
                        <td>{row.salesman?.subTeam || '-'}</td>
                        <td>{row.customerName || '-'}</td>
                        <td>{formatCallType(row.callType)}</td>
                        <td>{row.visited ? 'Visited' : 'Planned only'}</td>
                      </tr>
                    ))}
                    {filteredActivityDrilldownRows.map((row, index) => (
                      <tr key={`activity-${row.salesperson?.id || index}-${row.date || index}`}>
                        <td>{row.date || '-'}</td>
                        <td>{week || '-'}</td>
                        <td>{row.salesperson?.name || '-'}</td>
                        <td>{row.salesperson?.team || '-'}</td>
                        <td>{row.salesperson?.subTeam || '-'}</td>
                        <td>{row.customerName || '-'}</td>
                        <td>{String(row.type || '-').toUpperCase()}</td>
                        <td>{row.type ? 'Logged' : '-'}</td>
                      </tr>
                    ))}
                    {!filteredVisitDrilldownRows.length && !filteredActivityDrilldownRows.length ? (
                      <tr>
                        <td colSpan={8} className="py-4 text-center text-text-secondary">
                          No matching rows found.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </DataTableFrame>
            </CollapsibleInsightsTable>

          </GlassCard>
        ),
      },
    ],
    [
      activityData,
      callTypeRows,
      customerTypeRows,
      dataErrors.activityCompliance,
      dataErrors.planActual,
      dataErrors.stage3,
      dailyTrendRows,
      monthlyRollupRows,
      moreInsightsSearch,
      planActualData,
      stage3Data,
      filteredSalespersonRollupRows,
      filteredVisitDrilldownRows,
      filteredActivityDrilldownRows,
      weeklySummaryRows,
      week,
      chartTheme,
      chartTooltipStyle,
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
  const [collapsedSectionIds, setCollapsedSectionIds] = useState(INSIGHTS_SECTION_IDS)
  const [isFullRowHydrated, setIsFullRowHydrated] = useState(false)
  const [isCollapsedHydrated, setIsCollapsedHydrated] = useState(false)
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

  useEffect(() => {
    let isMounted = true

    const loadCollapsedSections = async () => {
      setCollapsedSectionIds(INSIGHTS_SECTION_IDS)
      setIsCollapsedHydrated(false)

      try {
        const response = await getAdminInsightsPreferences()
        if (!isMounted) return
        const serverCollapsed = response?.collapsedSectionIds
        const normalized = Array.isArray(serverCollapsed)
          ? INSIGHTS_SECTION_IDS.filter((id) => serverCollapsed.includes(id))
          : INSIGHTS_SECTION_IDS
        setCollapsedSectionIds(normalized)
      } catch {
        if (!isMounted) return
        setCollapsedSectionIds(INSIGHTS_SECTION_IDS)
      } finally {
        if (isMounted) setIsCollapsedHydrated(true)
      }
    }

    loadCollapsedSections()

    return () => {
      isMounted = false
    }
  }, [userStorageIdentity])

  useEffect(() => {
    if (!isCollapsedHydrated) return

    const normalized = INSIGHTS_SECTION_IDS.filter((id) => collapsedSectionIds.includes(id))
    const shouldRewrite = normalized.length !== collapsedSectionIds.length
    if (shouldRewrite) {
      setCollapsedSectionIds(normalized)
      return
    }

    updateAdminInsightsPreferences({ collapsedSectionIds: normalized }).catch(() => {
      // Best-effort persistence only.
    })
  }, [collapsedSectionIds, isCollapsedHydrated])

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

  const handleToggleCollapsed = (sectionId) => {
    setCollapsedSectionIds((prev) =>
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

        <div className="grid grid-cols-1 gap-4 rounded-2xl border border-border-default bg-surface-2/90 p-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-text-muted">Week</label>
            <Input type="week" value={week} onChange={(e) => setWeek(e.target.value)} />
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
          <div className="space-y-1.5">
            <label className="text-xs font-semibold uppercase tracking-wider text-text-muted">Salespeople</label>
            <MultiSelect
              options={filteredSalesmenOptions}
              selected={salesmen}
              onChange={setSalesmen}
              placeholder="All salespeople"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 rounded-2xl border border-border-default bg-surface-3/75 p-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
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
                  collapsedLabel={SECTION_TITLES[sectionId] || sectionId}
                  isFullRow={fullRowSectionIds.includes(sectionId)}
                  isCollapsed={collapsedSectionIds.includes(sectionId)}
                  onToggleFullRow={handleToggleFullRow}
                  onToggleCollapsed={handleToggleCollapsed}
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
        <UnifiedAdminSection />
      </PageSurface>
    </PageEnter>
  )
}
