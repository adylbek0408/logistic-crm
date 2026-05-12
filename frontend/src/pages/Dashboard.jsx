import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import {
  Package, PackagePlus, Truck, PackageCheck,
  Filter, ArrowRight, TrendingUp, Banknote, CalendarDays,
} from 'lucide-react'
import { getOrders, getDashboardStats } from '../api/endpoints'
import { formatDate, formatMoney, initials } from '../utils/format'
import { Skeleton } from '../components/ui/Skeleton'
import useAuthStore from '../store/auth'

// ── Order count cards ─────────────────────────────────────────────────────────

const COUNT_CARDS = [
  { key: 'total',       label: 'Всего заказов', icon: Package,      gradient: 'from-[#1E1B4B] to-[#312E81]' },
  { key: 'new',         label: 'Новые',          icon: PackagePlus,  gradient: 'from-blue-500 to-blue-600' },
  { key: 'in_progress', label: 'В процессе',     icon: Truck,        gradient: 'from-amber-400 to-amber-500' },
  { key: 'completed',   label: 'Завершены',      icon: PackageCheck, gradient: 'from-emerald-500 to-emerald-600' },
]

const STATUS_STYLE = {
  new:         { dot: 'bg-blue-400',    bg: 'bg-blue-50',    text: 'text-blue-700',    label: 'Новый' },
  in_progress: { dot: 'bg-amber-400',   bg: 'bg-amber-50',   text: 'text-amber-700',   label: 'В процессе' },
  completed:   { dot: 'bg-emerald-400', bg: 'bg-emerald-50', text: 'text-emerald-700', label: 'Завершён' },
}

function StatusChip({ status }) {
  const s = STATUS_STYLE[status] || STATUS_STYLE.new
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${s.bg} ${s.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  )
}

// ── Monthly bar chart (pure CSS) ──────────────────────────────────────────────

function MonthlyChart({ data }) {
  if (!data?.length) return (
    <div className="flex items-center justify-center h-24 text-sm text-neutral-400">Нет данных</div>
  )
  const reversed = [...data].reverse()
  const maxRev = Math.max(...reversed.map((m) => m.revenue), 1)

  return (
    <div className="flex items-end gap-1.5" style={{ height: '80px' }}>
      {reversed.map((m) => {
        const pct = Math.max(6, Math.round((m.revenue / maxRev) * 100))
        return (
          <div key={m.month} className="flex-1 flex flex-col items-center gap-1 min-w-0">
            <div className="relative w-full rounded-t-md bg-primary/8" style={{ height: '64px' }}>
              <div
                className="absolute bottom-0 w-full rounded-t-md bg-primary transition-all duration-700"
                style={{ height: `${pct}%` }}
              />
            </div>
            <span className="text-[10px] text-neutral-400 truncate w-full text-center uppercase tracking-wide">
              {m.month.split(' ')[0]}
            </span>
          </div>
        )
      })}
    </div>
  )
}

// ── Top clients ───────────────────────────────────────────────────────────────

const GRAD = [
  'from-violet-500 to-purple-600',
  'from-blue-500 to-cyan-600',
  'from-emerald-500 to-teal-600',
  'from-amber-400 to-orange-500',
  'from-rose-500 to-pink-600',
  'from-indigo-500 to-blue-600',
]

function TopClients({ clients, loading }) {
  if (loading) return (
    <div className="space-y-3">
      {[1,2,3].map(i => <Skeleton key={i} className="h-10 rounded-xl" />)}
    </div>
  )
  if (!clients?.length) return (
    <div className="text-sm text-neutral-400 text-center py-6">Нет данных о доходах</div>
  )

  const maxRev = clients[0]?.revenue || 1

  return (
    <div className="space-y-3.5">
      {clients.map((c, i) => {
        const pct = Math.round((c.revenue / maxRev) * 100)
        const label = c.brand || c.name || '?'
        return (
          <Link key={c.id} to={`/clients/${c.id}`} className="group flex items-center gap-3">
            <div className={`w-8 h-8 rounded-xl bg-gradient-to-br ${GRAD[i % GRAD.length]} flex items-center justify-center text-white text-xs font-bold shrink-0 shadow-sm`}>
              {initials(label)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-1 gap-2">
                <span className="text-sm font-semibold text-primary truncate group-hover:text-accent transition-colors">
                  {label}
                </span>
                <span className="text-sm font-black text-emerald-600 tabular shrink-0">
                  {formatMoney(c.revenue)} с
                </span>
              </div>
              <div className="bg-neutral-100 rounded-full h-1.5">
                <div
                  className="h-1.5 rounded-full bg-emerald-400 transition-all duration-500"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          </Link>
        )
      })}
    </div>
  )
}

// ── Main Dashboard ────────────────────────────────────────────────────────────

export function Dashboard() {
  const { user } = useAuthStore()
  const [filters, setFilters] = useState({ status: '', date_from: '', date_to: '' })
  const [showFilters, setShowFilters] = useState(false)

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['stats'],
    queryFn: () => getDashboardStats().then((r) => r.data),
    refetchInterval: 60000,
    staleTime: 30000,
  })

  const { data: ordersData, isLoading: ordersLoading } = useQuery({
    queryKey: ['orders', filters],
    queryFn: () => getOrders(filters).then((r) => r.data),
  })

  const orders = ordersData?.results || ordersData || []
  const activeFilters = Object.values(filters).filter(Boolean).length

  return (
    <div className="page-wrap">

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-mobile-title md:text-2xl font-bold text-primary truncate">
            Добро пожаловать{user?.full_name ? `, ${user.full_name.split(' ')[0]}` : ''} 👋
          </h1>
          <p className="text-mobile-subtitle text-neutral-500 mt-0.5">
            {new Date().toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' })}
          </p>
        </div>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`relative inline-flex items-center justify-center gap-2 min-h-touch px-4 rounded-xl border text-sm font-medium transition-colors w-full md:w-auto ${
            activeFilters ? 'border-primary text-primary bg-primary/5' : 'border-neutral-200 text-neutral-600 hover:border-neutral-300'
          }`}
        >
          <Filter size={15} />
          Фильтры
          {activeFilters > 0 && (
            <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-accent text-white text-[10px] font-bold rounded-full flex items-center justify-center">
              {activeFilters}
            </span>
          )}
        </button>
      </div>

      {/* Order count cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        {COUNT_CARDS.map(({ key, label, icon: Icon, gradient }) => (
          <div key={key} className={`bg-gradient-to-br ${gradient} rounded-2xl p-3.5 md:p-5 text-white shadow-lg shadow-black/10`}>
            <div className="flex items-start justify-between mb-3">
              <div className="bg-white/15 p-2 rounded-xl">
                <Icon size={20} />
              </div>
              <TrendingUp size={14} className="text-white/40 mt-1" />
            </div>
            {statsLoading ? (
              <div className="h-8 bg-white/20 rounded-lg animate-pulse" />
            ) : (
              <div className="text-3xl font-black tabular tracking-tight">{stats?.[key] ?? 0}</div>
            )}
            <div className="text-xs md:text-sm text-white/70 mt-1">{label}</div>
          </div>
        ))}
      </div>

      {/* Revenue summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
        <div className="panel p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-md shadow-emerald-200/60 shrink-0">
            <Banknote size={22} className="text-white" />
          </div>
          <div className="min-w-0">
            <div className="field-label">Общий доход</div>
            {statsLoading ? (
              <div className="h-7 w-36 bg-neutral-100 rounded-lg animate-pulse mt-1" />
            ) : (
              <div className="text-2xl font-black tabular text-primary">
                {formatMoney(stats?.total_revenue ?? 0)}{' '}
                <span className="text-base font-semibold text-neutral-400">сом</span>
              </div>
            )}
          </div>
        </div>

        <div className="panel p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-600 flex items-center justify-center shadow-md shadow-blue-200/60 shrink-0">
            <CalendarDays size={22} className="text-white" />
          </div>
          <div className="min-w-0">
            <div className="field-label">Доход в этом месяце</div>
            {statsLoading ? (
              <div className="h-7 w-36 bg-neutral-100 rounded-lg animate-pulse mt-1" />
            ) : (
              <div className="text-2xl font-black tabular text-primary">
                {formatMoney(stats?.month_revenue ?? 0)}{' '}
                <span className="text-base font-semibold text-neutral-400">сом</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Top clients + Monthly chart */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="panel p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-primary">Топ клиентов по доходу</h2>
            <Link to="/clients" className="text-xs text-neutral-400 hover:text-primary transition-colors">
              Все клиенты →
            </Link>
          </div>
          <TopClients clients={stats?.top_clients} loading={statsLoading} />
        </div>

        <div className="panel p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-primary">Доход по месяцам</h2>
            <span className="text-xs text-neutral-400">Последние 6 мес.</span>
          </div>
          {statsLoading ? (
            <div className="h-20 bg-neutral-100 rounded-xl animate-pulse" />
          ) : (
            <MonthlyChart data={stats?.monthly} />
          )}
          {!statsLoading && (stats?.monthly?.length ?? 0) > 0 && (
            <div className="mt-3 pt-3 border-t border-neutral-100 flex justify-between text-xs text-neutral-400">
              <span>Мин: {formatMoney(Math.min(...(stats?.monthly ?? []).map(m => m.revenue)))} с</span>
              <span>Макс: {formatMoney(Math.max(...(stats?.monthly ?? []).map(m => m.revenue)))} с</span>
            </div>
          )}
        </div>
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="panel p-4 flex flex-wrap gap-3 items-end">
          <div className="w-full sm:w-auto">
            <label className="field-label">Статус</label>
            <select
              value={filters.status}
              onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}
              className="crm-control w-full sm:min-w-[140px]"
            >
              <option value="">Все статусы</option>
              <option value="new">Новый</option>
              <option value="in_progress">В процессе</option>
              <option value="completed">Завершён</option>
            </select>
          </div>
          <div className="w-full sm:w-auto">
            <label className="field-label">С</label>
            <input type="date" value={filters.date_from}
              onChange={(e) => setFilters((f) => ({ ...f, date_from: e.target.value }))}
              className="crm-control w-full" />
          </div>
          <div className="w-full sm:w-auto">
            <label className="field-label">По</label>
            <input type="date" value={filters.date_to}
              onChange={(e) => setFilters((f) => ({ ...f, date_to: e.target.value }))}
              className="crm-control w-full" />
          </div>
          <button
            onClick={() => setFilters({ status: '', date_from: '', date_to: '' })}
            className="min-h-touch px-4 rounded-xl text-sm text-neutral-500 hover:text-danger hover:bg-red-50 transition-colors border border-neutral-200 w-full sm:w-auto"
          >
            Сбросить
          </button>
        </div>
      )}

      {/* Orders table */}
      <div className="panel overflow-hidden">
        <div className="px-5 md:px-6 py-4 border-b border-neutral-100 flex items-center justify-between">
          <div>
            <h2 className="font-bold text-primary">Последние заказы</h2>
            <p className="text-xs text-neutral-400 mt-0.5">{orders.length} записей</p>
          </div>
          <Link to="/orders" className="flex items-center gap-1 text-sm text-primary hover:text-accent font-medium transition-colors">
            Все заказы <ArrowRight size={14} />
          </Link>
        </div>

        {ordersLoading ? (
          <div className="p-4 space-y-3">
            {[1,2,3,4].map(i => (
              <div key={i} className="flex gap-3 items-center">
                <Skeleton className="w-8 h-8 rounded-full" />
                <Skeleton className="h-4 flex-1" />
                <Skeleton className="h-6 w-20 rounded-full" />
                <Skeleton className="h-4 w-16" />
              </div>
            ))}
          </div>
        ) : (
          <>
            {/* Desktop */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-neutral-400 uppercase tracking-wider bg-neutral-50/60">
                    <th className="px-6 py-3 text-left font-medium">#</th>
                    <th className="px-6 py-3 text-left font-medium">Клиент</th>
                    <th className="px-6 py-3 text-left font-medium">Статус</th>
                    <th className="px-6 py-3 text-left font-medium">Оплата</th>
                    <th className="px-6 py-3 text-left font-medium">Прогресс</th>
                    <th className="px-6 py-3 text-left font-medium">Дата</th>
                    <th className="px-6 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-50">
                  {orders.map((order) => {
                    const pct = order.rows_count ? Math.round((order.done_count / order.rows_count) * 100) : 0
                    return (
                      <tr key={order.id} className="hover:bg-neutral-50/60 transition-colors group">
                        <td className="px-6 py-3.5">
                          <span className="font-mono text-xs text-neutral-400 bg-neutral-100 px-2 py-1 rounded-lg">#{order.id}</span>
                        </td>
                        <td className="px-6 py-3.5">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-bold shrink-0">
                              {(order.client_brand || order.client_name || '?')[0].toUpperCase()}
                            </div>
                            <div>
                              <div className="font-medium text-primary">{order.client_brand || order.client_name}</div>
                              {order.client_brand && <div className="text-xs text-neutral-400">{order.client_name}</div>}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-3.5"><StatusChip status={order.status} /></td>
                        <td className="px-6 py-3.5">
                          <span className={`text-sm font-medium ${order.payment_status === 'paid' ? 'text-emerald-600' : 'text-neutral-400'}`}>
                            {order.payment_status === 'paid' ? '✓ Оплачен' : '— Не оплачен'}
                          </span>
                        </td>
                        <td className="px-6 py-3.5 w-36">
                          <div className="flex items-center gap-2">
                            <div className="flex-1 bg-neutral-100 rounded-full h-1.5">
                              <div
                                className={`h-1.5 rounded-full transition-all ${pct === 100 ? 'bg-emerald-500' : 'bg-amber-400'}`}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <span className="text-xs text-neutral-400 tabular w-8">{pct}%</span>
                          </div>
                        </td>
                        <td className="px-6 py-3.5 text-neutral-400 text-sm tabular">{formatDate(order.created_at)}</td>
                        <td className="px-4 py-3.5">
                          <Link
                            to={`/orders/${order.id}`}
                            className="opacity-0 group-hover:opacity-100 transition-opacity px-3 py-1.5 bg-primary text-white rounded-lg text-xs font-medium"
                          >
                            Открыть
                          </Link>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile */}
            <div className="md:hidden divide-y divide-neutral-50">
              {orders.map((order) => (
                <Link key={order.id} to={`/orders/${order.id}`} className="flex items-center gap-3 px-4 py-3.5 hover:bg-neutral-50 transition-colors min-h-touch">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold shrink-0">
                    {(order.client_brand || order.client_name || '?')[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-primary truncate">{order.client_brand || order.client_name}</div>
                    <div className="text-xs text-neutral-400 mt-0.5">{formatDate(order.created_at)}</div>
                  </div>
                  <StatusChip status={order.status} />
                </Link>
              ))}
            </div>

            {orders.length === 0 && (
              <div className="text-center py-16">
                <div className="w-16 h-16 bg-neutral-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <Package size={28} className="text-neutral-400" />
                </div>
                <div className="font-medium text-neutral-500">Нет заказов</div>
              </div>
            )}
          </>
        )}
      </div>

    </div>
  )
}
