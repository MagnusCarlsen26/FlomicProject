import { memo, useCallback, useEffect, useState } from 'react'
import { useAuth } from '../context/useAuth'
import PageSurface from '../components/layout/PageSurface'
import StatTile from '../components/layout/StatTile'
import PageEnter from '../components/motion/PageEnter'
import RevealCard from '../components/motion/RevealCard'
import StaggerGroup from '../components/motion/StaggerGroup'
import Alert from '../components/ui/Alert'
import Badge from '../components/ui/Badge'
import Button from '../components/ui/Button'
import DataTableFrame from '../components/ui/DataTableFrame'
import GlassCard from '../components/ui/GlassCard'
import Input from '../components/ui/Input'
import Select from '../components/ui/Select'
import {
  ApiError,
  getSalesmanCurrentWeek,
  updateSalesmanActualOutput,
  updateSalesmanPlanning,
} from '../services/api'
import {
  CONTACT_TYPE_OPTIONS,
  CUSTOMER_TYPE_OPTIONS,
  NOT_VISITED_REASON_CATEGORY_OPTIONS,
  VISITED_OPTIONS,
} from '../constants/weeklyReportFields'
import { formatDateTime, formatSheetDate } from '../utils/dateFormat'

function getErrorMessage(error) {
  if (error instanceof ApiError) {
    return error.message
  }

  if (error instanceof Error) {
    return error.message
  }

  return 'Request failed'
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

function SectionCard({ title, description, actions, children }) {
  return (
    <GlassCard>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-text-primary">{title}</h2>
          <p className="mt-1 text-sm text-text-secondary">{description}</p>
        </div>
        {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
      </div>
      <div className="mt-4">{children}</div>
    </GlassCard>
  )
}

const PlanningRow = memo(function PlanningRow({ row, index, updateRow, disabled, jsvEligibleUsers }) {
  const normalizedMembers = Array.isArray(jsvEligibleUsers) ? jsvEligibleUsers : []
  const memberIds = new Set(normalizedMembers.map((member) => member.id))
  const selectedJsvValue = row.jsvWithWhom || ''
  const hasLegacyValue = selectedJsvValue && !memberIds.has(selectedJsvValue)

  return (
    <tr>
      <td>{row.isoWeek ?? '-'}</td>
      <td>{formatSheetDate(row.date)}</td>
      <td>
        <Input
          type="text"
          value={row.customerName || ''}
          onChange={(event) => updateRow(index, 'customerName', event.target.value)}
          disabled={disabled}
        />
      </td>
      <td>
        <Input
          type="text"
          value={row.locationArea || ''}
          onChange={(event) => updateRow(index, 'locationArea', event.target.value)}
          disabled={disabled}
        />
      </td>
      <td>
        <Select
          value={row.customerType || ''}
          onChange={(event) => updateRow(index, 'customerType', event.target.value)}
          disabled={disabled}
        >
          {CUSTOMER_TYPE_OPTIONS.map((option) => (
            <option key={option.value || 'empty'} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
      </td>
      <td>
        <Select
          value={row.contactType || ''}
          onChange={(event) => updateRow(index, 'contactType', event.target.value)}
          disabled={disabled}
        >
          {CONTACT_TYPE_OPTIONS.map((option) => (
            <option key={option.value || 'empty'} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
      </td>
      <td>
        <Select
          value={selectedJsvValue}
          onChange={(event) => updateRow(index, 'jsvWithWhom', event.target.value)}
          disabled={disabled || row.contactType !== 'jsv'}
        >
          <option value="">Select member</option>
          {hasLegacyValue ? (
            <option value={selectedJsvValue}>{`Legacy (unchanged): ${selectedJsvValue}`}</option>
          ) : null}
          {normalizedMembers.map((member) => (
            <option key={member.id} value={member.id}>
              {member.name || member.email}
            </option>
          ))}
        </Select>
      </td>
    </tr>
  )
})

function PlanningTableEditor({ rows, setRows, disabled, jsvEligibleUsers }) {
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
    <DataTableFrame>
      <table className="table-core min-w-full text-sm">
        <thead>
          <tr>
            <th>Week</th>
            <th>Date</th>
            <th>Customer Name</th>
            <th>Location / Area</th>
            <th>Targeted / Existing</th>
            <th>NC / FC / SC / JSV</th>
            <th>If JSV, with whom</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <PlanningRow
              key={row.date || `planning-row-${index}`}
              row={row}
              index={index}
              updateRow={updateRow}
              disabled={disabled}
              jsvEligibleUsers={jsvEligibleUsers}
            />
          ))}
        </tbody>
      </table>
    </DataTableFrame>
  )
}

const ActualOutputRow = memo(function ActualOutputRow({ row, index, updateRow, disabled }) {
  return (
    <tr>
      <td>{row.isoWeek ?? '-'}</td>
      <td>{formatSheetDate(row.date)}</td>
      <td>
        <Select
          value={row.visited || ''}
          onChange={(event) => updateRow(index, 'visited', event.target.value)}
          disabled={disabled}
        >
          {VISITED_OPTIONS.map((option) => (
            <option key={option.value || 'empty'} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
      </td>
      <td>
        <Input
          type="text"
          value={row.notVisitedReason || ''}
          onChange={(event) => updateRow(index, 'notVisitedReason', event.target.value)}
          disabled={disabled || row.visited !== 'no'}
        />
      </td>
      <td>
        <Select
          value={row.notVisitedReasonCategory || ''}
          onChange={(event) => updateRow(index, 'notVisitedReasonCategory', event.target.value)}
          disabled={disabled || row.visited !== 'no'}
        >
          {NOT_VISITED_REASON_CATEGORY_OPTIONS.map((option) => (
            <option key={option.value || 'empty'} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
      </td>
      <td>
        <Input
          type="number"
          min="0"
          value={row.enquiriesReceived ?? 0}
          onChange={(event) => updateRow(index, 'enquiriesReceived', event.target.value)}
          disabled={disabled}
        />
      </td>
      <td>
        <Input
          type="number"
          min="0"
          value={row.shipmentsConverted ?? 0}
          onChange={(event) => updateRow(index, 'shipmentsConverted', event.target.value)}
          disabled={disabled}
        />
      </td>
    </tr>
  )
})

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
            nextRow.notVisitedReasonCategory = ''
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
    <DataTableFrame>
      <table className="table-core min-w-full text-sm">
        <thead>
          <tr>
            <th>Week</th>
            <th>Date</th>
            <th>Visited</th>
            <th>Reason not visited</th>
            <th>Not Visited Category</th>
            <th>Enquiries</th>
            <th>Shipments Converted</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <ActualOutputRow
              key={row.date || `actual-row-${index}`}
              row={row}
              index={index}
              updateRow={updateRow}
              disabled={disabled}
            />
          ))}
        </tbody>
      </table>
    </DataTableFrame>
  )
}

const SalesmanHeaderCard = memo(function SalesmanHeaderCard({
  user,
  week,
  planningSubmittedAt,
  actualUpdatedAt,
  isEditable,
  error,
  successMessage,
  savingStatusMessage,
  loading,
  onRefresh,
}) {
  const hasJsvAlert = user?.jsvRepeatAlert?.active === true
  const alertMessage = user?.jsvRepeatAlert?.message || ''

  return (
    <GlassCard className="overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-primary">Salesman</p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <p className="text-base font-semibold text-text-primary">{user?.name || user?.email || 'Signed in'}</p>
            {hasJsvAlert ? (
              <Badge tone="warning" title={alertMessage}>
                JSV Alert
              </Badge>
            ) : null}
          </div>
        </div>
        <Button variant="secondary" onClick={onRefresh} disabled={loading}>
          {loading ? 'Refreshing...' : 'Refresh'}
        </Button>
      </div>

      <StaggerGroup className="mt-5 grid gap-3 md:grid-cols-3">
        <RevealCard>
          <StatTile
            label="Week Range"
            value={
              week
                ? `${formatSheetDate(week.startDate)} – ${formatSheetDate(week.endDate)}`
                : 'Pending'
            }
            detail={week?.timezone || 'Timezone pending'}
          />
        </RevealCard>
        <RevealCard>
          <StatTile label="Planning Status" value={planningSubmittedAt ? 'Submitted' : 'Draft'} detail={formatDateTime(planningSubmittedAt)} />
        </RevealCard>
        <RevealCard>
          <StatTile label="Actual Output" value={actualUpdatedAt ? 'Updated' : 'Not updated'} detail={formatDateTime(actualUpdatedAt)} />
        </RevealCard>
      </StaggerGroup>

      <div className="mt-5 space-y-3">
        {!isEditable ? <Alert tone="warning">Editing is locked because the IST week has ended.</Alert> : null}
        {savingStatusMessage ? <Alert tone="warning">{savingStatusMessage}</Alert> : null}
        {error ? <Alert tone="error">{error}</Alert> : null}
        {successMessage ? <Alert tone="success">{successMessage}</Alert> : null}
      </div>
    </GlassCard>
  )
})

export default function SalesmanPage() {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [successMessage, setSuccessMessage] = useState(null)

  const [week, setWeek] = useState(null)
  const [planningRows, setPlanningRows] = useState([])
  const [actualRows, setActualRows] = useState([])
  const [planningSubmittedAt, setPlanningSubmittedAt] = useState(null)
  const [actualUpdatedAt, setActualUpdatedAt] = useState(null)
  const [jsvEligibleUsers, setJsvEligibleUsers] = useState([])

  const [savingActual, setSavingActual] = useState(false)
  const [savingPlanning, setSavingPlanning] = useState(false)
  const savingStatusMessage = savingPlanning
    ? 'Saving planning changes...'
    : savingActual
      ? 'Saving actual output changes...'
      : ''

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
      setJsvEligibleUsers(data?.jsvEligibleUsers || data?.jsvAdminUsers || [])
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

  const isEditable = week?.isEditable !== false

  const handleSavePlanning = useCallback(async () => {
    if (!week?.key) {
      return
    }

    setSavingPlanning(true)
    setError(null)
    setSuccessMessage(null)

    try {
      const data = await updateSalesmanPlanning({ weekKey: week.key, rows: planningRows, submitted: true })
      setPlanningRows(data?.planning?.rows || [])
      setPlanningSubmittedAt(data?.planning?.submittedAt || null)
      setSuccessMessage('Planning saved successfully.')
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
    <PageEnter>
      <PageSurface>
        <SalesmanHeaderCard
          user={user}
          week={week}
          planningSubmittedAt={planningSubmittedAt}
          actualUpdatedAt={actualUpdatedAt}
          isEditable={isEditable}
          error={error}
          successMessage={successMessage}
          savingStatusMessage={savingStatusMessage}
          loading={loading}
          onRefresh={loadCurrentWeek}
        />

        <SectionCard
          title="Planning"
          description={`Last submitted: ${formatDateTime(planningSubmittedAt)}`}
          actions={
            <Button onClick={handleSavePlanning} disabled={!isEditable || savingPlanning}>
              {savingPlanning ? 'Saving...' : 'Save planning'}
            </Button>
          }
        >
          {loading ? (
            <p className="text-sm text-text-secondary">Loading planning...</p>
          ) : (
            <PlanningTableEditor
              rows={planningRows}
              setRows={setPlanningRows}
              disabled={!isEditable || savingPlanning}
              jsvEligibleUsers={jsvEligibleUsers}
            />
          )}
        </SectionCard>

        <SectionCard
          title="Actual Output"
          description={`Last updated: ${formatDateTime(actualUpdatedAt)}`}
          actions={
            <Button onClick={handleSaveActual} disabled={!isEditable || savingActual}>
              {savingActual ? 'Saving...' : 'Save actual output'}
            </Button>
          }
        >
          {loading ? (
            <p className="text-sm text-text-secondary">Loading actual output...</p>
          ) : (
            <ActualOutputTableEditor rows={actualRows} setRows={setActualRows} disabled={!isEditable || savingActual} />
          )}
        </SectionCard>
      </PageSurface>
    </PageEnter>
  )
}
