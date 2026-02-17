import { NavLink } from 'react-router-dom'

function getTabClassName({ isActive }) {
  const baseClass = 'rounded-xl px-3 py-2 text-sm font-semibold transition whitespace-nowrap'
  if (isActive) {
    return `${baseClass} bg-gradient-brand text-white shadow-glow`
  }

  return `${baseClass} border border-border bg-surface text-text-secondary hover:bg-surface-muted`
}

export default function AdminSectionTabs() {
  return (
    <nav className="flex flex-wrap gap-2">
      <NavLink to="/admin/stage1-plan-actual" className={getTabClassName}>
        Stage 1
      </NavLink>
      <NavLink to="/admin/stage2-activity-compliance" className={getTabClassName}>
        Stage 2
      </NavLink>
      <NavLink to="/admin/stage3-planned-not-visited" className={getTabClassName}>
        Stage 3
      </NavLink>
      <NavLink to="/admin/stage4-enquiry-effectiveness" className={getTabClassName}>
        Stage 4
      </NavLink>
      <NavLink to="/admin/insights" className={getTabClassName}>
        Insights
      </NavLink>
      <NavLink to="/admin/salesmen-status" className={getTabClassName}>
        Salesman Status
      </NavLink>
    </nav>
  )
}
