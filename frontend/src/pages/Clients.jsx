import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { getClients, createClient } from '../api/endpoints'
import { formatDate, initials } from '../utils/format'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Modal } from '../components/ui/Modal'
import useAuthStore from '../store/auth'

function ClientCard({ client }) {
  return (
    <Link to={`/clients/${client.id}`} className="block bg-white rounded-xl border border-gray-100 p-4 hover:shadow-sm hover:border-primary/20 transition-all">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-white text-sm font-bold shrink-0">
          {initials(client.display_name)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-medium text-primary truncate">{client.display_name}</div>
          {client.brand_name && (
            <div className="text-xs text-gray-500 truncate">{client.brand_name}</div>
          )}
        </div>
        <div className="text-right shrink-0">
          <div className="text-sm font-medium tabular">{client.orders_count}</div>
          <div className="text-xs text-gray-400">заказов</div>
        </div>
      </div>
      {client.phone && (
        <div className="mt-2 text-xs text-gray-500 pl-13">{client.phone}</div>
      )}
    </Link>
  )
}

function AddClientForm({ onSuccess, onClose }) {
  const [form, setForm] = useState({ first_name: '', last_name: '', phone: '', brand_name: '', notes: '' })
  const [errors, setErrors] = useState({})
  const qc = useQueryClient()

  const mutation = useMutation({
    mutationFn: createClient,
    onSuccess: () => {
      qc.invalidateQueries(['clients'])
      onSuccess?.()
      onClose()
    },
    onError: (err) => setErrors(err.response?.data || {}),
  })

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); mutation.mutate(form) }}
      className="space-y-4"
    >
      <div className="grid grid-cols-2 gap-3">
        <Input label="Имя *" value={form.first_name} onChange={set('first_name')} error={errors.first_name?.[0]} required />
        <Input label="Фамилия" value={form.last_name} onChange={set('last_name')} />
      </div>
      <Input label="Телефон" value={form.phone} onChange={set('phone')} type="tel" />
      <Input label="Бренд / Магазин" value={form.brand_name} onChange={set('brand_name')} />
      <div>
        <label className="text-sm font-medium text-gray-700">Заметки</label>
        <textarea
          value={form.notes}
          onChange={set('notes')}
          rows={3}
          className="mt-1 w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary focus:ring-offset-0 resize-none"
        />
      </div>
      <div className="flex gap-3 justify-end pt-2">
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
  const [showAdd, setShowAdd] = useState(false)
  const { user } = useAuthStore()

  const { data, isLoading } = useQuery({
    queryKey: ['clients', search],
    queryFn: () => getClients({ search }).then((r) => r.data),
    keepPreviousData: true,
  })

  const clients = data?.results || data || []

  return (
    <div className="p-4 md:p-6 space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-primary">Клиенты</h1>
        {user?.role === 'owner' && (
          <Button onClick={() => setShowAdd(true)} size="sm">+ Добавить</Button>
        )}
      </div>
      <input
        type="search"
        placeholder="Поиск по имени, бренду, телефону..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary focus:ring-offset-0"
      />
      {isLoading ? (
        <div className="text-center py-12 text-gray-400">Загрузка...</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {clients.map((c) => <ClientCard key={c.id} client={c} />)}
          {clients.length === 0 && (
            <div className="col-span-full text-center py-12 text-gray-400">
              {search ? 'Ничего не найдено' : 'Нет клиентов'}
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
