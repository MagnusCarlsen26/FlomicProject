import { CSS } from '@dnd-kit/utilities'
import { useSortable } from '@dnd-kit/sortable'
import { cn } from '../ui/cn'

export default function DraggableSection({ id, children, className, isFullRow = false, onToggleFullRow }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn('relative rounded-3xl', isDragging && 'z-20 ring-2 ring-primary/45 shadow-glow', className)}
    >
      {onToggleFullRow ? (
        <button
          type="button"
          onClick={() => onToggleFullRow(id)}
          className="absolute right-12 top-3 z-10 inline-flex h-8 w-8 items-center justify-center rounded-full border border-border-strong bg-surface-muted text-text-secondary transition hover:bg-surface hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
          aria-label={isFullRow ? 'Collapse to half row' : 'Expand to full row'}
          title={isFullRow ? 'Half row' : 'Full row'}
        >
          {isFullRow ? (
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" aria-hidden="true">
              <path d="M8 4h8M8 20h8M5 9l3 3-3 3M19 9l-3 3 3 3" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" aria-hidden="true">
              <path d="M8 4H4v4M16 4h4v4M8 20H4v-4M16 20h4v-4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </button>
      ) : null}
      <button
        type="button"
        className="absolute right-3 top-3 z-10 inline-flex h-8 w-8 items-center justify-center rounded-full border border-border-strong bg-surface-muted text-text-secondary transition hover:bg-surface hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70"
        aria-label="Drag section"
        title="Drag to reorder"
        {...attributes}
        {...listeners}
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" aria-hidden="true">
          <path d="M8 6h.01M8 12h.01M8 18h.01M16 6h.01M16 12h.01M16 18h.01" strokeWidth="2.25" strokeLinecap="round" />
        </svg>
      </button>
      {children}
    </div>
  )
}
