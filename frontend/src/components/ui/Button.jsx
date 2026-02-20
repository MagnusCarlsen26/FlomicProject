import { cn } from './cn'

const VARIANT_CLASS = {
  primary: 'bg-primary text-white shadow-glow hover:brightness-110',
  secondary: 'bg-surface-3 text-text-primary border border-border-default hover:bg-surface-4',
  ghost: 'bg-transparent text-text-secondary hover:bg-surface-2 hover:text-text-primary',
  danger: 'bg-error text-white hover:brightness-110',
}

export default function Button({
  className,
  variant = 'primary',
  size = 'md',
  type = 'button',
  disabled,
  children,
  ...props
}) {
  const sizeClass =
    size === 'sm' ? 'px-3 py-2 text-xs' : size === 'lg' ? 'px-5 py-3 text-sm' : 'px-4 py-2.5 text-sm'

  return (
    <button
      type={type}
      className={cn(
        'inline-flex items-center justify-center rounded-xl font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 disabled:cursor-not-allowed disabled:opacity-60',
        VARIANT_CLASS[variant] || VARIANT_CLASS.primary,
        sizeClass,
        className,
      )}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  )
}
