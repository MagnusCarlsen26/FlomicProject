class ApiError extends Error {
  constructor(message, status, data) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.data = data
  }
}

const DEFAULT_REQUEST_TIMEOUT_MS = 15000
const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').trim()

function buildApiUrl(path) {
  if (/^https?:\/\//i.test(path)) {
    return path
  }

  if (!API_BASE_URL) {
    return path
  }

  const normalizedBaseUrl = API_BASE_URL.replace(/\/+$/, '')
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  return `${normalizedBaseUrl}${normalizedPath}`
}

async function parseResponseBody(response) {
  const contentType = response.headers.get('content-type') || ''

  if (contentType.includes('application/json')) {
    return response.json().catch(() => null)
  }

  return response.text().catch(() => '')
}

export async function apiFetch(path, options = {}) {
  const headers = {
    Accept: 'application/json',
    ...(options.body ? { 'Content-Type': 'application/json' } : {}),
    ...options.headers,
  }

  const timeoutMs =
    Number.isFinite(Number(options.timeoutMs)) && Number(options.timeoutMs) > 0
      ? Number(options.timeoutMs)
      : DEFAULT_REQUEST_TIMEOUT_MS

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  let unsubscribeAbortListener = null

  if (options.signal) {
    if (options.signal.aborted) {
      controller.abort()
    } else {
      const onAbort = () => controller.abort()
      options.signal.addEventListener('abort', onAbort, { once: true })
      unsubscribeAbortListener = () => options.signal.removeEventListener('abort', onAbort)
    }
  }

  let response
  try {
    response = await fetch(buildApiUrl(path), {
      ...options,
      headers,
      credentials: 'include',
      signal: controller.signal,
    })
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new ApiError('Request timed out. Please retry.', 408, null)
    }

    throw new ApiError('Network request failed. Check connection and retry.', 0, null)
  } finally {
    clearTimeout(timeoutId)
    if (unsubscribeAbortListener) {
      unsubscribeAbortListener()
    }
  }

  const data = await parseResponseBody(response)

  if (!response.ok) {
    const message =
      (typeof data === 'object' && data?.message) ||
      (typeof data === 'string' && data) ||
      `Request failed with status ${response.status}`

    throw new ApiError(message, response.status, data)
  }

  return data
}

export async function getCurrentUser() {
  try {
    const data = await apiFetch('/api/auth/me')
    return data?.user ?? data ?? null
  } catch (error) {
    if (error instanceof ApiError && [401, 404].includes(error.status)) {
      return null
    }
    throw error
  }
}

export async function loginWithGoogleToken(idToken) {
  if (!idToken) {
    throw new Error('Google ID token is required')
  }

  const data = await apiFetch('/api/auth/google', {
    method: 'POST',
    body: JSON.stringify({ idToken }),
  })

  return data?.user ?? data ?? null
}

export async function logoutSession() {
  try {
    await apiFetch('/api/auth/logout', { method: 'POST' })
  } catch (error) {
    if (error instanceof ApiError && [401, 404].includes(error.status)) {
      return
    }
    throw error
  }
}

export async function getSalesmanCurrentWeek() {
  return apiFetch('/api/salesman/current-week')
}

export async function updateSalesmanPlanning({ weekKey, rows, submitted = false }) {
  return apiFetch('/api/salesman/planning', {
    method: 'PUT',
    body: JSON.stringify({ weekKey, rows, submitted }),
  })
}

export async function updateSalesmanActualOutput({ weekKey, rows }) {
  return apiFetch('/api/salesman/actual-output', {
    method: 'PUT',
    body: JSON.stringify({ weekKey, rows }),
  })
}

export async function updateSalesmanCurrentStatus({ weekKey, status, note }) {
  return apiFetch('/api/salesman/current-status', {
    method: 'PUT',
    body: JSON.stringify({ weekKey, status, note }),
  })
}

export async function getAdminSalesmenStatus({ week, q } = {}) {
  const params = new URLSearchParams()

  if (week) {
    params.set('week', week)
  }

  if (q) {
    params.set('q', q)
  }

  const suffix = params.toString() ? `?${params.toString()}` : ''
  return apiFetch(`/api/admin/salesmen-status${suffix}`)
}

export async function getAdminSalesmen() {
  return apiFetch('/api/admin/salesmen')
}

export async function getAdminInsights({ from, to, q, salesmen } = {}) {
  const params = new URLSearchParams()

  if (from) {
    params.set('from', from)
  }

  if (to) {
    params.set('to', to)
  }

  if (q) {
    params.set('q', q)
  }

  if (salesmen && salesmen.length > 0) {
    params.set('salesmen', Array.isArray(salesmen) ? salesmen.join(',') : salesmen)
  }

  const suffix = params.toString() ? `?${params.toString()}` : ''
  return apiFetch(`/api/admin/insights${suffix}`)
}

export async function getAdminStage1PlanActual({
  from,
  to,
  week,
  month,
  q,
  salesmen,
  callType,
  customerType,
  mainTeam,
  team,
  subTeam,
} = {}) {
  const params = new URLSearchParams()

  if (from) {
    params.set('from', from)
  }
  if (to) {
    params.set('to', to)
  }
  if (week) {
    params.set('week', week)
  }
  if (month) {
    params.set('month', month)
  }
  if (q) {
    params.set('q', q)
  }
  if (salesmen && salesmen.length > 0) {
    params.set('salesmen', Array.isArray(salesmen) ? salesmen.join(',') : salesmen)
  }
  if (callType) {
    params.set('callType', callType)
  }
  if (customerType) {
    params.set('customerType', customerType)
  }
  if (mainTeam) {
    params.set('mainTeam', mainTeam)
  }
  if (team) {
    params.set('team', team)
  }
  if (subTeam) {
    params.set('subTeam', subTeam)
  }

  const suffix = params.toString() ? `?${params.toString()}` : ''
  return apiFetch(`/api/admin/stage1-plan-actual${suffix}`)
}

export async function getAdminStage2ActivityCompliance({
  week,
  q,
  salesmen,
  mainTeam,
  team,
  subTeam,
} = {}) {
  const params = new URLSearchParams()

  if (week) {
    params.set('week', week)
  }
  if (q) {
    params.set('q', q)
  }
  if (salesmen && salesmen.length > 0) {
    params.set('salesmen', Array.isArray(salesmen) ? salesmen.join(',') : salesmen)
  }
  if (mainTeam) {
    params.set('mainTeam', mainTeam)
  }
  if (team) {
    params.set('team', team)
  }
  if (subTeam) {
    params.set('subTeam', subTeam)
  }

  const suffix = params.toString() ? `?${params.toString()}` : ''
  return apiFetch(`/api/admin/stage2-activity-compliance${suffix}`)
}

export async function getAdminStage4EnquiryEffectiveness({
  from,
  to,
  salesmen,
  team,
  visitType,
  customerType,
  location,
  admin,
  minVisitsForLowEnquiry,
  minEnquiryPerVisit,
  minEnquiriesForLowConversion,
  minShipmentConversion,
} = {}) {
  const params = new URLSearchParams()

  if (from) params.set('from', from)
  if (to) params.set('to', to)
  if (salesmen && salesmen.length > 0) {
    params.set('salesmen', Array.isArray(salesmen) ? salesmen.join(',') : salesmen)
  }
  if (team) params.set('team', team)
  if (visitType) params.set('visitType', visitType)
  if (customerType) params.set('customerType', customerType)
  if (location) params.set('location', location)
  if (admin) params.set('admin', admin)
  if (minVisitsForLowEnquiry !== undefined) params.set('minVisitsForLowEnquiry', String(minVisitsForLowEnquiry))
  if (minEnquiryPerVisit !== undefined) params.set('minEnquiryPerVisit', String(minEnquiryPerVisit))
  if (minEnquiriesForLowConversion !== undefined) params.set('minEnquiriesForLowConversion', String(minEnquiriesForLowConversion))
  if (minShipmentConversion !== undefined) params.set('minShipmentConversion', String(minShipmentConversion))

  const suffix = params.toString() ? `?${params.toString()}` : ''
  return apiFetch(`/api/admin/stage4-enquiry-effectiveness${suffix}`)
}

export async function getAdminStage3PlannedNotVisited({
  from,
  to,
  week,
  month,
  q,
  salesmen,
  reasonCategory,
  customer,
  mainTeam,
  team,
  subTeam,
} = {}) {
  const params = new URLSearchParams()

  if (from) params.set('from', from)
  if (to) params.set('to', to)
  if (week) params.set('week', week)
  if (month) params.set('month', month)
  if (q) params.set('q', q)
  if (salesmen && salesmen.length > 0) {
    params.set('salesmen', Array.isArray(salesmen) ? salesmen.join(',') : salesmen)
  }
  if (reasonCategory) params.set('reasonCategory', reasonCategory)
  if (customer) params.set('customer', customer)
  if (mainTeam) params.set('mainTeam', mainTeam)
  if (team) params.set('team', team)
  if (subTeam) params.set('subTeam', subTeam)

  const suffix = params.toString() ? `?${params.toString()}` : ''
  return apiFetch(`/api/admin/stage3-planned-not-visited${suffix}`)
}

export { ApiError }
