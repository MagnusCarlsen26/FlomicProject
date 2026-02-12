import { ApiError } from '../services/api'
import { formatDateTime as formatDateTimeLabel, formatSheetDate as formatSheetDateLabel } from '../utils/dateFormat'

export const POLL_INTERVAL_MS = 30000

export function getErrorMessage(error) {
  if (error instanceof ApiError) {
    return error.message
  }

  if (error instanceof Error) {
    return error.message
  }

  return 'Request failed'
}

export const formatDateTime = formatDateTimeLabel

export function formatPercent(value) {
  return `${((value || 0) * 100).toFixed(1)}%`
}

export const formatSheetDate = formatSheetDateLabel

function getIsoWeekString(date) {
  const target = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = target.getUTCDay() || 7
  target.setUTCDate(target.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1))
  const weekNo = Math.ceil(((target - yearStart) / 86400000 + 1) / 7)
  return `${target.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`
}

function addWeeksToIsoWeek(isoWeek, diff) {
  const match = /^([0-9]{4})-W([0-9]{2})$/.exec(isoWeek)
  if (!match) {
    return isoWeek
  }

  const year = Number(match[1])
  const week = Number(match[2])
  const jan4 = new Date(Date.UTC(year, 0, 4))
  const jan4Day = jan4.getUTCDay() || 7
  const week1Monday = new Date(jan4)
  week1Monday.setUTCDate(jan4.getUTCDate() + 1 - jan4Day)

  const target = new Date(week1Monday)
  target.setUTCDate(week1Monday.getUTCDate() + (week - 1 + diff) * 7)
  return getIsoWeekString(target)
}

export function getDefaultRangeWeeks() {
  const toWeek = getIsoWeekString(new Date())
  const fromWeek = addWeeksToIsoWeek(toWeek, -11)
  return { fromWeek, toWeek }
}
