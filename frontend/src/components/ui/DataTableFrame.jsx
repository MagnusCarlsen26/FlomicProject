import { cn } from './cn'

export default function DataTableFrame({ className, children }) {
  return (
    <div className={cn('overflow-x-auto rounded-2xl border border-border bg-surface', className)}>
      {children}
    </div>
  )
}
