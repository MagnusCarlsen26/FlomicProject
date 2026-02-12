import { Outlet } from 'react-router-dom'
import TopNav from './TopNav'

export default function AppShell() {
  return (
    <div className="app-shell min-h-screen">
      <TopNav />
      <Outlet />
    </div>
  )
}
