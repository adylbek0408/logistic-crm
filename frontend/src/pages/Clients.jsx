import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Search, UserPlus, Phone, ShoppingBag, ArrowRight, Users, SlidersHorizontal, X } from 'lucide-react'
import { getClients, createClient } from '../api/endpoints'
import { formatDate, initials } from '../utils/format'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Modal } from '../components/ui/Modal'
import { SkeletonCard } from '../components/ui/Skeleton'
import { PageHeader } from '../components/ui/PageHeader'
import useAuthStore from '../store/auth'

const STATUS_TABS = [
  { key: '',            label: 'Все' },
  { key: 'new',         label: 'Новые' },
  { key: 'in_progress', label: 'В процессе' },
  { key: 'completed',   label: 'Завершённые' },
]

const AVATAR_COLORS = [
  'from-primary to-primary-500',
  'from-slate-700 to-slate-600',
  'from-blue-700 to-blue-600',
]

function ClientCard({ client, index }) {
  const grad = AVATAR_COLORS[index % AVATAR_COLORS.length]
  return (
    <Link
      to={`/clients/${client.id}`}
      className="group panel p-4 md:p-5 hover:border-primary/25 transition-all duration-150"
    >
      <div className="flex items-start gap-4">
        <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${grad} flex items-center justify-center text-white font-bold text-lg shrink-0`}>
          {initials(client.display_name)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-primary group-hover:text-primary-500 transition-colors truncate">
            {client.display_name}
          </div>
          {client.brand_name && (
            <div className="flex items-center gap-1 text-xs text-neutral-500 mt-0.5 truncate">
              <ShoppingBag size={11} />
              {client.brand_name}
            </div>
          )}
          {client.phone && (
            <div className="flex items-center gap-1 text-xs text-neutral-400 mt-1">
              <Phone size={11} />
              {client.phone}
            </div>
          )}
        </div>
        <div className="text-right shrink-0">
          <div className="text-xl font-black text-primary tabular">{client.orders_count}</div>
          <div className="text-xs text-neutral-400">заказов</div>
        </div>
      </div>
      <div className="mt-3 pt-3 border-t border-neutral-100 flex items-center justify-between">
        <span className="text-xs text-neutral-400">С {formatDate(client.created_at)}</span>
        <ArrowRight size={14} className="text-neutral-300 group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
      </div>
    </Link>
  )
}

function AddClientForm({ onClose }) {
  const [form, setForm] = useState({ first_name: '', last_name: '', phone: '', brand_name: '', notes: '' })
  const [errors, setErrors] = useState({})
  const qc = useQueryClient()

  const mutation = useMutation({
    mutationFn: createClient,
    onSuccess: () => { qc.invalidateQueries(['clients']); onClose() },
    onError: (err) => setErrors(err.response?.data || {}),
  })

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))

  return (
    <form onSubmit={(e) => { e.preventDefault(); mutation.mutate(form) }} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Input label="Имя *" value={form.first_name} onChange={set('first_name')} error={errors.first_name?.[0]} required placeholder="Айгуль" />
        <Input label="Фамилия" value={form.last_name} onChange={set('last_name')} placeholder="Иванова" />
      </div>
      <Input label="Телефон" value={form.phone} onChange={set('phone')} type="tel" placeholder="+996 700 000 000" />
      <Input label="Бренд / Магазин" value={form.brand_name} onChange={set('brand_name')} placeholder="Магазин Айгуль" />
      <div>
        <label className="text-sm font-medium text-neutral-700">Заметки</label>
        <textarea value={form.notes} onChange={set('notes')} rows={3}
          className="mt-1 w-full px-3 py-2 rounded-xl border border-neutral-200 text-sm outline-none hover:border-neutral-300 focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20 resize-none" />
      </div>
      <div className="flex flex-col-reverse sm:flex-row gap-3 justify-end pt-2">
        <Button type="button" variant="secondary" onClick={onClose}>Отмена</Button>
        <Button type="submit" disabled={mutation.isLoading}>
          {mutation.isLoading ? 'Сохранение...' : 'Добавить клиента'}
        </Button>
      </div>
    </form>
  )
}

export function Clients() {
  const [search, setSearch] = useState('')
  const [orderStatus, setOrderStatus] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [showFilter, setShowFilter] = useState(false)
  const [showAdd, setShowAdd] = useState(false)
  const { user } = useAuthStore()

  const params = {
    ...(search && { search }),
    ...(orderStatus && { order_status: orderStatus }),
    ...(dateFrom && { date_from: dateFrom }),
    ...(dateTo && { date_to: dateTo }),
  }

  const { data, isLoading } = useQuery({
    queryKey: ['clients', params],
    queryFn: () => getClients(params).then((r) => r.data),
    keepPreviousData: true,
  })

  const clients = data?.results || data || []
  const hasFilters = orderStatus || dateFrom || dateTo

  function resetFilters() {
    setOrderStatus('')
    setDateFrom('')
    setDateTo('')
    setShowFilter(false)
  }

  return (
    <div className="page-wrap">
      <PageHeader
        title="Клиенты"
        subtitle={`${clients.length} клиентов`}
        actions={
          <div className="flex items-center gap-2 w-full md:w-auto">
            <button
              onClick={() => setShowFilter((v) => !v)}
              className={`inline-flex items-center justify-center gap-1.5 px-3 min-h-touch rounded-xl text-sm font-medium border transition-all w-full md:w-auto ${
                showFilter || hasFilters
                  ? 'bg-primary text-white border-primary'
                  : 'bg-white text-neutral-600 border-neutral-200 hover:border-neutral-300'
              }`}
            >
              <SlidersHorizontal size={14} />
              Фильтры
              {hasFilters && (
                <span className="bg-white/25 text-white text-xs px-1.5 rounded-full leading-none py-0.5">!</span>
              )}
            </button>
            {user?.is_owner && (
              <Button onClick={() => setShowAdd(true)} className="w-full md:w-auto">
                <UserPlus size={16} />
                Добавить
              </Button>
            )}
          </div>
        }
      />

      {/* Search */}
      <div className="relative">
        <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400" />
        <input
          type="search"
          placeholder="Поиск по имени, бренду, телефону..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 min-h-touch rounded-2xl border border-neutral-200 text-sm outline-none hover:border-neutral-300 focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20 bg-white shadow-panel"
        />
      </div>

      {/* Status tabs */}
      <div className="flex gap-1 bg-neutral-100 rounded-2xl p-1 overflow-x-auto scrollbar-hide">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setOrderStatus(tab.key)}
            className={`shrink-0 min-h-touch py-2 px-3.5 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
              orderStatus === tab.key
                ? 'bg-white text-primary shadow-sm'
                : 'text-neutral-500 hover:text-neutral-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Date filter panel */}
      {showFilter && (
        <div className="panel p-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-[140px]">
              <label className="field-label">С даты</label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="mt-1 crm-control w-full"
              />
            </div>
            <div className="flex-1 min-w-[140px]">
              <label className="field-label">По дату</label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="mt-1 crm-control w-full"
              />
            </div>
            <Button variant="secondary" onClick={resetFilters}>
              <X size={14} />
              Сбросить
            </Button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {[1,2,3,4,5,6].map(i => <SkeletonCard key={i} />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {clients.map((c, i) => <ClientCard key={c.id} client={c} index={i} />)}
          {clients.length === 0 && (
            <div className="col-span-full text-center py-16">
              <div className="w-16 h-16 bg-neutral-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Users size={28} className="text-neutral-400" />
              </div>
              <div className="font-medium text-neutral-500">
                {search || hasFilters ? 'Ничего не найдено' : 'Нет клиентов'}
              </div>
              {!search && !hasFilters && user?.is_owner && (
                <button onClick={() => setShowAdd(true)} className="mt-3 text-sm text-primary underline">
                  Добавить первого клиента
                </button>
              )}
            </div>
          )}
        </div>
      )}

      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="Новый клиент">
        <AddClientForm onClose={() => setShowAdd(false)} />
      </Modal>
    </div>
  )
}
