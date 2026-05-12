import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getTemplates, createTemplate, deleteTemplate } from '../api/endpoints'
import { formatDate } from '../utils/format'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Modal } from '../components/ui/Modal'
import { SkeletonCard } from '../components/ui/Skeleton'
import { PageHeader } from '../components/ui/PageHeader'
import useAuthStore from '../store/auth'
import { LayoutTemplate, Plus, Trash2, Rows3, BookOpen } from 'lucide-react'

export function Templates() {
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({ name: '', rows_per_page: 10, pages: 1 })
  const [confirmDelete, setConfirmDelete] = useState(null)
  const { user } = useAuthStore()
  const qc = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['templates'],
    queryFn: () => getTemplates().then((r) => r.data),
  })

  const createMutation = useMutation({
    mutationFn: createTemplate,
    onSuccess: () => {
      qc.invalidateQueries(['templates'])
      setShowAdd(false)
      setForm({ name: '', rows_per_page: 10, pages: 1 })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: deleteTemplate,
    onSuccess: () => {
      qc.invalidateQueries(['templates'])
      setConfirmDelete(null)
    },
  })

  const templates = data?.results || data || []
  const totalRows = Number(form.rows_per_page) * Number(form.pages)

  return (
    <div className="page-wrap max-w-3xl">
      <PageHeader
        title="Шаблоны"
        subtitle={`${templates.length} шаблонов`}
        actions={user?.role === 'owner' ? (
          <Button onClick={() => setShowAdd(true)} className="w-full md:w-auto">
            <Plus size={16} />
            Создать
          </Button>
        ) : null}
      />

      {isLoading ? (
        <div className="space-y-3">
          {[1,2,3].map(i => <SkeletonCard key={i} />)}
        </div>
      ) : (
        <div className="space-y-3">
          {templates.map((t) => (
            <div
              key={t.id}
              className="panel p-4 hover:shadow-md hover:border-primary/20 transition-all"
            >
              <div className="flex items-start gap-4">
                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-primary to-primary-500 flex items-center justify-center shadow-md shrink-0">
                  <LayoutTemplate size={20} className="text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-primary truncate">{t.name}</div>
                  <div className="flex flex-wrap gap-3 mt-1.5">
                    <div className="flex items-center gap-1 text-xs text-neutral-500">
                      <Rows3 size={12} className="text-neutral-400" />
                      {t.total_rows} строк
                    </div>
                    <div className="flex items-center gap-1 text-xs text-neutral-400">
                      <BookOpen size={12} />
                      {t.rows_per_page} × {t.pages} страниц
                    </div>
                    <div className="text-xs text-neutral-400">{formatDate(t.created_at)}</div>
                  </div>
                </div>
                {user?.role === 'owner' && (
                  <button
                    onClick={() => setConfirmDelete(t)}
                    className="mobile-tap inline-flex items-center justify-center rounded-xl text-neutral-300 hover:text-red-500 hover:bg-red-50 transition-colors shrink-0"
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            </div>
          ))}

          {templates.length === 0 && (
            <div className="text-center py-16">
              <div className="w-16 h-16 bg-neutral-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <LayoutTemplate size={28} className="text-neutral-400" />
              </div>
              <div className="font-medium text-neutral-500">Нет шаблонов</div>
              <div className="text-sm text-neutral-400 mt-1">Шаблоны определяют структуру заказа</div>
              {user?.role === 'owner' && (
                <button
                  onClick={() => setShowAdd(true)}
                  className="mt-3 text-sm text-primary underline"
                >
                  Создать первый шаблон
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Create modal */}
      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="Новый шаблон">
        <form
          onSubmit={(e) => { e.preventDefault(); createMutation.mutate(form) }}
          className="space-y-4"
        >
          <Input
            label="Название *"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            required
            placeholder="Овощи базар"
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Строк на странице"
              type="number"
              min={1}
              max={100}
              value={form.rows_per_page}
              onChange={(e) => setForm((f) => ({ ...f, rows_per_page: e.target.value }))}
            />
            <Input
              label="Страниц"
              type="number"
              min={1}
              max={20}
              value={form.pages}
              onChange={(e) => setForm((f) => ({ ...f, pages: e.target.value }))}
            />
          </div>
          <div className="bg-gradient-to-br from-primary/5 to-primary-500/5 rounded-xl px-4 py-3 flex items-center justify-between">
            <span className="text-sm text-neutral-600">Итого строк в заказе</span>
            <span className="text-2xl font-black text-primary tabular">{totalRows}</span>
          </div>
          <div className="flex gap-3 justify-end pt-1">
            <Button type="button" variant="secondary" onClick={() => setShowAdd(false)}>Отмена</Button>
            <Button type="submit" disabled={createMutation.isLoading}>
              {createMutation.isLoading ? 'Создание...' : 'Создать шаблон'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Delete confirm modal */}
      <Modal open={!!confirmDelete} onClose={() => setConfirmDelete(null)} title="Удалить шаблон?">
        <div className="space-y-4">
          <p className="text-sm text-neutral-600">
            Вы уверены, что хотите удалить шаблон{' '}
            <span className="font-semibold text-primary">"{confirmDelete?.name}"</span>?
            Это действие нельзя отменить.
          </p>
          <div className="flex gap-3 justify-end">
            <Button type="button" variant="secondary" onClick={() => setConfirmDelete(null)}>
              Отмена
            </Button>
            <button
              onClick={() => deleteMutation.mutate(confirmDelete.id)}
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
