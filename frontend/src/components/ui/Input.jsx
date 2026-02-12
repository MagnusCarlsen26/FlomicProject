import { cn } from './cn'

export default function Input({ className, ...props }) {
  return (
    <input
      className={cn(
        'w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70',
        className,
      )}
      {...props}
    />
  )
}
