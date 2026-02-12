import { cn } from './cn'

export default function Select({ className, children, ...props }) {
  return (
    <select
      className={cn(
        'w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70',
        className,
      )}
      {...props}
    >
      {children}
    </select>
  )
}
