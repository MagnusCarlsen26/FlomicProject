export const CUSTOMER_TYPE_OPTIONS = [
  { value: '', label: 'Select' },
  { value: 'existing', label: 'Existing' },
  { value: 'target_budgeted', label: 'Target (Budgeted)' },
  { value: 'new_customer_non_budgeted', label: 'New Customer (Non Budgeted)' },
]

export const CONTACT_TYPE_OPTIONS = [
  { value: '', label: 'Select' },
  { value: 'nc', label: 'NC' },
  { value: 'fc', label: 'FC' },
  { value: 'sc', label: 'SC' },
  { value: 'jsv', label: 'JSV' },
]

export const VISITED_OPTIONS = [
  { value: '', label: 'Select' },
  { value: 'yes', label: 'Yes' },
  { value: 'no', label: 'No' },
]

export function customerTypeLabel(value) {
  if (value === 'targeted_budgeted') return 'Target (Budgeted)'
  return CUSTOMER_TYPE_OPTIONS.find((option) => option.value === value)?.label || '-'
}

export function contactTypeLabel(value) {
  return CONTACT_TYPE_OPTIONS.find((option) => option.value === value)?.label || '-'
}

export function visitedLabel(value) {
  return VISITED_OPTIONS.find((option) => option.value === value)?.label || '-'
}

export const NOT_VISITED_REASON_CATEGORY_OPTIONS = [
  { value: '', label: 'Select' },
  { value: 'client_unavailable', label: 'Client Unavailable' },
  { value: 'no_response', label: 'No Response' },
  { value: 'internal_engagement', label: 'Internal Engagement' },
  { value: 'travel_logistics_issue', label: 'Travel/Logistics Issue' },
]

export function notVisitedReasonCategoryLabel(value) {
  return NOT_VISITED_REASON_CATEGORY_OPTIONS.find((option) => option.value === value)?.label || value || '-'
}
