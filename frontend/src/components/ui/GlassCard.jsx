import { cn } from './cn'

export default function GlassCard({ className, children, ...props }) {
  return (
    <section className={cn('glass-card rounded-3xl p-5 md:p-6', className)} {...props}>
      {children}
    </section>
  )
}
