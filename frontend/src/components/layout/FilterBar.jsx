import GlassCard from '../ui/GlassCard'
import { cn } from '../ui/cn'

export default function FilterBar({ className, children }) {
  return <GlassCard className={cn('grid gap-3 md:grid-cols-4', className)}>{children}</GlassCard>
}
