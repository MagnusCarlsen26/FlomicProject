import { useEffect, useRef, useState } from 'react'
import { cn } from './cn'

export default function MultiSelect({
  options = [],
  selected = [],
  onChange,
  placeholder = 'Select options',
  className,
}) {
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef(null)

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const toggleOption = (optionId) => {
    const newSelected = selected.includes(optionId)
      ? selected.filter((id) => id !== optionId)
      : [...selected, optionId]
    onChange(newSelected)
  }

  const selectedLabels = options
    .filter((opt) => selected.includes(opt.id))
    .map((opt) => opt.name)

  return (
    <div className={cn('relative w-full', className)} ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex min-h-[42px] w-full items-center justify-between rounded-xl border border-border bg-surface px-3 py-2 text-sm text-text-primary transition-colors hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
      >
        <span className={cn('block truncate text-left', selectedLabels.length === 0 && 'text-text-muted')}>
          {selectedLabels.length > 0 ? selectedLabels.join(', ') : placeholder}
        </span>
        <svg
          className={cn('ml-2 h-4 w-4 transition-transform', isOpen && 'rotate-180')}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-xl border border-border bg-surface p-1 shadow-lg">
          {options.length === 0 ? (
            <div className="px-3 py-2 text-center text-sm text-text-muted">No options available</div>
          ) : (
            options.map((option) => (
              <label
                key={option.id}
                className="flex cursor-pointer items-center rounded-lg px-2 py-1.5 transition-colors hover:bg-surface-muted"
              >
                <input
                  type="checkbox"
                  className="mr-3 h-4 w-4 rounded border-border bg-surface text-primary focus:ring-primary/70"
                  checked={selected.includes(option.id)}
                  onChange={() => toggleOption(option.id)}
                />
                <span className="text-sm text-text-primary">{option.name}</span>
              </label>
            ))
          )}
        </div>
      )}
    </div>
  )
}
