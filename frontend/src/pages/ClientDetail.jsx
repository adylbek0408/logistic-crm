import { useState, useMemo } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getClient, getClientOrders, getTemplates, createOrder } from '../api/endpoints'
import { formatDate } from '../utils/format'
import { Button } from '../components/ui/Button'
import { Modal } from '../components/ui/Modal'
import { SkeletonCard } from '../components/ui/Skeleton'
import { StatusPill } from '../components/ui/StatusPill'
import { STATUS_META } from '../utils/status'
import useAuthStore from '../store/auth'
import {
  ArrowLeft, Phone, ShoppingBag, CalendarDays, FileText,
  PackagePlus, ArrowRight, LayoutTemplate, Loader2,
} from 'lucide-react'
import { initials } from '../utils/format'

const AVATAR_COLORS = [
  'from-primary to-primary-500',
  'from-slate-700 to-slate-600',
  'from-blue-700 to-blue-600',
]

const TABS = [
  { key: '',            label: 'Все' },
  { key: 'new',         label: 'Новые' },
  { key: 'in_progress', label: 'В процессе' },
  { key: 'completed',   label: 'Завершённые' },
]

export function ClientDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const [activeTab, setActiveTab] = useState('')
  const [showNewOrder, setShowNewOrder] = useState(false)
  const qc = useQueryClient()

  const { data: client, isLoading: clientLoading } = useQuery({
    queryKey: ['client', id],
    queryFn: () => getClient(id).then((r) => r.data),
  })

  // Single fetch — filter client-side so tabs are instant and badges show correct counts
  const { data: ordersData, isLoading: ordersLoading } = useQuery({
    queryKey: ['client-orders', id],
    queryFn: () => getClientOrders(id, {}).then((r) => r.data),
  })

  const allOrders = ordersData?.results || ordersData || []

  const counts = useMemo(() => ({
    '':            allOrders.length,
    new:           allOrders.filter((o) => o.status === 'new').length,
    in_progress:   allOrders.filter((o) => o.status === 'in_progress').length,
    completed:     allOrders.filter((o) => o.status === 'completed').length,
  }), [allOrders])

  const { data: templates } = useQuery({
    queryKey: ['templates'],
    queryFn: () => getTemplates().then((r) => r.data),
    enabled: showNewOrder,
  })

  const createMutation = useMutation({
    mutationFn: (templateId) => createOrder({ client: Number(id), template: templateId }),
    onSuccess: (res) => {
      qc.invalidateQueries(['client-orders', id])
      navigate(`/orders/${res.data.id}`)
    },
  })

  const orders = activeTab ? allOrders.filter((o) => o.status === activeTab) : allOrders
  const templateList = templates?.results || templates || []
  const grad = AVATAR_COLORS[(Number(id) || 0) % AVATAR_COLORS.length]

  if (clientLoading) return (
    <div className="page-wrap max-w-3xl space-y-4">
      <div className="h-32 bg-gray-100 rounded-2xl animate-pulse" />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {[1,2,3].map(i => <SkeletonCard key={i} />)}
      </div>
    </div>
  )

  if (!client) return null

  return (
    <div className="page-wrap max-w-3xl space-y-5">
      {/* Back */}
      <button
        onClick={() => navigate(-1)}
        className="mobile-tap inline-flex items-center gap-1.5 text-sm text-neutral-500 hover:text-primary transition-colors"
      >
        <ArrowLeft size={16} /> Назад
      </button>

      {/* Client card */}
      <div className="panel p-5">
        <div className="flex flex-col sm:flex-row items-start gap-4">
          <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${grad} flex items-center justify-center text-white font-black text-2xl shadow-lg shrink-0`}>
            {initials(client.display_name)}
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold text-primary truncate">{client.display_name}</h1>
            {client.brand_name && (
              <div className="flex items-center gap-1 text-sm text-neutral-500 mt-0.5">
                <ShoppingBag size={13} />
                {client.brand_name}
              </div>
            )}
            <div className="flex flex-wrap gap-4 mt-3">
              {client.phone && (
                <div className="flex items-center gap-1.5 text-sm text-neutral-600">
                  <Phone size={14} className="text-neutral-400" />
                  {client.phone}
                </div>
              )}
              <div className="flex items-center gap-1.5 text-sm text-neutral-400">
                <CalendarDays size={14} />
                С {formatDate(client.created_at)}
              </div>
              <div className="flex items-center gap-1.5 text-sm text-neutral-600">
                <FileText size={14} className="text-neutral-400" />
                {client.orders_count ?? orders.length} заказов
              </div>
            </div>
            {client.notes && (
              <div className="mt-3 text-sm text-neutral-500 bg-neutral-50 rounded-xl p-3 leading-relaxed">
                {client.notes}
              </div>
            )}
          </div>
          {user?.is_owner && (
            <Button onClick={() => setShowNewOrder(true)} className="shrink-0 w-full sm:w-auto">
              <PackagePlus size={16} />
              <span>Новый заказ</span>
            </Button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-neutral-100 rounded-2xl p-1 overflow-x-auto scrollbar-hide">
        {TABS.map((tab) => {
          const count = counts[tab.key]
          const active = activeTab === tab.key
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 min-w-[102px] min-h-touch flex items-center justify-center gap-1.5 py-2 px-2 rounded-xl text-sm font-medium transition-all ${
                active ? 'bg-white text-primary shadow-sm' : 'text-neutral-500 hover:text-neutral-700'
              }`}
            >
              <span>{tab.label}</span>
              {count > 0 && (
                <span className={`text-xs rounded-full px-1.5 py-0.5 leading-none tabular ${
                  active ? 'bg-primary/10 text-primary' : 'bg-neutral-200 text-neutral-500'
                }`}>
                  {count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Orders */}
      {ordersLoading ? (
        <div className="space-y-3">
          {[1,2,3].map(i => <SkeletonCard key={i} />)}
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map((order) => {
            const pct = order.rows_count ? Math.round((order.done_count / order.rows_count) * 100) : 0
            const s = STATUS_META[order.status] || STATUS_META.new
            return (
              <Link
                key={order.id}
                to={`/orders/${order.id}`}
                className="group block panel p-4 hover:border-primary/25 transition-all"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs text-neutral-500 bg-neutral-100 px-2 py-1 rounded-lg">#{order.id}</span>
                    <StatusPill status={order.status} />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-neutral-400">{formatDate(order.created_at)}</span>
                    <ArrowRight size={14} className="text-neutral-300 group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                  </div>
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <div className="flex-1 bg-neutral-100 rounded-full h-1.5">
                    <div
                      className={`h-1.5 rounded-full transition-all ${s.progress}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="text-xs text-neutral-400 tabular">{order.done_count}/{order.rows_count}</span>
                </div>
              </Link>
            )
          })}
          {orders.length === 0 && (
            <div className="text-center py-12">
              <div className="w-14 h-14 bg-neutral-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
                <FileText size={24} className="text-neutral-400" />
              </div>
              <div className="font-medium text-neutral-500">Нет заказов</div>
              {user?.is_owner && (
                <button
                  onClick={() => setShowNewOrder(true)}
                  className="mt-3 text-sm text-primary underline"
                >
                  Создать первый заказ
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* New order modal */}
      <Modal open={showNewOrder} onClose={() => setShowNewOrder(false)} title="Выберите шаблон">
        <div className="space-y-3">
          <p className="text-sm text-neutral-500">Выберите шаблон для нового заказа</p>
          {createMutation.isLoading && (
            <div className="flex items-center justify-center py-6">
              <Loader2 size={24} className="animate-spin text-primary" />
            </div>
          )}
          {!createMutation.isLoading && templateList.map((t) => (
            <button
              key={t.id}
              onClick={() => createMutation.mutate(t.id)}
              className="w-full text-left p-4 rounded-2xl border border-neutral-200 hover:border-primary hover:bg-primary/5 transition-all group"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-primary/8 flex items-center justify-center shrink-0">
                  <LayoutTemplate size={16} className="text-primary" />
                </div>
                <div>
                  <div className="font-semibold text-primary group-hover:text-primary-500 transition-colors">{t.name}</div>
                  <div className="text-xs text-neutral-400 mt-0.5">
                    {t.total_rows} строк · {t.rows_per_page} стр. × {t.pages} страниц
                  </div>
                </div>
              </div>
            </button>
          ))}
          {!createMutation.isLoading && templateList.length === 0 && (
            <div className="text-center py-8">
              <div className="w-12 h-12 bg-neutral-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
                <LayoutTemplate size={20} className="text-neutral-400" />
              </div>
              <div className="text-sm text-neutral-500">Нет шаблонов</div>
              <Link to="/templates" className="text-sm text-primary underline mt-1 block">
                Создать шаблон
              </Link>
            </div>
          )}
        </div>
      </Modal>
    </div>
  )
}
