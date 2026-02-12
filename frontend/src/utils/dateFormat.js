function parseDateKey(dateKey) {
  if (!dateKey) {
    return null
  }

  const date = new Date(`${dateKey}T00:00:00.000Z`)
  return Number.isNaN(date.getTime()) ? null : date
}

function getDateOptions(includeWeekday) {
  const options = {
    month: 'short',
    day: 'numeric',
  }

  if (includeWeekday) {
    options.weekday = 'short'
  }

  return options
}

export function formatSheetDate(dateKey, { includeWeekday = true } = {}) {
  const date = parseDateKey(dateKey)
  if (!date) {
    return dateKey || '-'
  }

  return date.toLocaleDateString(undefined, getDateOptions(includeWeekday))
}

export function formatDateTime(value) {
  if (!value) {
    return 'Not updated yet'
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return 'Invalid date'
  }

  return date.toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}
