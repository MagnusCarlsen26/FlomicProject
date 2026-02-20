import { useCallback, useEffect, useRef, useState } from 'react'
import PageSurface from '../components/layout/PageSurface'
import PageEnter from '../components/motion/PageEnter'
import Alert from '../components/ui/Alert'
import Badge from '../components/ui/Badge'
import Button from '../components/ui/Button'
import DataTableFrame from '../components/ui/DataTableFrame'
import GlassCard from '../components/ui/GlassCard'
import { getAdminSalesmenStatus } from '../services/api'
import { contactTypeLabel, customerTypeLabel, visitedLabel } from '../constants/weeklyReportFields'
import { formatDateTime, formatSheetDate, getErrorMessage } from './adminUtils'

function PlanningRowsTable({ rows }) {
  if (!rows?.length) {
    return <p className="rounded-xl border border-dashed border-border p-3 text-sm text-text-secondary">No rows</p>
  }

  return (
    <DataTableFrame>
      <table className="table-core min-w-full text-sm">
        <thead>
          <tr>
            <th>Week</th>
            <th>Date</th>
            <th>Customer</th>
            <th>Location</th>
            <th>Type</th>
            <th>Contact</th>
            <th>If JSV, with whom</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={`${row.date || 'planning'}-${index}`}>
              <td>{row.isoWeek ?? '-'}</td>
              <td>{formatSheetDate(row.date)}</td>
              <td>{row.customerName || '-'}</td>
              <td>{row.locationArea || '-'}</td>
              <td>{customerTypeLabel(row.customerType)}</td>
              <td>{contactTypeLabel(row.contactType)}</td>
              <td>{row.jsvWithWhom || '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </DataTableFrame>
  )
}

function ActualOutputRowsTable({ rows }) {
  if (!rows?.length) {
    return <p className="rounded-xl border border-dashed border-border p-3 text-sm text-text-secondary">No rows</p>
  }

  return (
    <DataTableFrame>
      <table className="table-core min-w-full text-sm">
        <thead>
          <tr>
            <th>Week</th>
            <th>Date</th>
            <th>Visited</th>
            <th>Reason not visited</th>
            <th>Enquiries</th>
            <th>Shipments</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={`${row.date || 'actual'}-${index}`}>
              <td>{row.isoWeek ?? '-'}</td>
              <td>{formatSheetDate(row.date)}</td>
              <td>{visitedLabel(row.visited)}</td>
              <td>{row.notVisitedReason || '-'}</td>
              <td>{row.enquiriesReceived ?? 0}</td>
              <td>{row.shipmentsConverted ?? 0}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </DataTableFrame>
  )
}

export default function AdminSalesmenStatusPage() {
  const [loading, setLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [error, setError] = useState(null)
  const [successMessage, setSuccessMessage] = useState(null)
  const [entries, setEntries] = useState([])
  const [total, setTotal] = useState(0)
  const [weekInfo, setWeekInfo] = useState(null)
  const [lastPolledAt, setLastPolledAt] = useState(null)
  const fetchCounterRef = useRef(0)

  const fetchStatus = useCallback(
    async ({ silent = false, showSuccess = false } = {}) => {
      const fetchId = fetchCounterRef.current + 1
      fetchCounterRef.current = fetchId

      if (!silent) {
        setLoading(true)
      } else {
        setIsRefreshing(true)
      }

      try {
        const statusData = await getAdminSalesmenStatus()

        if (fetchId !== fetchCounterRef.current) {
          return
        }

        setEntries(statusData?.entries || [])
        setTotal(statusData?.total || 0)
        setWeekInfo(statusData?.week || null)
        setLastPolledAt(new Date().toISOString())
        setError(null)
        if (!silent && showSuccess) {
          setSuccessMessage('Salesman status refreshed.')
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
    [],
  )

  useEffect(() => {
    fetchStatus()
  }, [fetchStatus])

  return (
    <PageEnter>
      <PageSurface>
        <GlassCard>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.16em] text-primary">Admin</p>
              <h1 className="mt-1 text-2xl font-bold text-text-primary">Salesmen Status</h1>
            </div>
            <Button
              variant="secondary"
              onClick={() => fetchStatus({ showSuccess: true })}
              disabled={loading || isRefreshing}
            >
              {loading || isRefreshing ? 'Refreshing...' : 'Refresh'}
            </Button>
          </div>

          <p className="mt-3 text-sm text-text-secondary">Showing {total} salesmen. Last refresh: {formatDateTime(lastPolledAt)}</p>

          <div className="mt-4 space-y-3">
            {error ? <Alert tone="error">{error}</Alert> : null}
            {successMessage && !error ? <Alert tone="success">{successMessage}</Alert> : null}
          </div>
        </GlassCard>

        <section className="space-y-3">
          {loading ? <p className="text-sm text-text-secondary">Loading status...</p> : null}

          {!loading && entries.length === 0 ? (
            <GlassCard>
              <p className="text-sm text-text-secondary">No salesmen found for the selected filters.</p>
            </GlassCard>
          ) : null}

          {entries.map((entry) => (
            <details
              key={entry.salesman.id}
              className="rounded-3xl border border-border bg-surface p-4 shadow-soft open:ring-1 open:ring-primary/40"
            >
              <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-base font-semibold text-text-primary">{entry.salesman.name || entry.salesman.email}</p>
                    {entry.salesman?.jsvRepeatAlert?.active ? (
                      <Badge tone="warning" title={entry.salesman?.jsvRepeatAlert?.message || ''}>
                        JSV Alert
                      </Badge>
                    ) : null}
                  </div>
                  <p className="text-sm text-text-secondary">{entry.salesman.email}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge tone={entry.planning.submittedAt ? 'success' : 'warning'}>
                    Planning {entry.planning.submittedAt ? 'submitted' : 'draft'}
                  </Badge>
                  <Badge tone={entry.actualOutput.updatedAt ? 'info' : 'neutral'}>
                    Actual {entry.actualOutput.updatedAt ? 'updated' : 'pending'}
                  </Badge>
                </div>
              </summary>

              <div className="mt-4 grid gap-4 xl:grid-cols-1">
                <div className="space-y-2 rounded-2xl border border-border bg-surface p-4">
                  <h2 className="text-sm font-semibold uppercase tracking-wide text-text-muted">Planning</h2>
                  <p className="text-xs text-text-secondary">Submitted: {formatDateTime(entry.planning.submittedAt)}</p>
                  <PlanningRowsTable rows={entry.planning.rows} />
                </div>

                <div className="space-y-2 rounded-2xl border border-border bg-surface p-4">
                  <h2 className="text-sm font-semibold uppercase tracking-wide text-text-muted">Actual Output</h2>
                  <p className="text-xs text-text-secondary">Updated: {formatDateTime(entry.actualOutput.updatedAt)}</p>
                  <ActualOutputRowsTable rows={entry.actualOutput.rows} />
                </div>
              </div>
            </details>
          ))}
        </section>

        {weekInfo ? (
          <p className="text-xs text-text-muted">Detail table week: {weekInfo.startDate} to {weekInfo.endDate}</p>
        ) : null}
      </PageSurface>
    </PageEnter>
  )
}
