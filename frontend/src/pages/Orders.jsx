import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { getOrders } from '../api/endpoints'
import { formatDate, STATUS_LABELS, STATUS_COLORS, STATUS_BORDER } from '../utils/format'
import { Badge } from '../components/ui/Badge'

export function Orders() {
  const [filters, setFilters] = useState({ status: '', date_from: '', date_to: '' })

  const { data, isLoading } = useQuery({
    queryKey: ['orders', filters],
    queryFn: () => getOrders(filters).then((r) => r.data),
    keepPreviousData: true,
  })

  const orders = data?.results || data || []

  return (
    <div className="p-4 md:p-6 space-y-5">
      <h1 className="text-2xl font-bold text-primary">Заказы</h1>

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
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-gray-400">Загрузка...</div>
      ) : (
        <div className="space-y-2">
          {orders.map((order) => (
            <Link
              key={order.id}
              to={`/orders/${order.id}`}
              className={`block bg-white rounded-xl border border-gray-100 p-4 hover:shadow-sm transition-all border-l-2 ${STATUS_BORDER[order.status]}`}
            >
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-3">
                  <span className="font-semibold text-primary">#{order.id}</span>
                  <div>
                    <div className="font-medium">{order.client_brand || order.client_name}</div>
                    {order.client_brand && (
                      <div className="text-xs text-gray-400">{order.client_name}</div>
                    )}
                  </div>
                  <Badge className={STATUS_COLORS[order.status]}>
                    {STATUS_LABELS[order.status]}
                  </Badge>
                </div>
                <div className="text-sm text-gray-400 tabular">{formatDate(order.created_at)}</div>
              </div>
              <div className="mt-1 text-sm text-gray-500">
                Выполнено: {order.done_count} из {order.rows_count} строк
              </div>
            </Link>
          ))}
          {orders.length === 0 && (
            <div className="text-center py-12 text-gray-400">Нет заказов</div>
          )}
        </div>
      )}
    </div>
  )
}
