import { Sidebar } from './Sidebar'
import { Outlet } from 'react-router-dom'

export function AppLayout() {
  return (
    <div className="flex min-h-screen bg-neutral-50">
      <Sidebar />
      <main className="flex-1 overflow-auto mobile-main-offset md:pb-0">
        <Outlet />
      </main>
    </div>
  )
}
