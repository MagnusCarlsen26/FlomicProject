import { NavLink } from 'react-router-dom'

function getTabClassName({ isActive }) {
  const baseClass = 'rounded-lg px-3 py-2 text-sm font-medium transition'
  if (isActive) {
    return `${baseClass} bg-slate-900 text-white`
  }

  return `${baseClass} border border-slate-300 bg-white text-slate-800 hover:bg-slate-100`
}

export default function AdminSectionTabs() {
  return (
    <nav className="flex flex-wrap gap-2">
      <NavLink to="/admin/insights" className={getTabClassName}>
        Insights
      </NavLink>
      <NavLink to="/admin/salesmen-status" className={getTabClassName}>
        Salesman Status
      </NavLink>
    </nav>
  )
}
