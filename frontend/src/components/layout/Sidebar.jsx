import { NavLink, useNavigate } from 'react-router-dom'
import useAuthStore from '../../store/auth'

const NAV = [
  { to: '/', label: 'Дашборд', icon: '▦' },
  { to: '/clients', label: 'Клиенты', icon: '👤' },
  { to: '/orders', label: 'Заказы', icon: '📋' },
  { to: '/templates', label: 'Шаблоны', icon: '⊞' },
]

export function Sidebar() {
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex flex-col w-60 min-h-screen bg-primary text-white shrink-0">
        <div className="px-6 py-5 border-b border-white/10">
          <div className="text-lg font-bold tracking-tight">Logistic CRM</div>
          <div className="text-xs text-white/50 mt-0.5">Управление заказами</div>
        </div>
        <nav className="flex-1 py-4 px-3 space-y-0.5">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                  isActive ? 'bg-white/15 font-medium' : 'hover:bg-white/8 text-white/75'
                }`
              }
            >
              <span className="text-base w-5 text-center">{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="px-4 py-4 border-t border-white/10">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center text-xs font-bold text-white">
              {user?.full_name?.[0] || user?.username?.[0] || '?'}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate">{user?.full_name || user?.username}</div>
              <div className="text-xs text-white/50">
                {user?.role === 'owner' ? 'Владелец' : 'Сотрудник'}
              </div>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full text-left text-xs text-white/50 hover:text-white transition-colors px-1"
          >
            Выйти →
          </button>
        </div>
      </aside>

      {/* Mobile bottom bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-40 flex">
        {NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) =>
              `flex-1 flex flex-col items-center justify-center py-2 text-xs transition-colors ${
                isActive ? 'text-primary font-medium' : 'text-gray-500'
              }`
            }
          >
            <span className="text-lg mb-0.5">{item.icon}</span>
            {item.label}
          </NavLink>
        ))}
      </nav>
    </>
  )
}
