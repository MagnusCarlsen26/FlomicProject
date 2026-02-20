/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: 'rgb(var(--color-bg) / <alpha-value>)',
        'bg-alt': 'rgb(var(--color-bg-alt) / <alpha-value>)',
        'surface-1': 'rgb(var(--color-surface-1) / <alpha-value>)',
        'surface-2': 'rgb(var(--color-surface-2) / <alpha-value>)',
        'surface-3': 'rgb(var(--color-surface-3) / <alpha-value>)',
        'surface-4': 'rgb(var(--color-surface-4) / <alpha-value>)',
        surface: 'rgb(var(--color-surface) / <alpha-value>)',
        'surface-muted': 'rgb(var(--color-surface-muted) / <alpha-value>)',
        'border-subtle': 'rgb(var(--color-border-subtle) / <alpha-value>)',
        'border-default': 'rgb(var(--color-border-default) / <alpha-value>)',
        border: 'rgb(var(--color-border) / <alpha-value>)',
        'border-strong': 'rgb(var(--color-border-strong) / <alpha-value>)',
        'text-tertiary': 'rgb(var(--color-text-tertiary) / <alpha-value>)',
        'text-primary': 'rgb(var(--color-text-primary) / <alpha-value>)',
        'text-secondary': 'rgb(var(--color-text-secondary) / <alpha-value>)',
        'text-muted': 'rgb(var(--color-text-muted) / <alpha-value>)',
        primary: 'rgb(var(--color-primary) / <alpha-value>)',
        secondary: 'rgb(var(--color-secondary) / <alpha-value>)',
        success: 'rgb(var(--color-success) / <alpha-value>)',
        warning: 'rgb(var(--color-warning) / <alpha-value>)',
        error: 'rgb(var(--color-error) / <alpha-value>)',
        info: 'rgb(var(--color-info) / <alpha-value>)',
        'success-soft': 'rgb(var(--color-success) / 0.14)',
        'warning-soft': 'rgb(var(--color-warning) / 0.16)',
        'error-soft': 'rgb(var(--color-error) / 0.14)',
        'info-soft': 'rgb(var(--color-info) / 0.15)',
      },
      boxShadow: {
        glow: '0 12px 30px rgb(var(--color-primary) / 0.35)',
      },
      backgroundImage: {
        'gradient-brand': 'var(--gradient-brand)',
      },
      borderRadius: {
        xl: '0.85rem',
        '2xl': '1.1rem',
        '3xl': '1.5rem',
      },
    },
  },
  plugins: [],
}
