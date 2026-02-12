import GlassCard from '../ui/GlassCard'

export default function InsightCard({ title, value, subtitle }) {
  return (
    <GlassCard className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">{title}</p>
      <p className="text-2xl font-bold text-text-primary">{value}</p>
      {subtitle ? <p className="text-xs text-text-secondary">{subtitle}</p> : null}
    </GlassCard>
  )
}
