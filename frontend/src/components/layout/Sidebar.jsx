import { NavLink, useNavigate } from 'react-router-dom'
import { LayoutDashboard, Users, ClipboardList, LayoutTemplate, LogOut, ChevronRight, UserCog } from 'lucide-react'
import useAuthStore from '../../store/auth'
import { Badge } from '../ui/Badge'

const NAV_ALL = [
  { to: '/',          label: 'Дашборд',    icon: LayoutDashboard, end: true },
  { to: '/clients',   label: 'Клиенты',    icon: Users },
  { to: '/orders',    label: 'Заказы',     icon: ClipboardList },
  { to: '/templates', label: 'Шаблоны',   icon: LayoutTemplate },
  { to: '/users',     label: 'Сотрудники', icon: UserCog, ownerOnly: true },
]

export function Sidebar() {
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()

  const NAV = NAV_ALL.filter((item) => !item.ownerOnly || user?.is_owner)

  const handleLogout = () => { logout(); navigate('/login') }

  const initial = (user?.full_name || user?.username || '?')[0].toUpperCase()

  return (
    <>
      {/* ── Desktop sidebar ── */}
      <aside className="hidden md:flex flex-col w-[272px] min-h-screen shrink-0 bg-primary-900 text-white border-r border-white/10">

        {/* Logo */}
        <div className="px-6 pt-6 pb-5 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center">
              <span className="text-white font-black text-sm">L</span>
            </div>
            <div>
              <div className="font-bold text-base tracking-tight">Logistic CRM</div>
              <div className="text-[11px] text-white/45 tracking-wide">ORDER OPERATIONS</div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `group relative flex items-center gap-3 px-3 h-11 rounded-xl text-sm font-medium transition-all duration-150 ${
                  isActive
                    ? 'bg-white/14 text-white'
                    : 'text-white/65 hover:text-white hover:bg-white/10'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && <span className="absolute left-0 top-2 bottom-2 w-0.5 rounded-full bg-accent" />}
                  <Icon size={18} className={isActive ? 'text-white' : 'text-white/45 group-hover:text-white/75'} />
                  <span className="flex-1">{label}</span>
                  {isActive && <ChevronRight size={14} className="text-white/30" />}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* User */}
        <div className="mx-3 mb-4 rounded-2xl bg-white/8 p-3 border border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white/14 flex items-center justify-center text-white text-sm font-bold shrink-0">
              {initial}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold truncate">{user?.full_name || user?.username}</div>
              <div className="mt-1">
                <Badge
                  size="sm"
                  tone={user?.is_owner ? 'warning' : 'neutral'}
                  className={user?.is_owner ? '' : 'bg-white/20 text-white/75'}
                >
                  {user?.is_owner ? 'Владелец' : 'Сотрудник'}
                </Badge>
              </div>
            </div>
            <button
              onClick={handleLogout}
              title="Выйти"
              className="p-1.5 rounded-lg text-white/35 hover:text-white hover:bg-white/15 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
            >
              <LogOut size={15} />
            </button>
          </div>
        </div>
      </aside>

      {/* ── Mobile bottom bar ── */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur border-t border-neutral-200 z-40 flex safe-bottom" style={{ minHeight: 'calc(64px + env(safe-area-inset-bottom, 0px))' }}>
        {NAV.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `flex-1 flex flex-col items-center justify-center py-2 gap-0.5 font-medium transition-colors min-h-[64px] ${
                isActive ? 'text-primary' : 'text-neutral-400'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <div className={`p-1.5 rounded-xl transition-colors ${isActive ? 'bg-primary/10' : ''}`}>
                  <Icon size={20} strokeWidth={isActive ? 2.4 : 1.9} />
                </div>
                <span className="text-[10px] leading-tight truncate max-w-full px-1">{label}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>
    </>
  )
}
