import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getOrder, updateOrder, updateOrderRow, generatePdf, downloadPdfUrl } from '../api/endpoints'
import { useOrderWebSocket } from '../hooks/useWebSocket'
import { formatDate, formatMoney, STATUS_LABELS, PAYMENT_LABELS, initials } from '../utils/format'
import { Button } from '../components/ui/Button'
import { Badge } from '../components/ui/Badge'
import { Modal } from '../components/ui/Modal'
import useAuthStore from '../store/auth'

// ── Row component ─────────────────────────────────────────────────────────────

function OrderRowCard({ row, onUpdate, onLock, onUnlock, lockedBy, flash }) {
  const [local, setLocal] = useState(row)
  const debounceRef = useRef(null)

  useEffect(() => {
    setLocal(row)
  }, [row.updated_at])

  const handleChange = (key, value) => {
    const updated = { ...local, [key]: value }
    setLocal(updated)
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      onUpdate(row.id, { [key]: value })
    }, 500)
  }

  const handleFocus = () => onLock(row.id)
  const handleBlur = () => onUnlock(row.id)

  const total = local.quantity != null && local.price != null
    ? (parseFloat(local.quantity) * parseFloat(local.price)).toFixed(2)
    : null

  const statusColor = local.fulfillment_status === 'done'
    ? 'border-l-success' : local.fulfillment_status === 'failed'
    ? 'border-l-danger' : 'border-l-gray-200'

  const isLocked = !!lockedBy
  const isFlashing = flash

  return (
    <div className={`
      bg-white rounded-lg border-l-2 border border-gray-100 p-3 transition-all
      ${statusColor}
      ${isLocked ? 'border-blue-300 ring-1 ring-blue-200' : ''}
      ${isFlashing ? 'animate-pulse bg-amber-50' : ''}
    `}>
      {/* Mobile layout */}
      <div className="md:hidden space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-gray-400">#{row.row_number}</span>
          {isLocked && (
            <span className="text-xs text-blue-500 bg-blue-50 px-2 py-0.5 rounded-full">
              редактирует {lockedBy}
            </span>
          )}
        </div>
        <textarea
          value={local.item_name || ''}
          onChange={(e) => handleChange('item_name', e.target.value)}
          onFocus={handleFocus}
          onBlur={handleBlur}
          placeholder="Огурец 3кг..."
          rows={2}
          className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded-lg outline-none focus:border-primary resize-none"
        />
        {/* Status toggle */}
        <div className="flex gap-1.5">
          {[
            { val: 'done', label: '✓', cls: 'bg-emerald-500 text-white' },
            { val: 'failed', label: '✗', cls: 'bg-danger text-white' },
            { val: 'empty', label: '○', cls: 'bg-gray-100 text-gray-500' },
          ].map(({ val, label, cls }) => (
            <button
              key={val}
              onClick={() => handleChange('fulfillment_status', val)}
              className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                local.fulfillment_status === val ? cls : 'bg-gray-50 text-gray-400 hover:bg-gray-100'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <input
              type="number"
              inputMode="decimal"
              step="0.001"
              value={local.quantity ?? ''}
              onChange={(e) => handleChange('quantity', e.target.value || null)}
              onFocus={handleFocus}
              onBlur={handleBlur}
              placeholder="Кол-во"
              className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded-lg outline-none focus:border-primary tabular"
            />
          </div>
          <div className="flex gap-1">
            {['kg', 'pcs', 'pack', 'box'].map((u) => (
              <button
                key={u}
                onClick={() => handleChange('unit', u)}
                className={`flex-1 text-xs py-1.5 rounded-lg border transition-colors ${
                  local.unit === u
                    ? 'bg-primary text-white border-primary'
                    : 'border-gray-200 text-gray-500 hover:border-primary/40'
                }`}
              >
                {u === 'kg' ? 'кг' : u === 'pcs' ? 'шт' : u === 'pack' ? 'пач' : 'уп'}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="number"
            inputMode="decimal"
            step="0.01"
            value={local.price ?? ''}
            onChange={(e) => handleChange('price', e.target.value || null)}
            onFocus={handleFocus}
            onBlur={handleBlur}
            placeholder="Цена"
            className="flex-1 px-2 py-1.5 text-sm border border-gray-200 rounded-lg outline-none focus:border-primary tabular"
          />
          <div className="text-sm font-medium text-right tabular w-20">
            {total != null ? `${total} с` : '—'}
          </div>
        </div>
      </div>

      {/* Desktop layout — handled by table */}
    </div>
  )
}

// ── Desktop table row ─────────────────────────────────────────────────────────

function TableRow({ row, onUpdate, onLock, onUnlock, lockedBy, flash }) {
  const [local, setLocal] = useState(row)
  const debounceRef = useRef(null)

  useEffect(() => {
    setLocal(row)
  }, [row.updated_at])

  const handleChange = (key, value) => {
    const updated = { ...local, [key]: value }
    setLocal(updated)
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      onUpdate(row.id, { [key]: value })
    }, 500)
  }

  const total = local.quantity != null && local.price != null
    ? (parseFloat(local.quantity || 0) * parseFloat(local.price || 0)).toFixed(2)
    : null

  const cellCls = `px-1 py-1`

  const UNIT_LABELS = { kg: 'кг', pcs: 'шт', pack: 'пач', box: 'уп' }

  return (
    <tr className={`
      group transition-all
      ${row.fulfillment_status === 'done' ? 'border-l-2 border-l-success' : ''}
      ${row.fulfillment_status === 'failed' ? 'border-l-2 border-l-danger' : ''}
      ${row.fulfillment_status === 'empty' ? 'border-l-2 border-l-transparent' : ''}
      ${lockedBy ? 'outline outline-2 outline-blue-300 bg-blue-50/30' : 'hover:bg-surface'}
      ${flash ? 'bg-amber-50' : ''}
    `}>
      <td className={`${cellCls} text-xs text-gray-400 w-8 text-center`}>{row.row_number}</td>
      <td className={`${cellCls} w-56`}>
        <textarea
          value={local.item_name || ''}
          onChange={(e) => handleChange('item_name', e.target.value)}
          onFocus={() => onLock(row.id)}
          onBlur={() => onUnlock(row.id)}
          placeholder="Огурец 3кг..."
          rows={1}
          className="w-full px-2 py-1 text-sm border-0 bg-transparent outline-none focus:bg-white focus:ring-1 focus:ring-primary/30 rounded resize-none"
          style={{ minHeight: '2rem' }}
        />
      </td>
      <td className={`${cellCls} w-24`}>
        <div className="flex gap-0.5">
          {[
            { val: 'done', label: '✓', active: 'bg-emerald-500 text-white', hover: 'hover:bg-emerald-50' },
            { val: 'failed', label: '✗', active: 'bg-danger text-white', hover: 'hover:bg-red-50' },
            { val: 'empty', label: '○', active: 'bg-gray-200 text-gray-600', hover: 'hover:bg-gray-100' },
          ].map(({ val, label, active, hover }) => (
            <button
              key={val}
              onClick={() => handleChange('fulfillment_status', val)}
              title={val === 'done' ? 'Выполнен' : val === 'failed' ? 'Не выполнен' : 'Нету'}
              className={`w-7 h-7 rounded text-xs font-bold transition-colors ${
                local.fulfillment_status === val ? active : `text-gray-300 ${hover}`
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </td>
      <td className={`${cellCls} w-24`}>
        <input
          type="number"
          inputMode="decimal"
          step="0.001"
          value={local.quantity ?? ''}
          onChange={(e) => handleChange('quantity', e.target.value || null)}
          onFocus={() => onLock(row.id)}
          onBlur={() => onUnlock(row.id)}
          className="w-full px-2 py-1 text-sm text-right border border-transparent hover:border-gray-200 focus:border-primary rounded outline-none tabular bg-transparent focus:bg-white"
        />
      </td>
      <td className={`${cellCls} w-32`}>
        <div className="flex gap-0.5">
          {['kg', 'pcs', 'pack', 'box'].map((u) => (
            <button
              key={u}
              onClick={() => handleChange('unit', u)}
              className={`flex-1 text-xs py-1 rounded border transition-colors ${
                local.unit === u
                  ? 'bg-primary text-white border-primary'
                  : 'border-gray-100 text-gray-400 hover:border-primary/40 hover:text-primary'
              }`}
            >
              {UNIT_LABELS[u]}
            </button>
          ))}
        </div>
      </td>
      <td className={`${cellCls} w-24`}>
        <input
          type="number"
          inputMode="decimal"
          step="0.01"
          value={local.price ?? ''}
          onChange={(e) => handleChange('price', e.target.value || null)}
          onFocus={() => onLock(row.id)}
          onBlur={() => onUnlock(row.id)}
          className="w-full px-2 py-1 text-sm text-right border border-transparent hover:border-gray-200 focus:border-primary rounded outline-none tabular bg-transparent focus:bg-white"
        />
      </td>
      <td className={`${cellCls} w-24 text-right pr-3`}>
        <span className="text-sm tabular font-medium text-gray-700">
          {total != null ? total : ''}
        </span>
      </td>
    </tr>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export function OrderEditor() {
  const { id } = useParams()
  const { user } = useAuthStore()
  const qc = useQueryClient()
  const [connected, setConnected] = useState(false)
  const [activeUsers, setActiveUsers] = useState([])
  const [locks, setLocks] = useState({})
  const [flashRows, setFlashRows] = useState({})
  const [showComplete, setShowComplete] = useState(false)
  const [completionForm, setCompletionForm] = useState({
    sent_at: '', payment_status: 'unpaid', payment_amount: '', payment_receipt: null,
  })

  const { data: order, isLoading } = useQuery({
    queryKey: ['order', id],
    queryFn: () => getOrder(id).then((r) => r.data),
  })

  const rowUpdateMutation = useMutation({
    mutationFn: ({ rowId, data }) => updateOrderRow(id, rowId, data),
    onSuccess: () => qc.invalidateQueries(['order', id]),
  })

  const statusMutation = useMutation({
    mutationFn: (status) => updateOrder(id, { status }),
    onSuccess: () => qc.invalidateQueries(['order', id]),
  })

  const completeMutation = useMutation({
    mutationFn: (formData) => updateOrder(id, formData),
    onSuccess: () => {
      qc.invalidateQueries(['order', id])
      setShowComplete(false)
    },
  })

  const { send } = useOrderWebSocket(id, {
    onConnect: () => setConnected(true),
    onDisconnect: () => setConnected(false),
    onMessage: (msg) => {
      if (msg.event === 'user:joined') {
        setActiveUsers((u) => [...u.filter((x) => x.id !== msg.user_id), { id: msg.user_id, name: msg.user_name }])
      } else if (msg.event === 'user:left') {
        setActiveUsers((u) => u.filter((x) => x.id !== msg.user_id))
      } else if (msg.event === 'row:lock') {
        if (msg.user_id !== user?.id) {
          setLocks((l) => ({ ...l, [msg.row_id]: msg.user_name }))
        }
      } else if (msg.event === 'row:unlock') {
        setLocks((l) => { const n = { ...l }; delete n[msg.row_id]; return n })
      } else if (msg.event === 'row:updated') {
        if (msg.user_id !== user?.id) {
          qc.invalidateQueries(['order', id])
          setFlashRows((f) => ({ ...f, [msg.row_id]: true }))
          setTimeout(() => setFlashRows((f) => { const n = { ...f }; delete n[msg.row_id]; return n }), 800)
        }
      } else if (msg.event === 'order:status') {
        qc.invalidateQueries(['order', id])
      }
    },
  })

  const handleRowUpdate = useCallback((rowId, fields) => {
    rowUpdateMutation.mutate({ rowId, data: fields })
    send({ event: 'row:update', row_id: rowId, fields })
  }, [send])

  const handleLock = useCallback((rowId) => {
    send({ event: 'row:lock', row_id: rowId })
  }, [send])

  const handleUnlock = useCallback((rowId) => {
    send({ event: 'row:unlock', row_id: rowId })
  }, [send])

  const handleStatusChange = (newStatus) => {
    statusMutation.mutate(newStatus)
    send({ event: 'order:status', status: newStatus })
  }

  const handleComplete = (e) => {
    e.preventDefault()
    const formData = new FormData()
    formData.append('status', 'completed')
    if (completionForm.sent_at) formData.append('sent_at', completionForm.sent_at)
    formData.append('payment_status', completionForm.payment_status)
    if (completionForm.payment_amount) formData.append('payment_amount', completionForm.payment_amount)
    if (completionForm.payment_receipt) formData.append('payment_receipt', completionForm.payment_receipt)
    completeMutation.mutate(formData)
    send({ event: 'order:status', status: 'completed' })
  }

  if (isLoading) return <div className="p-6 text-gray-400">Загрузка заказа...</div>
  if (!order) return null

  const rows = order.rows || []
  const totalAmount = rows.reduce((sum, r) => {
    if (r.fulfillment_status === 'done' && r.total) return sum + parseFloat(r.total)
    return sum
  }, 0)

  return (
    <div className="flex flex-col min-h-screen">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-4 md:px-6 py-3 sticky top-0 z-30">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <Link to={`/clients/${order.client}`} className="text-gray-400 hover:text-primary text-sm">
              ← Клиент
            </Link>
            <div>
              <div className="font-semibold text-primary text-sm md:text-base">
                Заказ #{order.id} — {order.client_brand || order.client_name}
              </div>
              <div className="text-xs text-gray-400">{formatDate(order.created_at)}</div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Active users */}
            <div className="flex -space-x-2">
              {activeUsers.map((u) => (
                <div
                  key={u.id}
                  title={u.name}
                  className="w-7 h-7 rounded-full bg-accent flex items-center justify-center text-white text-xs font-bold ring-2 ring-white"
                >
                  {initials(u.name)}
                </div>
              ))}
            </div>

            {/* Status select */}
            <select
              value={order.status}
              onChange={(e) => handleStatusChange(e.target.value)}
              className="px-3 py-1.5 rounded-lg border border-gray-200 text-sm outline-none focus:border-primary"
            >
              <option value="new">Новый</option>
              <option value="in_progress">В процессе</option>
              <option value="completed">Завершён</option>
            </select>

            {user?.role === 'owner' && (
              <Button size="sm" variant="accent" onClick={() => setShowComplete(true)}>
                Завершить
              </Button>
            )}

            <a
              href={downloadPdfUrl(id)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm px-3 py-1.5 rounded-lg border border-gray-200 hover:border-primary text-gray-600 hover:text-primary transition-colors"
            >
              PDF
            </a>
          </div>
        </div>
      </div>

      {/* No connection banner */}
      {!connected && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 text-sm text-amber-700 text-center">
          Нет соединения. Переподключение...
        </div>
      )}

      {/* Desktop table */}
      <div className="hidden md:block flex-1 overflow-x-auto">
        <table className="w-full text-sm border-separate border-spacing-0">
          <thead className="sticky top-[57px] bg-white z-20">
            <tr className="text-xs text-gray-400 uppercase tracking-wider">
              <th className="px-3 py-2 text-center font-medium w-8">№</th>
              <th className="px-1 py-2 text-left font-medium w-56">Наименование</th>
              <th className="px-1 py-2 text-left font-medium w-24">Статус</th>
              <th className="px-1 py-2 text-right font-medium w-24">Кол-во</th>
              <th className="px-1 py-2 text-left font-medium w-32">Ед.</th>
              <th className="px-1 py-2 text-right font-medium w-24">Цена</th>
              <th className="px-3 py-2 text-right font-medium w-24">Итог</th>
            </tr>
            <tr><td colSpan={7} className="border-b border-gray-100"></td></tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <TableRow
                key={row.id}
                row={row}
                onUpdate={handleRowUpdate}
                onLock={handleLock}
                onUnlock={handleUnlock}
                lockedBy={locks[row.id]}
                flash={flashRows[row.id]}
              />
            ))}
          </tbody>
          <tfoot className="bg-surface sticky bottom-0">
            <tr>
              <td colSpan={6} className="px-3 py-3 text-right text-sm font-medium text-gray-600">
                Итого (выполненные):
              </td>
              <td className="px-3 py-3 text-right text-sm font-bold text-primary tabular">
                {formatMoney(totalAmount)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden p-3 space-y-2 flex-1 pb-20">
        {rows.map((row) => (
          <OrderRowCard
            key={row.id}
            row={row}
            onUpdate={handleRowUpdate}
            onLock={handleLock}
            onUnlock={handleUnlock}
            lockedBy={locks[row.id]}
            flash={flashRows[row.id]}
          />
        ))}
        <div className="bg-white rounded-xl border border-gray-100 p-4 text-right">
          <span className="text-sm text-gray-500 mr-3">Итого (выполненные):</span>
          <span className="text-lg font-bold text-primary tabular">{formatMoney(totalAmount)}</span>
        </div>
      </div>

      {/* Completion Modal */}
      <Modal open={showComplete} onClose={() => setShowComplete(false)} title="Завершение заказа">
        <form onSubmit={handleComplete} className="space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-700">Дата отправки</label>
            <input
              type="date"
              value={completionForm.sent_at}
              onChange={(e) => setCompletionForm((f) => ({ ...f, sent_at: e.target.value }))}
              className="mt-1 w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-primary"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700">Статус оплаты</label>
            <div className="flex gap-3 mt-1">
              {[
                { val: 'paid', label: 'Оплачен', cls: 'border-success text-success' },
                { val: 'unpaid', label: 'Не оплачен', cls: 'border-gray-300 text-gray-500' },
              ].map(({ val, label, cls }) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => setCompletionForm((f) => ({ ...f, payment_status: val }))}
                  className={`flex-1 py-2 rounded-lg border-2 text-sm font-medium transition-colors ${
                    completionForm.payment_status === val ? cls : 'border-gray-100 text-gray-300'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          {completionForm.payment_status === 'paid' && (
            <>
              <div>
                <label className="text-sm font-medium text-gray-700">Сумма оплаты</label>
                <input
                  type="number"
                  step="0.01"
                  value={completionForm.payment_amount}
                  onChange={(e) => setCompletionForm((f) => ({ ...f, payment_amount: e.target.value }))}
                  className="mt-1 w-full px-3 py-2 rounded-lg border border-gray-200 text-sm outline-none focus:border-primary tabular"
                  placeholder="0.00"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Загрузить чек</label>
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  onChange={(e) => setCompletionForm((f) => ({ ...f, payment_receipt: e.target.files[0] }))}
                  className="mt-1 w-full text-sm text-gray-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-primary file:text-white file:text-xs hover:file:bg-primary-500"
                />
              </div>
            </>
          )}
          <div className="bg-surface rounded-lg px-4 py-3">
            <div className="text-sm text-gray-500">Итоговая сумма по выполненным строкам:</div>
            <div className="text-xl font-bold text-primary tabular">{formatMoney(totalAmount)} сом</div>
          </div>

          {/* PDF preview hint */}
          {order.pdf_file && (
            <div className="border border-gray-100 rounded-lg overflow-hidden" style={{ height: '200px' }}>
              <iframe
                src={`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}${order.pdf_file}`}
                className="w-full h-full"
                title="Предпросмотр PDF"
              />
            </div>
          )}

          <div className="flex gap-3 justify-end pt-2">
            <Button type="button" variant="secondary" onClick={() => setShowComplete(false)}>Отмена</Button>
            <Button type="submit" disabled={completeMutation.isLoading}>
              {completeMutation.isLoading ? 'Сохранение...' : 'Завершить заказ'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
