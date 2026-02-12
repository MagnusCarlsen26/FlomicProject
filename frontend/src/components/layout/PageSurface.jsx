import { cn } from '../ui/cn'

export default function PageSurface({ className, children }) {
  return <div className={cn('mx-auto w-full max-w-7xl space-y-6 px-4 pb-8 pt-5 md:px-6 md:pt-8', className)}>{children}</div>
}
