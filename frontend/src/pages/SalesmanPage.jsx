import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '../context/useAuth'
import {
  ApiError,
  getSalesmanCurrentWeek,
  updateSalesmanActualOutput,
  updateSalesmanPlanning,
} from '../services/api'
import {
  CONTACT_TYPE_OPTIONS,
  CUSTOMER_TYPE_OPTIONS,
  VISITED_OPTIONS,
} from '../constants/weeklyReportFields'

function getErrorMessage(error) {
  if (error instanceof ApiError) {
    return error.message
  }

  if (error instanceof Error) {
    return error.message
  }

  return 'Request failed'
}

function formatDateTime(value) {
  if (!value) {
    return 'Not updated yet'
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return 'Invalid date'
  }

  return date.toLocaleString()
}

function formatSheetDate(dateKey) {
  if (!dateKey) {
    return '-'
  }

  const date = new Date(`${dateKey}T00:00:00.000Z`)
  if (Number.isNaN(date.getTime())) {
    return dateKey
  }

  return date.toLocaleDateString(undefined, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

function toNonNegativeInteger(value) {
  if (value === '' || value === null || value === undefined) {
    return 0
  }

  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed < 0) {
    return 0
  }

  return parsed
}

function SectionCard({ title, description, children }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
      <p className="mt-1 text-sm text-slate-600">{description}</p>
      <div className="mt-4">{children}</div>
    </section>
  )
}

function PlanningTableEditor({ rows, setRows, disabled }) {
  const updateRow = useCallback(
    (index, field, value) => {
      setRows((prevRows) =>
        prevRows.map((row, rowIndex) => {
          if (rowIndex !== index) {
            return row
          }

          const nextRow = {
            ...row,
            [field]: value,
          }

          if (field === 'contactType' && value !== 'jsv') {
            nextRow.jsvWithWhom = ''
          }

          return nextRow
        }),
      )
    },
    [setRows],
  )

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200">
      <table className="min-w-full divide-y divide-slate-200 text-sm">
        <thead className="bg-slate-50">
          <tr>
            <th className="px-3 py-2 text-left font-medium text-slate-600">Week</th>
            <th className="px-3 py-2 text-left font-medium text-slate-600">Date</th>
            <th className="px-3 py-2 text-left font-medium text-slate-600">Customer Name</th>
            <th className="px-3 py-2 text-left font-medium text-slate-600">Location / Area</th>
            <th className="px-3 py-2 text-left font-medium text-slate-600">Targeted / Existing</th>
            <th className="px-3 py-2 text-left font-medium text-slate-600">NC / FC / SC / JSV</th>
            <th className="px-3 py-2 text-left font-medium text-slate-600">If JSV, with whom</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200 bg-white">
          {rows.map((row, index) => (
            <tr key={row.date || `planning-row-${index}`}>
              <td className="px-3 py-2 text-slate-800">{row.isoWeek ?? '-'}</td>
              <td className="px-3 py-2 text-slate-800">{formatSheetDate(row.date)}</td>
              <td className="px-3 py-2">
                <input
                  type="text"
                  value={row.customerName || ''}
                  onChange={(event) => updateRow(index, 'customerName', event.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-2 py-1 text-sm"
                  disabled={disabled}
                />
              </td>
              <td className="px-3 py-2">
                <input
                  type="text"
                  value={row.locationArea || ''}
                  onChange={(event) => updateRow(index, 'locationArea', event.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-2 py-1 text-sm"
                  disabled={disabled}
                />
              </td>
              <td className="px-3 py-2">
                <select
                  value={row.customerType || ''}
                  onChange={(event) => updateRow(index, 'customerType', event.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-2 py-1 text-sm"
                  disabled={disabled}
                >
                  {CUSTOMER_TYPE_OPTIONS.map((option) => (
                    <option key={option.value || 'empty'} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </td>
              <td className="px-3 py-2">
                <select
                  value={row.contactType || ''}
                  onChange={(event) => updateRow(index, 'contactType', event.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-2 py-1 text-sm"
                  disabled={disabled}
                >
                  {CONTACT_TYPE_OPTIONS.map((option) => (
                    <option key={option.value || 'empty'} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </td>
              <td className="px-3 py-2">
                <input
                  type="text"
                  value={row.jsvWithWhom || ''}
                  onChange={(event) => updateRow(index, 'jsvWithWhom', event.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-2 py-1 text-sm"
                  disabled={disabled || row.contactType !== 'jsv'}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function ActualOutputTableEditor({ rows, setRows, disabled }) {
  const updateRow = useCallback(
    (index, field, value) => {
      setRows((prevRows) =>
        prevRows.map((row, rowIndex) => {
          if (rowIndex !== index) {
            return row
          }

          const nextRow = {
            ...row,
            [field]: value,
          }

          if (field === 'visited' && value !== 'no') {
            nextRow.notVisitedReason = ''
          }

          if (field === 'enquiriesReceived' || field === 'shipmentsConverted') {
            nextRow[field] = toNonNegativeInteger(value)
          }

          return nextRow
        }),
      )
    },
    [setRows],
  )

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200">
      <table className="min-w-full divide-y divide-slate-200 text-sm">
        <thead className="bg-slate-50">
          <tr>
            <th className="px-3 py-2 text-left font-medium text-slate-600">Week</th>
            <th className="px-3 py-2 text-left font-medium text-slate-600">Date</th>
            <th className="px-3 py-2 text-left font-medium text-slate-600">Visited</th>
            <th className="px-3 py-2 text-left font-medium text-slate-600">Reason not visited</th>
            <th className="px-3 py-2 text-left font-medium text-slate-600">Enquiries</th>
            <th className="px-3 py-2 text-left font-medium text-slate-600">Shipments Converted</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200 bg-white">
          {rows.map((row, index) => (
            <tr key={row.date || `actual-row-${index}`}>
              <td className="px-3 py-2 text-slate-800">{row.isoWeek ?? '-'}</td>
              <td className="px-3 py-2 text-slate-800">{formatSheetDate(row.date)}</td>
              <td className="px-3 py-2">
                <select
                  value={row.visited || ''}
                  onChange={(event) => updateRow(index, 'visited', event.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-2 py-1 text-sm"
                  disabled={disabled}
                >
                  {VISITED_OPTIONS.map((option) => (
                    <option key={option.value || 'empty'} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </td>
              <td className="px-3 py-2">
                <input
                  type="text"
                  value={row.notVisitedReason || ''}
                  onChange={(event) => updateRow(index, 'notVisitedReason', event.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-2 py-1 text-sm"
                  disabled={disabled || row.visited !== 'no'}
                />
              </td>
              <td className="px-3 py-2">
                <input
                  type="number"
                  min="0"
                  value={row.enquiriesReceived ?? 0}
                  onChange={(event) => updateRow(index, 'enquiriesReceived', event.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-2 py-1 text-sm"
                  disabled={disabled}
                />
              </td>
              <td className="px-3 py-2">
                <input
                  type="number"
                  min="0"
                  value={row.shipmentsConverted ?? 0}
                  onChange={(event) => updateRow(index, 'shipmentsConverted', event.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-2 py-1 text-sm"
                  disabled={disabled}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function SalesmanPage() {
  const { user, signOut } = useAuth()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [successMessage, setSuccessMessage] = useState(null)

  const [week, setWeek] = useState(null)
  const [planningRows, setPlanningRows] = useState([])
  const [actualRows, setActualRows] = useState([])
  const [planningSubmittedAt, setPlanningSubmittedAt] = useState(null)
  const [actualUpdatedAt, setActualUpdatedAt] = useState(null)

  const [savingPlanning, setSavingPlanning] = useState(false)
  const [savingActual, setSavingActual] = useState(false)

  const loadCurrentWeek = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const data = await getSalesmanCurrentWeek()
      setWeek(data?.week ?? null)
      setPlanningRows(data?.planning?.rows || [])
      setActualRows(data?.actualOutput?.rows || [])
      setPlanningSubmittedAt(data?.planning?.submittedAt || null)
      setActualUpdatedAt(data?.actualOutput?.updatedAt || null)
      setSuccessMessage(null)
    } catch (e) {
      setSuccessMessage(null)
      setError(getErrorMessage(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadCurrentWeek()
  }, [loadCurrentWeek])

  const pageTitle = useMemo(() => {
    if (!week) {
      return 'Current Week Workspace'
    }

    return `Current Week Workspace (${week.startDate} to ${week.endDate} ${week.timezone})`
  }, [week])

  const isEditable = week?.isEditable !== false

  const handleSavePlanning = useCallback(async () => {
    if (!week?.key) {
      return
    }

    setSavingPlanning(true)
    setError(null)
    setSuccessMessage(null)

    try {
      const data = await updateSalesmanPlanning({ weekKey: week.key, rows: planningRows })
      setPlanningRows(data?.planning?.rows || [])
      setPlanningSubmittedAt(data?.planning?.submittedAt || planningSubmittedAt)
      setSuccessMessage('Planning saved successfully.')
    } catch (e) {
      setError(getErrorMessage(e))
    } finally {
      setSavingPlanning(false)
    }
  }, [planningRows, planningSubmittedAt, week?.key])

  const handleSubmitPlan = useCallback(async () => {
    if (!week?.key) {
      return
    }

    setSavingPlanning(true)
    setError(null)
    setSuccessMessage(null)

    try {
      const data = await updateSalesmanPlanning({
        weekKey: week.key,
        rows: planningRows,
        submitted: true,
      })
      setPlanningRows(data?.planning?.rows || [])
      setPlanningSubmittedAt(data?.planning?.submittedAt || null)
      setSuccessMessage('Weekly plan submitted successfully.')
    } catch (e) {
      setError(getErrorMessage(e))
    } finally {
      setSavingPlanning(false)
    }
  }, [planningRows, week?.key])

  const handleSaveActual = useCallback(async () => {
    if (!week?.key) {
      return
    }

    setSavingActual(true)
    setError(null)
    setSuccessMessage(null)

    try {
      const data = await updateSalesmanActualOutput({ weekKey: week.key, rows: actualRows })
      setActualRows(data?.actualOutput?.rows || [])
      setActualUpdatedAt(data?.actualOutput?.updatedAt || null)
      setSuccessMessage('Actual output saved successfully.')
    } catch (e) {
      setError(getErrorMessage(e))
    } finally {
      setSavingActual(false)
    }
  }, [actualRows, week?.key])

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-8">
      <div className="mx-auto w-full max-w-7xl space-y-6">
        <header className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium uppercase tracking-wide text-slate-500">Salesman</p>
              <h1 className="text-2xl font-semibold text-slate-900">{pageTitle}</h1>
              <p className="mt-1 text-sm text-slate-600">
                Signed in as {user?.name || user?.email || 'Unknown user'}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={loadCurrentWeek}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-900 transition hover:bg-slate-100"
                disabled={loading}
              >
                Refresh
              </button>
              <button
                type="button"
                onClick={signOut}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-900 transition hover:bg-slate-100"
              >
                Logout
              </button>
            </div>
          </div>
          {!isEditable && (
            <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              Editing is locked because the IST week has ended.
            </div>
          )}
          {error && (
            <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
              {error}
            </div>
          )}
          {successMessage && (
            <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
              {successMessage}
            </div>
          )}
        </header>

        <SectionCard
          title="Planning"
          description={`Build your weekly plan. Last submitted: ${formatDateTime(planningSubmittedAt)}`}
        >
          {loading ? (
            <p className="text-sm text-slate-600">Loading planning...</p>
          ) : (
            <>
              <PlanningTableEditor rows={planningRows} setRows={setPlanningRows} disabled={!isEditable || savingPlanning} />
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleSavePlanning}
                  className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-900"
                  disabled={!isEditable || savingPlanning}
                >
                  {savingPlanning ? 'Saving...' : 'Save planning'}
                </button>
                <button
                  type="button"
                  onClick={handleSubmitPlan}
                  className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white"
                  disabled={!isEditable || savingPlanning}
                >
                  {savingPlanning ? 'Submitting...' : 'Submit weekly plan'}
                </button>
              </div>
            </>
          )}
        </SectionCard>

        <SectionCard
          title="Actual Output"
          description={`Update the week output. Last updated: ${formatDateTime(actualUpdatedAt)}`}
        >
          {loading ? (
            <p className="text-sm text-slate-600">Loading actual output...</p>
          ) : (
            <>
              <ActualOutputTableEditor rows={actualRows} setRows={setActualRows} disabled={!isEditable || savingActual} />
              <button
                type="button"
                onClick={handleSaveActual}
                className="mt-4 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white"
                disabled={!isEditable || savingActual}
              >
                {savingActual ? 'Saving...' : 'Save actual output'}
              </button>
            </>
          )}
        </SectionCard>

      </div>
    </div>
  )
}
