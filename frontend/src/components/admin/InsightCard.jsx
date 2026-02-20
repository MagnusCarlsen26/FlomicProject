import GlassCard from '../ui/GlassCard'

const VARIANT_CLASS = {
  default: 'border-border-default',
  success: 'border-success/65',
  warning: 'border-warning/65',
  danger: 'border-error/65',
  info: 'border-info/65',
}

const SURFACE_STYLE = {
  default: {
    background: 'color-mix(in srgb, rgb(var(--color-surface-1)) 92%, transparent)',
  },
  success: {
    background:
      'linear-gradient(135deg, rgb(var(--color-success) / 0.26) 0%, rgb(var(--color-surface-1) / 0.9) 72%)',
  },
  warning: {
    background:
      'linear-gradient(135deg, rgb(var(--color-warning) / 0.24) 0%, rgb(var(--color-surface-1) / 0.9) 72%)',
  },
  danger: {
    background:
      'linear-gradient(135deg, rgb(var(--color-error) / 0.24) 0%, rgb(var(--color-surface-1) / 0.9) 72%)',
  },
  info: {
    background:
      'linear-gradient(135deg, rgb(var(--color-info) / 0.24) 0%, rgb(var(--color-surface-1) / 0.9) 72%)',
  },
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
    <GlassCard
      className={`space-y-2 border ${VARIANT_CLASS[variant] || VARIANT_CLASS.default}`}
      style={SURFACE_STYLE[variant] || SURFACE_STYLE.default}
    >
      <p className={`text-xs font-semibold uppercase tracking-wide ${LABEL_CLASS[variant] || LABEL_CLASS.default}`}>{title}</p>
      <p className="text-2xl font-bold text-text-primary">{value}</p>
      {subtitle ? <p className="text-xs text-text-secondary">{subtitle}</p> : null}
    </GlassCard>
  )
}
