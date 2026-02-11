class ApiError extends Error {
  constructor(message, status, data) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.data = data
  }
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

  const response = await fetch(path, {
    ...options,
    headers,
    credentials: 'include',
  })

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

export { ApiError }
