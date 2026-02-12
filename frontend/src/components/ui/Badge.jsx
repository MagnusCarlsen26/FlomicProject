import { cn } from './cn'

const TONE_CLASS = {
  info: 'bg-info-soft text-info border-info/40',
  success: 'bg-success-soft text-success border-success/40',
  warning: 'bg-warning-soft text-warning border-warning/40',
  error: 'bg-error-soft text-error border-error/40',
  neutral: 'bg-surface-muted text-text-secondary border-border',
}

export default function Badge({ tone = 'neutral', className, children }) {
  return (
    <span className={cn('inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold', TONE_CLASS[tone], className)}>
      {children}
    </span>
  )
}
