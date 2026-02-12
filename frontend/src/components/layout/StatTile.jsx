import GlassCard from '../ui/GlassCard'

export default function StatTile({ label, value, detail }) {
  return (
    <GlassCard className="space-y-1">
      <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">{label}</p>
      <p className="text-2xl font-bold text-text-primary">{value}</p>
      {detail ? <p className="text-xs text-text-secondary">{detail}</p> : null}
    </GlassCard>
  )
}
