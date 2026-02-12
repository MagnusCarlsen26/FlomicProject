import { NavLink, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/useAuth'
import { useTheme } from '../../context/useTheme'
import Button from '../ui/Button'
import { cn } from '../ui/cn'

function getNavItems(role) {
  if (role === 'admin') {
    return [
      { to: '/admin/insights', label: 'Insights' },
      { to: '/admin/salesmen-status', label: 'Salesmen Status' },
    ]
  }

  return [{ to: '/salesman', label: 'Workspace' }]
}

export default function TopNav() {
  const { user, signOut } = useAuth()
  const { resolvedTheme, toggleTheme } = useTheme()
  const location = useLocation()
  const hideSalesmanNav = location.pathname === '/salesman'
  const hideInsightsUserInfo = location.pathname === '/admin/insights'
  const navItems = getNavItems(user?.role)

  if (hideSalesmanNav) {
    return (
      <header className="sticky top-0 z-30 border-b border-border/70 bg-bg/80 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center gap-3 px-4 py-3 md:px-6">
          <div className="mr-auto min-w-[180px]">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Flomic</p>
            <p className="text-xs text-text-secondary">{user?.name || user?.email || 'Signed in'}</p>
          </div>

          <div className="order-2 ml-auto flex items-center gap-2 md:order-3">
            <Button variant="secondary" size="sm" onClick={toggleTheme}>
              {resolvedTheme === 'dark' ? 'Light mode' : 'Dark mode'}
            </Button>
            <Button variant="ghost" size="sm" onClick={signOut}>
              Logout
            </Button>
          </div>
        </div>
      </header>
    )
  }

  return (
    <header className="sticky top-0 z-30 border-b border-border/70 bg-bg/80 backdrop-blur-xl">
      <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center gap-3 px-4 py-3 md:px-6">
        <div className="mr-auto min-w-[180px]">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Flomic</p>
          {!hideInsightsUserInfo ? (
            <p className="text-xs text-text-secondary">{user?.name || user?.email || 'Signed in'}</p>
          ) : null}
        </div>

        <nav className="order-3 flex w-full items-center gap-2 overflow-x-auto pb-1 md:order-2 md:w-auto md:pb-0">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                cn(
                  'rounded-xl px-3 py-2 text-sm font-semibold transition whitespace-nowrap',
                  isActive
                    ? 'bg-gradient-brand text-white shadow-glow'
                    : 'border border-border bg-surface text-text-secondary hover:bg-surface-muted',
                )
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="order-2 ml-auto flex items-center gap-2 md:order-3">
          <Button variant="secondary" size="sm" onClick={toggleTheme}>
            {resolvedTheme === 'dark' ? 'Light mode' : 'Dark mode'}
          </Button>
          <Button variant="ghost" size="sm" onClick={signOut}>
            Logout
          </Button>
        </div>
      </div>
    </header>
  )
}
