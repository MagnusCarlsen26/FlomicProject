import GlassCard from '../ui/GlassCard'

const VARIANT_CLASS = {
  default: 'border-border-default',
  success: 'border-success/45',
  warning: 'border-warning/45',
  danger: 'border-error/45',
  info: 'border-info/45',
}

const LABEL_CLASS = {
  default: 'text-text-tertiary',
  success: 'text-success',
  warning: 'text-warning',
  danger: 'text-error',
  info: 'text-info',
}

export default function InsightCard({ title, value, subtitle, variant = 'default' }) {
  return (
    <GlassCard className={`space-y-2 border ${VARIANT_CLASS[variant] || VARIANT_CLASS.default}`}>
      <p className={`text-xs font-semibold uppercase tracking-wide ${LABEL_CLASS[variant] || LABEL_CLASS.default}`}>{title}</p>
      <p className="text-2xl font-bold text-text-primary">{value}</p>
      {subtitle ? <p className="text-xs text-text-secondary">{subtitle}</p> : null}
    </GlassCard>
  )
}
