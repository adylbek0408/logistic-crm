import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getClient, getClientOrders, getTemplates, createOrder } from '../api/endpoints'
import { formatDate, STATUS_LABELS, STATUS_COLORS, STATUS_BORDER } from '../utils/format'
import { Button } from '../components/ui/Button'
import { Badge } from '../components/ui/Badge'
import { Modal } from '../components/ui/Modal'
import useAuthStore from '../store/auth'

export function ClientDetail() {
  const { id } = useParams()
  const { user } = useAuthStore()
  const [activeTab, setActiveTab] = useState('new')
  const [showNewOrder, setShowNewOrder] = useState(false)
  const qc = useQueryClient()

  const { data: client } = useQuery({
    queryKey: ['client', id],
    queryFn: () => getClient(id).then((r) => r.data),
  })

  const { data: ordersData } = useQuery({
    queryKey: ['client-orders', id, activeTab],
    queryFn: () => getClientOrders(id, activeTab !== 'new' ? { status: activeTab } : {}).then((r) => r.data),
  })

  const { data: templates } = useQuery({
    queryKey: ['templates'],
    queryFn: () => getTemplates().then((r) => r.data),
    enabled: showNewOrder,
  })

  const createMutation = useMutation({
    mutationFn: (templateId) => createOrder({ client: Number(id), template: templateId }),
    onSuccess: (res) => {
      qc.invalidateQueries(['client-orders', id])
      window.location.href = `/orders/${res.data.id}`
    },
  })

  const orders = ordersData?.results || ordersData || []
  const templateList = templates?.results || templates || []

  const TABS = [
    { key: 'new', label: 'Новые' },
    { key: 'in_progress', label: 'В процессе' },
    { key: 'completed', label: 'Завершённые' },
  ]

  if (!client) return <div className="p-6 text-gray-400">Загрузка...</div>

  return (
    <div className="p-4 md:p-6 space-y-5">
      {/* Header */}
      <div className="bg-white rounded-xl border border-gray-100 p-5">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-xl font-bold text-primary">{client.display_name}</h1>
            {client.brand_name && (
              <div className="text-sm text-gray-500 mt-0.5">{client.brand_name}</div>
            )}
            <div className="flex flex-wrap gap-3 mt-3 text-sm text-gray-600">
              {client.phone && <span>📞 {client.phone}</span>}
              <span className="text-gray-400">Зарегистрирован {formatDate(client.created_at)}</span>
            </div>
            {client.notes && (
              <div className="mt-2 text-sm text-gray-500 bg-gray-50 rounded-lg p-3">{client.notes}</div>
            )}
          </div>
          {user?.role === 'owner' && (
            <Button onClick={() => setShowNewOrder(true)} size="sm">
              + Новый заказ
            </Button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.key
                ? 'border-primary text-primary'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Orders list */}
      <div className="space-y-2">
        {orders.map((order) => (
          <Link
            key={order.id}
            to={`/orders/${order.id}`}
            className={`block bg-white rounded-xl border border-gray-100 p-4 hover:shadow-sm transition-all border-l-2 ${STATUS_BORDER[order.status]}`}
          >
            <div className="flex items-center justify-between">
              <div>
                <span className="font-medium text-primary">Заказ #{order.id}</span>
                <Badge className={`ml-2 ${STATUS_COLORS[order.status]}`}>
                  {STATUS_LABELS[order.status]}
                </Badge>
              </div>
              <div className="text-sm text-gray-400">{formatDate(order.created_at)}</div>
            </div>
            <div className="mt-1 text-sm text-gray-500">
              Строк: {order.done_count}/{order.rows_count} выполнено
            </div>
          </Link>
        ))}
        {orders.length === 0 && (
          <div className="text-center py-10 text-gray-400">Нет заказов в этой вкладке</div>
        )}
      </div>

      {/* New order modal */}
      <Modal open={showNewOrder} onClose={() => setShowNewOrder(false)} title="Выберите шаблон">
        <div className="space-y-3">
          <p className="text-sm text-gray-500">Выберите шаблон для нового заказа</p>
          {templateList.map((t) => (
            <button
              key={t.id}
              onClick={() => createMutation.mutate(t.id)}
              disabled={createMutation.isLoading}
              className="w-full text-left p-4 rounded-xl border border-gray-200 hover:border-primary hover:bg-primary/5 transition-all"
            >
              <div className="font-medium">{t.name}</div>
              <div className="text-sm text-gray-400 mt-0.5">
                {t.total_rows} строк ({t.rows_per_page} стр. × {t.pages} страниц)
              </div>
            </button>
          ))}
          {templateList.length === 0 && (
            <div className="text-center py-6 text-gray-400">
              Нет шаблонов. <Link to="/templates" className="text-primary underline">Создать</Link>
            </div>
          )}
        </div>
      </Modal>
    </div>
  )
}
