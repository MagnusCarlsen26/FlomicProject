export const CUSTOMER_TYPE_OPTIONS = [
  { value: '', label: 'Select' },
  { value: 'targeted_budgeted', label: 'Targeted (Budgeted)' },
  { value: 'existing', label: 'Existing' },
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
  return CUSTOMER_TYPE_OPTIONS.find((option) => option.value === value)?.label || '-'
}

export function contactTypeLabel(value) {
  return CONTACT_TYPE_OPTIONS.find((option) => option.value === value)?.label || '-'
}

export function visitedLabel(value) {
  return VISITED_OPTIONS.find((option) => option.value === value)?.label || '-'
}
