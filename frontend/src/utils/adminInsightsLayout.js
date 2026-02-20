export const LAYOUT_STORAGE_PREFIX = 'flomic.admin.insights.layout.v1'
export const FULL_ROW_STORAGE_PREFIX = 'flomic.admin.insights.fullrow.v1'

export const DEFAULT_LAYOUT = [
  'visit-performance',
  'compliance-snapshot',
  'daily-trend',
  'stage3-reason-distribution',
  'weekly-monthly-summary',
  'top-achievers-summary',
  'call-type-split',
  'customer-type-split',
  'compliance-by-salesperson',
  'more-insights',
]

export const DEFAULT_FULL_ROW_SECTION_IDS = [
  'daily-trend',
  'visit-performance',
  'more-insights',
]

export function getLayoutStorageKey(userId) {
  return `${LAYOUT_STORAGE_PREFIX}.${userId || 'anonymous'}`
}

export function getFullRowStorageKey(userId) {
  return `${FULL_ROW_STORAGE_PREFIX}.${userId || 'anonymous'}`
}

export function getAnonymousLayoutStorageKey() {
  return getLayoutStorageKey('anonymous')
}

export function getAnonymousFullRowStorageKey() {
  return getFullRowStorageKey('anonymous')
}

export function normalizeLayout(layout, availableIds, fallbackOrder = availableIds) {
  const valid = Array.isArray(layout) ? layout.filter((id) => availableIds.includes(id)) : []
  const seen = new Set()
  const deduped = []

  valid.forEach((id) => {
    if (!seen.has(id)) {
      seen.add(id)
      deduped.push(id)
    }
  })

  fallbackOrder.forEach((id) => {
    if (!seen.has(id) && availableIds.includes(id)) {
      seen.add(id)
      deduped.push(id)
    }
  })

  return deduped
}

export function loadLayout(storageKey, availableIds, fallbackOrder = availableIds) {
  try {
    const raw = localStorage.getItem(storageKey)
    if (!raw) return normalizeLayout(null, availableIds, fallbackOrder)
    return normalizeLayout(JSON.parse(raw), availableIds, fallbackOrder)
  } catch {
    return normalizeLayout(null, availableIds, fallbackOrder)
  }
}

export function saveLayout(storageKey, layout) {
  try {
    localStorage.setItem(storageKey, JSON.stringify(layout))
  } catch {
    // Best-effort persistence only.
  }
}

export function loadFullRowSections(storageKey, availableIds, fallbackSectionIds = []) {
  const normalize = (sectionIds) => {
    if (!Array.isArray(sectionIds)) return []
    return sectionIds.filter((id, index) => availableIds.includes(id) && sectionIds.indexOf(id) === index)
  }

  try {
    const raw = localStorage.getItem(storageKey)
    if (!raw) return normalize(fallbackSectionIds)
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return normalize(fallbackSectionIds)
    return normalize(parsed)
  } catch {
    return normalize(fallbackSectionIds)
  }
}

export function saveFullRowSections(storageKey, sectionIds) {
  try {
    localStorage.setItem(storageKey, JSON.stringify(sectionIds))
  } catch {
    // Best-effort persistence only.
  }
}

export function migrateAnonymousLayoutToUser({
  userStorageKey,
  userFullRowStorageKey,
  availableIds,
  fallbackOrder = availableIds,
}) {
  try {
    const anonymousLayoutStorageKey = getAnonymousLayoutStorageKey()
    const anonymousFullRowStorageKey = getAnonymousFullRowStorageKey()

    if (!localStorage.getItem(userStorageKey)) {
      const anonymousLayoutRaw = localStorage.getItem(anonymousLayoutStorageKey)
      if (anonymousLayoutRaw) {
        try {
          const normalizedLayout = normalizeLayout(JSON.parse(anonymousLayoutRaw), availableIds, fallbackOrder)
          localStorage.setItem(userStorageKey, JSON.stringify(normalizedLayout))
        } catch {
          // Ignore malformed anonymous layout data.
        }
      }
    }

    if (!localStorage.getItem(userFullRowStorageKey)) {
      const anonymousFullRowRaw = localStorage.getItem(anonymousFullRowStorageKey)
      if (anonymousFullRowRaw) {
        try {
          const parsed = JSON.parse(anonymousFullRowRaw)
          if (Array.isArray(parsed)) {
            const normalizedFullRow = parsed.filter(
              (id, index) => availableIds.includes(id) && parsed.indexOf(id) === index,
            )
            localStorage.setItem(userFullRowStorageKey, JSON.stringify(normalizedFullRow))
          }
        } catch {
          // Ignore malformed anonymous full-row data.
        }
      }
    }
  } catch {
    // Best-effort migration only.
  }
}
