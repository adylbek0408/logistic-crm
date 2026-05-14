import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { getOrders, getOrder, getClients } from '../api/endpoints'
import { formatDate } from '../utils/format'
import { ClipboardList, Filter } from 'lucide-react'
import { SkeletonCard } from '../components/ui/Skeleton'
import { StatusPill } from '../components/ui/StatusPill'
import { FilterBar } from '../components/ui/FilterBar'
import { PageHeader } from '../components/ui/PageHeader'
import { STATUS_META } from '../utils/status'

function OrderCard({ order }) {
  const qc = useQueryClient()
  const pct = order.rows_count ? Math.round((order.done_count / order.rows_count) * 100) : 0
  const s = STATUS_META[order.status] || STATUS_META.new

  const prefetch = () => qc.prefetchQuery({
    queryKey: ['order', String(order.id)],
    queryFn: () => getOrder(order.id).then((r) => r.data),
    staleTime: 60000,
  })

  return (
    <Link
      to={`/orders/${order.id}`}
      onMouseEnter={prefetch}
      onTouchStart={prefetch}
      className="group panel p-4 md:p-5 hover:border-primary/25 transition-all duration-150"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-bold text-sm shrink-0">
            {(order.client_brand || order.client_name || '?')[0].toUpperCase()}
          </div>
          <div className="min-w-0">
            <div className="font-semibold text-primary group-hover:text-primary-500 transition-colors truncate text-sm md:text-base">
              {order.client_brand || order.client_name}
            </div>
            {order.client_brand && (
              <div className="text-xs text-neutral-400 truncate">{order.client_name}</div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <StatusPill status={order.status} />
          <span className="font-mono text-xs text-neutral-500 bg-neutral-100 px-2 py-1 rounded-lg hidden sm:inline-flex">#{order.id}</span>
        </div>
      </div>

      <div className="mt-3 flex items-center gap-2">
        <div className="flex-1 bg-neutral-100 rounded-full h-1.5">
          <div
            className={`h-1.5 rounded-full transition-all ${s.progress}`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className="text-xs text-neutral-400 tabular w-8 text-right">{pct}%</span>
      </div>

      <div className="mt-3 flex items-center justify-between">
        <span className="text-xs text-neutral-400">{formatDate(order.created_at)}</span>
        <div className="flex items-center gap-2">
          {order.status === 'completed' && (
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
              order.payment_status === 'paid'
                ? 'bg-emerald-50 text-emerald-600'
                : 'bg-rose-50 text-rose-500'
            }`}>
              {order.payment_status === 'paid' ? 'Оплачен' : 'Не оплачен'}
            </span>
          )}
          <span className="text-xs text-neutral-500">{order.done_count} из {order.rows_count} строк</span>
        </div>
      </div>
    </Link>
  )
}

const EMPTY_FILTERS = { status: '', payment_status: '', client: '', date_from: '', date_to: '' }

export function Orders() {
  const [filters, setFilters] = useState(EMPTY_FILTERS)
  const [showFilters, setShowFilters] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['orders', filters],
    queryFn: () => getOrders(filters).then((r) => r.data),
    keepPreviousData: true,
  })

  const { data: clientsData } = useQuery({
    queryKey: ['clients', {}],
    queryFn: () => getClients({}).then((r) => r.data),
    staleTime: 60000,
  })
  const clientsList = clientsData?.results || clientsData || []

  const orders = data?.results || data || []
  const activeFilters = Object.values(filters).filter(Boolean).length

  return (
    <div className="page-wrap">
      <PageHeader
        title="Заказы"
        subtitle={`${orders.length} заказов`}
        actions={(
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`relative inline-flex items-center justify-center gap-2 w-full md:w-auto min-h-touch px-4 rounded-xl border text-sm font-medium transition-colors ${
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
        )}
      />

      <FilterBar
        open={showFilters}
        onReset={() => setFilters(EMPTY_FILTERS)}
      >
        <div className="w-full sm:w-auto">
          <label className="field-label">Клиент</label>
          <select
            value={filters.client}
            onChange={(e) => setFilters((f) => ({ ...f, client: e.target.value }))}
            className="crm-control w-full sm:min-w-[200px]"
          >
            <option value="">Все клиенты</option>
            {clientsList.map((c) => (
              <option key={c.id} value={c.id}>{c.display_name}</option>
            ))}
          </select>
        </div>
        <div className="w-full sm:w-auto">
          <label className="field-label">Статус</label>
          <select
            value={filters.status}
            onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}
            className="crm-control w-full sm:min-w-[170px]"
          >
            <option value="">Все статусы</option>
            <option value="new">Новый</option>
            <option value="in_progress">В процессе</option>
            <option value="completed">Завершён</option>
          </select>
        </div>
        <div className="w-full sm:w-auto">
          <label className="field-label">Оплата</label>
          <select
            value={filters.payment_status}
            onChange={(e) => setFilters((f) => ({ ...f, payment_status: e.target.value }))}
            className="crm-control w-full sm:min-w-[160px]"
          >
            <option value="">Все</option>
            <option value="paid">Оплачен</option>
            <option value="unpaid">Не оплачен</option>
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
      </FilterBar>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {[1,2,3,4,5,6].map(i => <SkeletonCard key={i} />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {orders.map((order) => <OrderCard key={order.id} order={order} />)}
          {orders.length === 0 && (
            <div className="col-span-full text-center py-16">
              <div className="w-16 h-16 bg-neutral-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <ClipboardList size={28} className="text-neutral-400" />
              </div>
              <div className="font-medium text-neutral-500">Нет заказов</div>
              <div className="text-sm text-neutral-400 mt-1">Создайте заказ через страницу клиента</div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
