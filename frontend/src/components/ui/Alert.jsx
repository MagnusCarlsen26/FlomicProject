import { cn } from './cn'

const TONE_CLASS = {
  info: 'border-info/40 bg-info-soft text-info',
  success: 'border-success/40 bg-success-soft text-success',
  warning: 'border-warning/40 bg-warning-soft text-warning',
  error: 'border-error/40 bg-error-soft text-error',
}

export default function Alert({ tone = 'info', className, children }) {
  return <div className={cn('rounded-2xl border px-4 py-3 text-sm', TONE_CLASS[tone], className)}>{children}</div>
}
