import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getTemplates, createTemplate, deleteTemplate } from '../api/endpoints'
import { formatDate } from '../utils/format'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { Modal } from '../components/ui/Modal'
import useAuthStore from '../store/auth'

export function Templates() {
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({ name: '', rows_per_page: 10, pages: 1 })
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
    onSuccess: () => qc.invalidateQueries(['templates']),
  })

  const templates = data?.results || data || []
  const totalRows = Number(form.rows_per_page) * Number(form.pages)

  return (
    <div className="p-4 md:p-6 space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-primary">Шаблоны</h1>
        {user?.role === 'owner' && (
          <Button onClick={() => setShowAdd(true)} size="sm">+ Создать</Button>
        )}
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-gray-400">Загрузка...</div>
      ) : (
        <div className="space-y-2">
          {templates.map((t) => (
            <div
              key={t.id}
              className="bg-white rounded-xl border border-gray-100 p-4 flex items-center justify-between hover:border-primary/20 transition-colors"
            >
              <div>
                <div className="font-medium text-primary">{t.name}</div>
                <div className="text-sm text-gray-500 mt-0.5">
                  {t.total_rows} строк ({t.rows_per_page} × {t.pages}) · Создан {formatDate(t.created_at)}
                </div>
              </div>
              {user?.role === 'owner' && (
                <button
                  onClick={() => {
                    if (confirm(`Удалить шаблон "${t.name}"?`)) deleteMutation.mutate(t.id)
                  }}
                  className="text-gray-400 hover:text-danger transition-colors ml-4 text-lg"
                >
                  ×
                </button>
              )}
            </div>
          ))}
          {templates.length === 0 && (
            <div className="text-center py-12 text-gray-400">Нет шаблонов</div>
          )}
        </div>
      )}

      <Modal open={showAdd} onClose={() => setShowAdd(false)} title="Новый шаблон" size="sm">
        <form
          onSubmit={(e) => { e.preventDefault(); createMutation.mutate(form) }}
          className="space-y-4"
        >
          <Input
            label="Название"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            required
            placeholder="Овощи базар"
          />
          <div className="grid grid-cols-2 gap-3">
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
          <div className="bg-surface rounded-lg px-4 py-3 text-sm">
            Итого строк: <span className="font-bold text-primary">{totalRows}</span>
          </div>
          <div className="flex gap-3 justify-end">
            <Button type="button" variant="secondary" onClick={() => setShowAdd(false)}>Отмена</Button>
            <Button type="submit" disabled={createMutation.isLoading}>
              {createMutation.isLoading ? 'Создание...' : 'Создать'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
