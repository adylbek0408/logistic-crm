import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { getOrders, getDashboardStats } from '../api/endpoints'
import { formatDate, STATUS_LABELS, STATUS_COLORS, PAYMENT_LABELS } from '../utils/format'
import { Badge } from '../components/ui/Badge'
import { useState } from 'react'

const STAT_CARDS = [
  { key: 'total', label: 'Всего заказов', color: 'bg-primary text-white' },
  { key: 'new', label: 'Новые', color: 'bg-blue-50 text-blue-700' },
  { key: 'in_progress', label: 'В процессе', color: 'bg-amber-50 text-amber-700' },
  { key: 'completed', label: 'Завершены', color: 'bg-emerald-50 text-emerald-700' },
]

export function Dashboard() {
  const [filters, setFilters] = useState({ status: '', date_from: '', date_to: '' })

  const { data: stats } = useQuery({
    queryKey: ['stats'],
    queryFn: () => getDashboardStats().then((r) => r.data),
    refetchInterval: 30000,
  })

  const { data: ordersData } = useQuery({
    queryKey: ['orders', filters],
    queryFn: () => getOrders(filters).then((r) => r.data),
  })

  const orders = ordersData?.results || ordersData || []

  return (
    <div className="p-4 md:p-6 space-y-6">
      <h1 className="text-2xl font-bold text-primary">Дашборд</h1>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {STAT_CARDS.map((card) => (
          <div key={card.key} className={`rounded-xl p-4 ${card.color}`}>
            <div className="text-3xl font-bold tabular">{stats?.[card.key] ?? '—'}</div>
            <div className="text-sm mt-1 opacity-75">{card.label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-100 p-4 flex flex-wrap gap-3">
        <select
          value={filters.status}
          onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}
          className="px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-primary"
        >
          <option value="">Все статусы</option>
          <option value="new">Новый</option>
          <option value="in_progress">В процессе</option>
          <option value="completed">Завершён</option>
        </select>
        <input
          type="date"
          value={filters.date_from}
          onChange={(e) => setFilters((f) => ({ ...f, date_from: e.target.value }))}
          className="px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-primary"
        />
        <input
          type="date"
          value={filters.date_to}
          onChange={(e) => setFilters((f) => ({ ...f, date_to: e.target.value }))}
          className="px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-primary"
        />
        <button
          onClick={() => setFilters({ status: '', date_from: '', date_to: '' })}
          className="text-sm text-gray-500 hover:text-danger transition-colors"
        >
          Сбросить
        </button>
      </div>

      {/* Orders table */}
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-50">
          <h2 className="font-semibold text-primary">Последние заказы</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-500 text-xs uppercase tracking-wider">
                <th className="px-6 py-3 text-left font-medium">#</th>
                <th className="px-6 py-3 text-left font-medium">Клиент</th>
                <th className="px-6 py-3 text-left font-medium">Статус</th>
                <th className="px-6 py-3 text-left font-medium">Оплата</th>
                <th className="px-6 py-3 text-left font-medium">Дата</th>
                <th className="px-6 py-3 text-left font-medium">Строки</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {orders.map((order) => (
                <tr
                  key={order.id}
                  className={`hover:bg-surface transition-colors border-l-2 ${
                    order.status === 'new' ? 'border-l-blue-400' :
                    order.status === 'in_progress' ? 'border-l-amber-400' :
                    'border-l-emerald-400'
                  }`}
                >
                  <td className="px-6 py-3">
                    <Link to={`/orders/${order.id}`} className="font-medium text-primary hover:underline">
                      #{order.id}
                    </Link>
                  </td>
                  <td className="px-6 py-3">
                    <div className="font-medium">{order.client_brand || order.client_name}</div>
                    {order.client_brand && (
                      <div className="text-xs text-gray-400">{order.client_name}</div>
                    )}
                  </td>
                  <td className="px-6 py-3">
                    <Badge className={STATUS_COLORS[order.status]}>
                      {STATUS_LABELS[order.status]}
                    </Badge>
                  </td>
                  <td className="px-6 py-3">
                    <span className={order.payment_status === 'paid' ? 'text-success' : 'text-gray-400'}>
                      {PAYMENT_LABELS[order.payment_status]}
                    </span>
                  </td>
                  <td className="px-6 py-3 text-gray-500 tabular">{formatDate(order.created_at)}</td>
                  <td className="px-6 py-3 text-gray-500 tabular">
                    {order.done_count}/{order.rows_count}
                  </td>
                </tr>
              ))}
              {orders.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-400">
                    Нет заказов
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
