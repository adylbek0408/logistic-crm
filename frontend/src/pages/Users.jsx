import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getUsers, createUser, updateUser, deleteUser } from '../api/endpoints'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Modal } from '../components/ui/Modal'
import { SkeletonCard } from '../components/ui/Skeleton'
import { PageHeader } from '../components/ui/PageHeader'
import useAuthStore from '../store/auth'
import { UserPlus, Trash2, Shield, User, KeyRound, Pencil } from 'lucide-react'

const ROLE_META = {
  owner:  { label: 'Владелец',   bg: 'bg-amber-100 text-amber-700',   dot: 'bg-amber-400' },
  worker: { label: 'Сотрудник',  bg: 'bg-blue-100 text-blue-700',     dot: 'bg-blue-400' },
}

const EMPTY_FORM = { username: '', password: '', full_name: '', phone: '', role: 'worker' }

function UserCard({ u, currentId, onEdit, onDelete }) {
  const meta = ROLE_META[u.role] || ROLE_META.worker
  const isSelf = u.id === currentId
  return (
    <div className="panel p-4 flex items-center gap-4">
      <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-primary to-primary-500 flex items-center justify-center text-white font-bold text-lg shrink-0 select-none">
        {(u.full_name || u.username).charAt(0).toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-primary truncate">{u.full_name || u.username}</div>
        <div className="text-xs text-neutral-400 truncate">@{u.username}</div>
        {u.phone && <div className="text-xs text-neutral-400">{u.phone}</div>}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <span className={`flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-full ${meta.bg}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} />
          {meta.label}
        </span>
        <button
          onClick={() => onEdit(u)}
          className="p-2 rounded-xl text-neutral-400 hover:text-primary hover:bg-primary/8 transition-colors"
          title="Редактировать"
        >
          <Pencil size={15} />
        </button>
        {!isSelf && (
          <button
            onClick={() => onDelete(u)}
            className="p-2 rounded-xl text-neutral-300 hover:text-red-500 hover:bg-red-50 transition-colors"
            title="Удалить"
          >
            <Trash2 size={15} />
          </button>
        )}
      </div>
    </div>
  )
}

export function Users() {
  const { user: currentUser } = useAuthStore()
  const qc = useQueryClient()

  const [showAdd, setShowAdd]       = useState(false)
  const [editTarget, setEditTarget] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [form, setForm]             = useState(EMPTY_FORM)
  const [errors, setErrors]         = useState({})

  const { data, isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: () => getUsers().then((r) => r.data),
  })

  const users = data?.results || data || []

  const createMutation = useMutation({
    mutationFn: createUser,
    onSuccess: () => { qc.invalidateQueries(['users']); closeAdd() },
    onError: (e) => setErrors(e.response?.data || {}),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => updateUser(id, data),
    onSuccess: () => { qc.invalidateQueries(['users']); closeEdit() },
    onError: (e) => setErrors(e.response?.data || {}),
  })

  const deleteMutation = useMutation({
    mutationFn: deleteUser,
    onSuccess: () => { qc.invalidateQueries(['users']); setDeleteTarget(null) },
  })

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }))

  function openAdd() {
    setForm(EMPTY_FORM)
    setErrors({})
    setShowAdd(true)
  }

  function closeAdd() {
    setShowAdd(false)
    setForm(EMPTY_FORM)
    setErrors({})
  }

  function openEdit(u) {
    setForm({ username: u.username, password: '', full_name: u.full_name || '', phone: u.phone || '', role: u.role })
    setErrors({})
    setEditTarget(u)
  }

  function closeEdit() {
    setEditTarget(null)
    setForm(EMPTY_FORM)
    setErrors({})
  }

  function submitAdd(e) {
    e.preventDefault()
    createMutation.mutate(form)
  }

  function submitEdit(e) {
    e.preventDefault()
    const payload = { full_name: form.full_name, phone: form.phone, role: form.role }
    if (form.password) payload.password = form.password
    updateMutation.mutate({ id: editTarget.id, data: payload })
  }

  const ownerCount = users.filter((u) => u.role === 'owner').length

  return (
    <div className="page-wrap max-w-3xl">
      <PageHeader
        title="Сотрудники"
        subtitle={`${users.length} пользователей`}
        actions={
          <Button onClick={openAdd}>
            <UserPlus size={16} />
            Добавить
          </Button>
        }
      />

      {isLoading ? (
        <div className="space-y-3">
          {[1,2,3].map(i => <SkeletonCard key={i} />)}
        </div>
      ) : (
        <div className="space-y-3">
          {users.map((u) => (
            <UserCard
              key={u.id}
              u={u}
              currentId={currentUser?.id}
              onEdit={openEdit}
              onDelete={setDeleteTarget}
            />
          ))}
          {users.length === 0 && (
            <div className="text-center py-16">
              <div className="w-16 h-16 bg-neutral-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <User size={28} className="text-neutral-400" />
              </div>
              <div className="font-medium text-neutral-500">Нет пользователей</div>
            </div>
          )}
        </div>
      )}

      {/* Add modal */}
      <Modal open={showAdd} onClose={closeAdd} title="Новый сотрудник">
        <form onSubmit={submitAdd} className="space-y-4">
          <Input label="Логин *" value={form.username} onChange={set('username')}
            error={errors.username?.[0]} required placeholder="ivan_petrov" autoComplete="off" />
          <Input label="Пароль *" type="password" value={form.password} onChange={set('password')}
            error={errors.password?.[0]} required placeholder="Минимум 6 символов" autoComplete="new-password" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input label="ФИО" value={form.full_name} onChange={set('full_name')}
              error={errors.full_name?.[0]} placeholder="Иван Петров" />
            <Input label="Телефон" value={form.phone} onChange={set('phone')}
              placeholder="+996 700 000 000" />
          </div>

          {/* Role picker */}
          <div>
            <label className="field-label">Роль</label>
            <div className="grid grid-cols-2 gap-2 mt-1">
              {Object.entries(ROLE_META).map(([val, meta]) => (
                <button
                  key={val} type="button"
                  onClick={() => setForm((f) => ({ ...f, role: val }))}
                  className={`flex items-center gap-3 p-3 rounded-xl border-2 text-left transition-all ${
                    form.role === val
                      ? 'border-primary bg-primary/5'
                      : 'border-neutral-200 hover:border-neutral-300'
                  }`}
                >
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${form.role === val ? 'bg-primary text-white' : 'bg-neutral-100 text-neutral-400'}`}>
                    {val === 'owner' ? <Shield size={15} /> : <User size={15} />}
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-primary">{meta.label}</div>
                    <div className="text-xs text-neutral-400">
                      {val === 'owner' ? 'Полный доступ' : 'Только работа с заказами'}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-3 justify-end pt-1">
            <Button type="button" variant="secondary" onClick={closeAdd}>Отмена</Button>
            <Button type="submit" disabled={createMutation.isLoading}>
              {createMutation.isLoading ? 'Создание...' : 'Создать'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Edit modal */}
      <Modal open={!!editTarget} onClose={closeEdit} title="Редактировать сотрудника">
        <form onSubmit={submitEdit} className="space-y-4">
          <div className="bg-neutral-50 rounded-xl px-4 py-3 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-primary-500 flex items-center justify-center text-white font-bold shrink-0">
              {(editTarget?.full_name || editTarget?.username || '?').charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="font-semibold text-primary">{editTarget?.full_name || editTarget?.username}</div>
              <div className="text-xs text-neutral-400">@{editTarget?.username}</div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input label="ФИО" value={form.full_name} onChange={set('full_name')}
              error={errors.full_name?.[0]} placeholder="Иван Петров" />
            <Input label="Телефон" value={form.phone} onChange={set('phone')}
              placeholder="+996 700 000 000" />
          </div>

          <div>
            <label className="field-label flex items-center gap-1.5">
              <KeyRound size={12} /> Новый пароль (оставьте пустым — без изменений)
            </label>
            <input
              type="password" value={form.password} onChange={set('password')}
              placeholder="Введите новый пароль"
              autoComplete="new-password"
              className="mt-1 w-full px-3 py-2.5 rounded-xl border border-neutral-200 text-sm outline-none hover:border-neutral-300 focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20"
            />
          </div>

          <div>
            <label className="field-label">Роль</label>
            <div className="grid grid-cols-2 gap-2 mt-1">
              {Object.entries(ROLE_META).map(([val, meta]) => (
                <button
                  key={val} type="button"
                  onClick={() => setForm((f) => ({ ...f, role: val }))}
                  disabled={val === 'owner' && ownerCount <= 1 && editTarget?.role === 'owner'}
                  className={`flex items-center gap-3 p-3 rounded-xl border-2 text-left transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
                    form.role === val
                      ? 'border-primary bg-primary/5'
                      : 'border-neutral-200 hover:border-neutral-300'
                  }`}
                >
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${form.role === val ? 'bg-primary text-white' : 'bg-neutral-100 text-neutral-400'}`}>
                    {val === 'owner' ? <Shield size={15} /> : <User size={15} />}
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-primary">{meta.label}</div>
                    <div className="text-xs text-neutral-400">
                      {val === 'owner' ? 'Полный доступ' : 'Только работа с заказами'}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-3 justify-end pt-1">
            <Button type="button" variant="secondary" onClick={closeEdit}>Отмена</Button>
            <Button type="submit" disabled={updateMutation.isLoading}>
              {updateMutation.isLoading ? 'Сохранение...' : 'Сохранить'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete confirm */}
      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Удалить сотрудника?">
        <div className="space-y-4">
          <p className="text-sm text-neutral-600">
            Вы уверены, что хотите удалить{' '}
            <span className="font-semibold text-primary">{deleteTarget?.full_name || deleteTarget?.username}</span>?
            Пользователь потеряет доступ к системе.
          </p>
          <div className="flex gap-3 justify-end">
            <Button variant="secondary" onClick={() => setDeleteTarget(null)}>Отмена</Button>
            <button
              onClick={() => deleteMutation.mutate(deleteTarget.id)}
              disabled={deleteMutation.isLoading}
              className="min-h-touch px-4 bg-red-500 text-white rounded-xl text-sm font-medium hover:bg-red-600 transition-colors disabled:opacity-60"
            >
              {deleteMutation.isLoading ? 'Удаление...' : 'Удалить'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
