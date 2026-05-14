import { useState, useEffect, useCallback, useRef, useMemo, memo } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft, FileDown, CheckCircle2, XCircle, Circle,
  ChevronDown, Loader2, ChevronLeft, ChevronRight, Search, X, Trash2,
} from 'lucide-react'
import { getOrder, updateOrder, updateOrderRow, downloadPdf, deleteOrder } from '../api/endpoints'
import { useOrderWebSocket } from '../hooks/useWebSocket'
import { formatDate, formatMoney, initials } from '../utils/format'
import { Modal } from '../components/ui/Modal'
import useAuthStore from '../store/auth'

const UNIT_LABELS = { kg: 'кг', pcs: 'шт', pack: 'пач', box: 'уп' }

const STATUS_OPTS = [
  { val: 'new',         label: 'Новый',      dot: 'bg-blue-400' },
  { val: 'in_progress', label: 'В процессе', dot: 'bg-amber-400' },
  { val: 'completed',   label: 'Завершён',   dot: 'bg-emerald-500' },
]

// ── Helpers ───────────────────────────────────────────────────────────────────

function calcTotal(quantity, price) {
  const q = parseFloat(quantity || 0)
  const p = parseFloat(price || 0)
  return q > 0 && p > 0 ? q * p : null
}

// ── Mobile card row ───────────────────────────────────────────────────────────

const MobileRow = memo(function MobileRow({ row, onUpdate, onLock, onUnlock, lockedBy, flash, onLocalChange }) {
  const localRef = useRef(row)
  const [local, setLocal] = useState(row)
  const debounce = useRef(null)

  useEffect(() => {
    localRef.current = row
    setLocal(row)
  }, [row.updated_at])

  const change = (key, val) => {
    const next = { ...localRef.current, [key]: val }
    localRef.current = next
    setLocal(next)
    onLocalChange(row.id, next)
    clearTimeout(debounce.current)
    debounce.current = setTimeout(() => onUpdate(row.id, { [key]: val }), 500)
  }

  const total = calcTotal(local.quantity, local.price)
  const st = local.fulfillment_status
  const borderColor = st === 'done' ? 'border-l-emerald-400' : st === 'failed' ? 'border-l-rose-400' : 'border-l-neutral-200'

  return (
    <div className={`bg-white rounded-2xl border border-neutral-100 border-l-4 p-4 space-y-3 transition-colors
      ${borderColor}
      ${lockedBy ? 'bg-blue-50/30' : ''}
      ${flash ? 'bg-amber-50' : ''}
    `}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-mono text-neutral-300">#{row.row_number}</span>
        {lockedBy && (
          <span className="text-xs bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full font-medium">
            ✎ {lockedBy}
          </span>
        )}
      </div>

      <textarea
        value={local.item_name || ''}
        onChange={(e) => change('item_name', e.target.value)}
        onFocus={() => onLock(row.id)}
        onBlur={() => onUnlock(row.id)}
        placeholder="Наименование товара"
        rows={2}
        className="w-full px-3 py-2 text-sm bg-neutral-50 border border-transparent rounded-xl outline-none focus:bg-white focus:border-primary/30 focus:ring-2 focus:ring-primary/10 resize-none"
      />

      <div className="grid grid-cols-3 gap-1.5">
        {[
          { val: 'done',   icon: CheckCircle2, label: 'Выполнен',  on: 'bg-emerald-500 text-white shadow-sm shadow-emerald-200' },
          { val: 'failed', icon: XCircle,      label: 'Не выпол.', on: 'bg-rose-500 text-white shadow-sm shadow-rose-200' },
          { val: 'empty',  icon: Circle,       label: 'Нету',      on: 'bg-neutral-200 text-neutral-700' },
        ].map(({ val, icon: Icon, label, on }) => (
          <button key={val} onClick={() => change('fulfillment_status', val)}
            className={`mobile-tap flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold transition-all ${
              st === val ? on : 'bg-neutral-50 text-neutral-400 hover:bg-neutral-100'
            }`}
          >
            <Icon size={13} />{label}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        <input
          type="number" inputMode="decimal" step="0.001" min="0"
          value={local.quantity ?? ''} placeholder="Кол-во"
          onChange={(e) => change('quantity', e.target.value || null)}
          onFocus={() => onLock(row.id)} onBlur={() => onUnlock(row.id)}
          className="w-full min-h-touch px-3 py-2 text-sm bg-neutral-50 border border-transparent rounded-xl outline-none focus:bg-white focus:border-primary/30 tabular [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
        />
        <div className="grid grid-cols-4 gap-1">
          {Object.entries(UNIT_LABELS).map(([u, lbl]) => (
            <button key={u} onClick={() => change('unit', u)}
              className={`min-h-touch text-xs py-2 rounded-xl border font-medium transition-all ${
                local.unit === u ? 'bg-primary text-white border-primary' : 'border-neutral-200 text-neutral-400 hover:border-primary/40'
              }`}
            >{lbl}</button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <input
          type="number" inputMode="decimal" step="0.01" min="0"
          value={local.price ?? ''} placeholder="Цена (сом)"
          onChange={(e) => change('price', e.target.value || null)}
          onFocus={() => onLock(row.id)} onBlur={() => onUnlock(row.id)}
          className="flex-1 min-h-touch px-3 py-2 text-sm bg-neutral-50 border border-transparent rounded-xl outline-none focus:bg-white focus:border-primary/30 tabular [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
        />
        <div className={`text-sm font-bold tabular px-3 py-2 rounded-xl min-w-[80px] text-right shrink-0 ${total != null ? 'bg-primary/5 text-primary' : 'text-neutral-300'}`}>
          {total != null ? `${total.toFixed(2)} с` : '—'}
        </div>
      </div>
    </div>
  )
})

// ── Desktop table row ─────────────────────────────────────────────────────────

const TableRow = memo(function TableRow({ row, onUpdate, onLock, onUnlock, lockedBy, flash, onLocalChange }) {
  const localRef = useRef(row)
  const [local, setLocal] = useState(row)
  const debounce = useRef(null)

  useEffect(() => {
    localRef.current = row
    setLocal(row)
  }, [row.updated_at])

  const change = (key, val) => {
    const next = { ...localRef.current, [key]: val }
    localRef.current = next
    setLocal(next)
    onLocalChange(row.id, next)
    clearTimeout(debounce.current)
    debounce.current = setTimeout(() => onUpdate(row.id, { [key]: val }), 500)
  }

  const total = calcTotal(local.quantity, local.price)
  const st = local.fulfillment_status
  const leftBorder = st === 'done' ? 'border-l-emerald-400' : st === 'failed' ? 'border-l-rose-400' : 'border-l-transparent'

  return (
    <tr className={`group border-l-2 transition-colors ${leftBorder} ${lockedBy ? 'bg-blue-50/40' : 'hover:bg-neutral-50'} ${flash ? 'bg-amber-50' : ''}`}>
      <td className="pl-4 pr-1 py-1.5 text-xs text-neutral-300 font-mono w-8 text-center select-none">{row.row_number}</td>
      <td className="px-1 py-1 w-64">
        <textarea
          value={local.item_name || ''}
          onChange={(e) => change('item_name', e.target.value)}
          onFocus={() => onLock(row.id)} onBlur={() => onUnlock(row.id)}
          placeholder="Наименование товара"
          rows={1}
          className="w-full px-2 py-1.5 text-sm border-0 bg-transparent rounded-lg outline-none focus:bg-white focus:ring-2 focus:ring-primary/20 resize-none"
          style={{ minHeight: '2rem' }}
        />
      </td>
      <td className="px-1 py-1 w-28">
        <div className="flex gap-0.5">
          {[
            { val: 'done',   icon: CheckCircle2, on: 'bg-emerald-500 text-white' },
            { val: 'failed', icon: XCircle,      on: 'bg-rose-500 text-white' },
            { val: 'empty',  icon: Circle,       on: 'bg-neutral-200 text-neutral-600' },
          ].map(({ val, icon: Icon, on }) => (
            <button key={val} onClick={() => change('fulfillment_status', val)}
              title={val === 'done' ? 'Выполнен' : val === 'failed' ? 'Не выполнен' : 'Нету'}
              className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${
                st === val ? on : 'text-neutral-300 hover:text-neutral-500 hover:bg-neutral-100'
              }`}
            >
              <Icon size={14} />
            </button>
          ))}
        </div>
      </td>
      <td className="px-1 py-1 w-24">
        <input
          type="number" inputMode="decimal" step="0.001" min="0"
          value={local.quantity ?? ''}
          onChange={(e) => change('quantity', e.target.value || null)}
          onFocus={() => onLock(row.id)} onBlur={() => onUnlock(row.id)}
          className="w-full px-2 py-1.5 text-sm text-right bg-transparent border border-transparent hover:border-neutral-200 focus:border-primary/40 focus:bg-white rounded-lg outline-none tabular [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
        />
      </td>
      <td className="px-1 py-1 w-36">
        <div className="flex gap-0.5">
          {Object.entries(UNIT_LABELS).map(([u, lbl]) => (
            <button key={u} onClick={() => change('unit', u)}
              className={`flex-1 text-xs py-1.5 rounded-lg border font-medium transition-all ${
                local.unit === u ? 'bg-primary text-white border-primary' : 'border-neutral-100 text-neutral-400 hover:border-primary/30 hover:text-primary'
              }`}
            >{lbl}</button>
          ))}
        </div>
      </td>
      <td className="px-1 py-1 w-28">
        <input
          type="number" inputMode="decimal" step="0.01" min="0"
          value={local.price ?? ''}
          onChange={(e) => change('price', e.target.value || null)}
          onFocus={() => onLock(row.id)} onBlur={() => onUnlock(row.id)}
          className="w-full px-2 py-1.5 text-sm text-right bg-transparent border border-transparent hover:border-neutral-200 focus:border-primary/40 focus:bg-white rounded-lg outline-none tabular [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
        />
      </td>
      <td className="pl-1 pr-4 py-1 w-28 text-right">
        <span className={`text-sm tabular font-semibold ${total != null ? 'text-primary' : 'text-neutral-200'}`}>
          {total != null ? total.toFixed(2) : ''}
        </span>
      </td>
    </tr>
  )
})

// ── Page nav ──────────────────────────────────────────────────────────────────

function PageNav({ current, total, onChange }) {
  if (total <= 1) return null
  return (
    <div className="flex items-center justify-center gap-3 py-3">
      <button onClick={() => onChange(current - 1)} disabled={current === 1}
        className="mobile-tap inline-flex items-center justify-center rounded-xl hover:bg-neutral-100 disabled:opacity-30 text-neutral-500 transition-colors">
        <ChevronLeft size={15} />
      </button>
      <span className="text-xs text-neutral-500 font-semibold tabular">
        Стр. {current} из {total}
      </span>
      <button onClick={() => onChange(current + 1)} disabled={current === total}
        className="mobile-tap inline-flex items-center justify-center rounded-xl hover:bg-neutral-100 disabled:opacity-30 text-neutral-500 transition-colors">
        <ChevronRight size={15} />
      </button>
    </div>
  )
}

// ── Main OrderEditor ──────────────────────────────────────────────────────────

export function OrderEditor() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const qc = useQueryClient()

  const [pdfLoading, setPdfLoading]   = useState(false)
  const [connected, setConnected]     = useState(false)
  const [locks, setLocks]             = useState({})
  const [flashRows, setFlashRows]     = useState({})
  const [showComplete, setShowComplete] = useState(false)
  const [showDeleteOrder, setShowDeleteOrder] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [searchQuery, setSearchQuery] = useState('')
  const [showSearch, setShowSearch]   = useState(false)

  // rowStats: instant summary state — updated synchronously from each row
  const [rowStats, setRowStats] = useState({})
  const flashTimersRef = useRef({})

  const [completionForm, setCompletionForm] = useState({
    sent_at: new Date().toISOString().slice(0, 10),
    payment_status: 'unpaid',
    supplier_name: '',
    buyer_name: '',
  })

  const orderId = id && id !== 'undefined' ? id : null

  const { data: order, isLoading, isError } = useQuery({
    queryKey: ['order', orderId],
    queryFn: () => getOrder(orderId).then((r) => r.data),
    enabled: !!orderId,
    staleTime: 60000,
  })

  // Initialize rowStats when order first loads
  useEffect(() => {
    if (!order?.rows?.length) return
    const init = {}
    order.rows.forEach((r) => {
      init[r.id] = {
        fulfillment_status: r.fulfillment_status,
        total: calcTotal(r.quantity, r.price),
      }
    })
    setRowStats(init)
  }, [order?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Pre-fill supplier/buyer from saved order data
  useEffect(() => {
    if (!order) return
    setCompletionForm((f) => ({
      ...f,
      supplier_name: order.supplier_name || '',
      buyer_name: order.buyer_name || '',
    }))
  }, [order?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Instant summary — derived from rowStats; falls back to order.rows on first render
  const { doneCount, totalAmount, progress } = useMemo(() => {
    const rows = order?.rows || []
    const hasStats = Object.keys(rowStats).length > 0
    let done = 0, amount = 0
    if (hasStats) {
      Object.values(rowStats).forEach(({ fulfillment_status, total }) => {
        if (fulfillment_status === 'done') {
          done++
          if (total != null) amount += total
        }
      })
    } else {
      rows.forEach((r) => {
        if (r.fulfillment_status === 'done') {
          done++
          const t = calcTotal(r.quantity, r.price)
          if (t != null) amount += t
        }
      })
    }
    return {
      doneCount: done,
      totalAmount: amount,
      progress: rows.length ? Math.round((done / rows.length) * 100) : 0,
    }
  }, [rowStats, order?.rows])

  const rowUpdateMutation = useMutation({
    mutationFn: ({ rowId, data }) => updateOrderRow(orderId, rowId, data),
  })

  const statusMutation = useMutation({
    mutationFn: (status) => updateOrder(orderId, { status }),
    onSuccess: (res) => {
      const newStatus = res.data.status
      qc.setQueryData(['order', orderId], (old) => old ? { ...old, status: newStatus } : old)
      // Instantly update ClientDetail list without waiting for unmount
      if (order?.client) {
        qc.setQueryData(['client-orders', String(order.client)], (old) => {
          if (!old) return old
          const list = old?.results || old
          const updated = list.map((o) => o.id === Number(orderId) ? { ...o, status: newStatus } : o)
          return Array.isArray(old) ? updated : { ...old, results: updated }
        })
      }
    },
  })

  const completeMutation = useMutation({
    mutationFn: (fd) => updateOrder(orderId, fd),
    onSuccess: () => {
      qc.setQueryData(['order', orderId], (old) => old ? { ...old, status: 'completed' } : old)
      setShowComplete(false)
    },
  })

  const deleteOrderMutation = useMutation({
    mutationFn: () => deleteOrder(orderId),
    onSuccess: () => {
      qc.invalidateQueries(['orders'])
      qc.invalidateQueries(['client-orders', String(order?.client)])
      navigate(`/clients/${order?.client}`)
    },
  })

  const { send } = useOrderWebSocket(orderId || '0', {
    onConnect:    () => setConnected(true),
    onDisconnect: () => setConnected(false),
    onMessage: useCallback((msg) => {
      if (msg.event === 'user:left') {
        // no-op (removed user panel)
      } else if (msg.event === 'row:lock' && msg.user_id !== user?.id) {
        setLocks((l) => ({ ...l, [msg.row_id]: msg.user_name }))
      } else if (msg.event === 'row:unlock') {
        setLocks((l) => { const n = { ...l }; delete n[msg.row_id]; return n })
      } else if (msg.event === 'row:updated' && msg.user_id !== user?.id) {
        // Surgical cache update — no HTTP refetch
        qc.setQueryData(['order', orderId], (old) => {
          if (!old) return old
          return {
            ...old,
            rows: old.rows.map((r) =>
              r.id === msg.row_id ? { ...r, ...msg.fields } : r
            ),
          }
        })
        // Also update rowStats for instant summary
        setRowStats((prev) => ({
          ...prev,
          [msg.row_id]: {
            fulfillment_status: msg.fields.fulfillment_status ?? prev[msg.row_id]?.fulfillment_status,
            total: msg.fields.total != null
              ? parseFloat(msg.fields.total)
              : calcTotal(msg.fields.quantity, msg.fields.price) ?? prev[msg.row_id]?.total,
          },
        }))
        setFlashRows((f) => ({ ...f, [msg.row_id]: true }))
        clearTimeout(flashTimersRef.current[msg.row_id])
        flashTimersRef.current[msg.row_id] = setTimeout(() => {
          setFlashRows((f) => { const n = { ...f }; delete n[msg.row_id]; return n })
        }, 800)
      } else if (msg.event === 'order:status') {
        qc.setQueryData(['order', orderId], (old) => old ? { ...old, status: msg.status } : old)
      }
    }, [orderId, user?.id, qc]),
  })

  // Called synchronously from each row on every change — no debounce
  const handleLocalChange = useCallback((rowId, fullState) => {
    setRowStats((prev) => ({
      ...prev,
      [rowId]: {
        fulfillment_status: fullState.fulfillment_status,
        total: calcTotal(fullState.quantity, fullState.price),
      },
    }))
  }, [])

  const handleRowUpdate = useCallback((rowId, fields) => {
    rowUpdateMutation.mutate({ rowId, data: fields })
    send({ event: 'row:update', row_id: rowId, fields })
  }, [send])

  const handleLock   = useCallback((rowId) => send({ event: 'row:lock',   row_id: rowId }), [send])
  const handleUnlock = useCallback((rowId) => send({ event: 'row:unlock', row_id: rowId }), [send])

  const handleStatusChange = (newStatus) => {
    statusMutation.mutate(newStatus)
    send({ event: 'order:status', status: newStatus })
  }

  const handleDownloadPdf = async () => {
    setPdfLoading(true)
    try {
      const res = await downloadPdf(orderId)
      const blob = new Blob([res.data], { type: 'application/pdf' })
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href = url
      a.download = `invoice_${orderId}_${new Date().toISOString().slice(0, 10)}.pdf`
      document.body.appendChild(a); a.click()
      document.body.removeChild(a); URL.revokeObjectURL(url)
    } finally {
      setPdfLoading(false)
    }
  }

  const handleComplete = (e) => {
    e.preventDefault()
    const fd = new FormData()
    fd.append('status', 'completed')
    fd.append('payment_status', completionForm.payment_status)
    if (completionForm.sent_at) fd.append('sent_at', completionForm.sent_at)
    fd.append('supplier_name', completionForm.supplier_name)
    fd.append('buyer_name', completionForm.buyer_name)
    completeMutation.mutate(fd)
    send({ event: 'order:status', status: 'completed' })
  }

  useEffect(() => {
    return () => {
      Object.values(flashTimersRef.current).forEach((t) => clearTimeout(t))
      flashTimersRef.current = {}
    }
  }, [])

  // On unmount: refresh client's order list so status changes (incl. auto new→in_progress) show instantly
  const clientIdRef = useRef(null)
  useEffect(() => {
    if (order?.client) clientIdRef.current = String(order.client)
  }, [order?.client])
  useEffect(() => {
    return () => {
      if (clientIdRef.current) {
        qc.invalidateQueries(['client-orders', clientIdRef.current])
      }
    }
  }, [qc])

  // ── Data ──
  // Keep hook order stable across loading/error states.
  const rows = order?.rows || []
  const perPage = order?.template_rows_per_page || 20
  const filteredRows = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return rows
    return rows.filter((r) =>
      String(r.row_number).includes(q.replace('#', '')) ||
      (r.item_name && r.item_name.toLowerCase().includes(q))
    )
  }, [rows, searchQuery])
  const totalPages = Math.max(1, Math.ceil(filteredRows.length / perPage))
  const safePage = Math.min(currentPage, totalPages)

  useEffect(() => {
    setCurrentPage(1)
  }, [searchQuery])

  const displayRows = useMemo(() => {
    return filteredRows.slice((safePage - 1) * perPage, safePage * perPage)
  }, [filteredRows, safePage, perPage])

  const isSearching = searchQuery.trim().length > 0
  const currentStatus = STATUS_OPTS.find((s) => s.val === order?.status) || STATUS_OPTS[0]

  // ── Guards ──
  if (!orderId) return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center p-6">
      <div className="w-14 h-14 bg-red-50 rounded-2xl flex items-center justify-center">
        <XCircle size={24} className="text-rose-400" />
      </div>
      <div className="font-semibold text-neutral-700">Заказ не найден</div>
      <button onClick={() => navigate(-1)} className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl text-sm font-medium">
        <ArrowLeft size={14} /> Назад
      </button>
    </div>
  )

  if (isLoading) return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
      <Loader2 size={26} className="text-primary animate-spin" />
      <div className="text-sm text-neutral-400">Загрузка заказа...</div>
    </div>
  )

  if (isError || !order) return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center p-6">
      <div className="w-14 h-14 bg-red-50 rounded-2xl flex items-center justify-center">
        <XCircle size={24} className="text-rose-400" />
      </div>
      <div className="font-semibold text-neutral-700">Ошибка загрузки</div>
      <button onClick={() => navigate(-1)} className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-xl text-sm font-medium">
        <ArrowLeft size={14} /> Назад
      </button>
    </div>
  )

  return (
    <div className="flex flex-col min-h-screen bg-neutral-50">

      {/* ── Header ── */}
      <div className="bg-white border-b border-neutral-100 px-3.5 md:px-6 py-2.5 sticky top-0 z-30 shadow-sm safe-top">
        <div className="flex items-center justify-between gap-2">

          {/* Left */}
          <div className="flex items-center gap-2 min-w-0 shrink">
            <Link to={`/clients/${order.client}`}
              className="mobile-tap inline-flex items-center justify-center rounded-xl hover:bg-neutral-100 text-neutral-400 hover:text-primary transition-colors shrink-0">
              <ArrowLeft size={18} />
            </Link>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-primary text-sm md:text-base truncate">
                  {order.client_brand || order.client_name}
                </span>
                <span className="text-[11px] text-neutral-400 bg-neutral-100 px-1.5 py-0.5 rounded-md font-mono shrink-0">
                  #{order.id}
                </span>
              </div>
              <div className="text-[11px] text-neutral-400">{formatDate(order.created_at)}</div>
            </div>
          </div>

          {/* Right */}
          <div className="flex items-center gap-1.5 shrink-0">

            {/* Connection dot — compact, only if disconnected */}
            {!connected && (
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" title="Нет соединения" />
            )}

            {/* Status */}
            {user?.is_owner ? (
              <div className="relative">
                <select
                  value={order.status}
                  onChange={(e) => handleStatusChange(e.target.value)}
                  className="appearance-none pl-6 pr-6 py-1.5 rounded-xl border border-neutral-200 text-xs font-semibold outline-none focus:border-primary bg-white cursor-pointer"
                >
                  {STATUS_OPTS.map((s) => <option key={s.val} value={s.val}>{s.label}</option>)}
                </select>
                <span className={`absolute left-2 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full ${currentStatus.dot}`} />
                <ChevronDown size={11} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none" />
              </div>
            ) : (
              <span className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold border ${
                order.status === 'new'         ? 'bg-blue-50 text-blue-700 border-blue-100' :
                order.status === 'in_progress' ? 'bg-amber-50 text-amber-700 border-amber-100' :
                                                 'bg-emerald-50 text-emerald-700 border-emerald-100'
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${currentStatus.dot}`} />
                {currentStatus.label}
              </span>
            )}

            {user?.is_owner && (
              <button onClick={() => setShowComplete(true)}
                className="hidden sm:inline-flex min-h-touch px-3 bg-accent text-white rounded-xl text-xs font-bold hover:bg-amber-500 transition-colors items-center">
                Завершить
              </button>
            )}
            {user?.is_owner && (
              <button onClick={() => setShowComplete(true)}
                className="sm:hidden mobile-tap inline-flex items-center justify-center rounded-xl bg-accent text-white hover:bg-amber-500 transition-colors"
                title="Завершить заказ">
                <CheckCircle2 size={14} />
              </button>
            )}

            <button onClick={handleDownloadPdf} disabled={pdfLoading}
              className="mobile-tap inline-flex items-center justify-center gap-1 px-2.5 rounded-xl border border-neutral-200 text-xs font-medium text-neutral-600 hover:border-primary hover:text-primary hover:bg-primary/5 transition-all disabled:opacity-50">
              {pdfLoading ? <Loader2 size={12} className="animate-spin" /> : <FileDown size={12} />}
              <span className="hidden sm:inline">PDF</span>
            </button>

            {user?.is_owner && (
              <button
                onClick={() => setShowDeleteOrder(true)}
                className="mobile-tap inline-flex items-center justify-center rounded-xl border border-neutral-200 text-neutral-400 hover:text-red-500 hover:border-red-200 hover:bg-red-50 transition-colors"
                title="Удалить заказ"
              >
                <Trash2 size={15} />
              </button>
            )}

            {/* Search — desktop inline, mobile toggle */}
            <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-neutral-200 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/10 bg-white transition-all w-44">
              <Search size={13} className="text-neutral-400 shrink-0" />
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Поиск строки..."
                className="flex-1 text-xs outline-none bg-transparent placeholder:text-neutral-300 min-w-0"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')}>
                  <X size={11} className="text-neutral-400 hover:text-neutral-600" />
                </button>
              )}
            </div>

            <button
              onClick={() => { setShowSearch(s => !s); if (showSearch) setSearchQuery('') }}
              className={`md:hidden mobile-tap inline-flex items-center justify-center rounded-xl border transition-colors ${
                showSearch || searchQuery ? 'border-primary text-primary bg-primary/5' : 'border-neutral-200 text-neutral-500'
              }`}
            >
              {showSearch || searchQuery ? <X size={15} /> : <Search size={15} />}
            </button>
          </div>
        </div>

        {/* Progress bar */}
        <div className="mt-2.5 flex items-center gap-3">
          <div className="flex-1 bg-neutral-100 rounded-full h-1">
            <div
              className={`h-1 rounded-full transition-all duration-300 ${progress === 100 ? 'bg-emerald-500' : 'bg-amber-400'}`}
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className="text-xs text-neutral-500 tabular shrink-0 font-medium">
            {doneCount}/{rows.length} · {formatMoney(totalAmount)} сом
          </span>
        </div>
      </div>

      {/* Mobile search bar */}
      {showSearch && (
        <div className="md:hidden bg-white border-b border-neutral-100 px-4 py-2">
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl border border-neutral-200 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/10 bg-neutral-50">
            <Search size={14} className="text-neutral-400 shrink-0" />
            <input
              autoFocus
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Поиск по номеру или названию..."
              className="flex-1 text-sm outline-none bg-transparent placeholder:text-neutral-400"
            />
          </div>
        </div>
      )}


      {/* ── Desktop table ── */}
      <div className="hidden md:block flex-1 overflow-auto bg-white mx-4 mt-4 rounded-2xl border border-neutral-100 shadow-panel">
        <table className="w-full min-w-[980px] text-sm border-separate border-spacing-0">
          <thead className="sticky top-0 z-20 bg-white">
            <tr className="text-[11px] text-neutral-400 uppercase tracking-widest border-b border-neutral-100">
              <th className="pl-4 pr-1 py-3 text-center font-medium w-8">№</th>
              <th className="px-1 py-3 text-left font-medium w-64">Наименование</th>
              <th className="px-1 py-3 text-left font-medium w-28">Статус</th>
              <th className="px-1 py-3 text-right font-medium w-24">Кол-во</th>
              <th className="px-1 py-3 text-center font-medium w-36">Ед.</th>
              <th className="px-1 py-3 text-right font-medium w-28">Цена</th>
              <th className="pl-1 pr-4 py-3 text-right font-medium w-28">Итог</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {displayRows.map((row) => (
              <TableRow
                key={row.id} row={row}
                onUpdate={handleRowUpdate} onLock={handleLock} onUnlock={handleUnlock}
                onLocalChange={handleLocalChange}
                lockedBy={locks[row.id]} flash={flashRows[row.id]}
              />
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-primary/5 border-t-2 border-primary/10">
              <td colSpan={6} className="pl-4 pr-3 py-3 text-right text-sm font-semibold text-primary">
                Итого по выполненным:
              </td>
              <td className="pr-4 py-3 text-right text-base font-black text-primary tabular">
                {formatMoney(totalAmount)}
              </td>
            </tr>
          </tfoot>
        </table>
        {!isSearching && <PageNav current={safePage} total={totalPages} onChange={setCurrentPage} />}
        {isSearching && displayRows.length === 0 && (
          <div className="text-center py-12">
            <div className="text-neutral-400 text-sm">Ничего не найдено по запросу «{searchQuery}»</div>
          </div>
        )}
        {isSearching && displayRows.length > 0 && (
          <div className="text-center py-2 text-xs text-neutral-400">
            Найдено {filteredRows.length} строк
          </div>
        )}
      </div>

      {/* ── Mobile cards ── */}
      <div className="md:hidden p-3 space-y-2" style={{ paddingBottom: 'calc(6rem + env(safe-area-inset-bottom, 0px))' }}>
        {displayRows.map((row) => (
          <MobileRow
            key={row.id} row={row}
            onUpdate={handleRowUpdate} onLock={handleLock} onUnlock={handleUnlock}
            onLocalChange={handleLocalChange}
            lockedBy={locks[row.id]} flash={flashRows[row.id]}
          />
        ))}
        {!isSearching && <PageNav current={safePage} total={totalPages} onChange={(p) => { setCurrentPage(p); window.scrollTo(0, 0) }} />}
        {isSearching && displayRows.length === 0 && (
          <div className="text-center py-10 text-sm text-neutral-400">
            Ничего не найдено
          </div>
        )}
        {isSearching && filteredRows.length > 0 && (
          <div className="text-center py-2 text-xs text-neutral-400">
            Найдено {filteredRows.length} строк
          </div>
        )}
        {/* Summary card */}
        <div className="bg-gradient-to-r from-primary to-primary-500 rounded-2xl p-4 text-white mt-1">
          <div className="text-xs text-white/60 mb-0.5">Итого (выполненные)</div>
          <div className="text-2xl font-black tabular">{formatMoney(totalAmount)} сом</div>
          <div className="text-xs text-white/50 mt-1">{doneCount} из {rows.length} строк · {progress}%</div>
        </div>
      </div>

      {/* ── Delete Order Modal ── */}
      <Modal open={showDeleteOrder} onClose={() => setShowDeleteOrder(false)} title="Удалить заказ?">
        <div className="space-y-4">
          <p className="text-sm text-neutral-600">
            Вы уверены, что хотите удалить заказ{' '}
            <span className="font-semibold text-primary">#{order?.id}</span>{' '}
            клиента{' '}
            <span className="font-semibold text-primary">{order?.client_brand || order?.client_name}</span>?{' '}
            Это действие нельзя отменить.
          </p>
          <div className="flex gap-3 justify-end">
            <button
              onClick={() => setShowDeleteOrder(false)}
              className="min-h-touch px-4 rounded-xl border border-neutral-200 text-sm font-medium text-neutral-600 hover:bg-neutral-50 transition-colors"
            >
              Отмена
            </button>
            <button
              onClick={() => deleteOrderMutation.mutate()}
              disabled={deleteOrderMutation.isLoading}
              className="min-h-touch px-4 bg-red-500 text-white rounded-xl text-sm font-medium hover:bg-red-600 transition-colors disabled:opacity-60 flex items-center gap-2"
            >
              {deleteOrderMutation.isLoading && <Loader2 size={13} className="animate-spin" />}
              Удалить
            </button>
          </div>
        </div>
      </Modal>

      {/* ── Completion Modal ── */}
      <Modal open={showComplete} onClose={() => setShowComplete(false)} title="Завершение заказа" size="sm">
        <form onSubmit={handleComplete} className="space-y-4">
          <div className="bg-gradient-to-br from-primary to-primary-500 rounded-2xl p-4 text-white">
            <div className="text-xs text-white/60 mb-0.5">Сумма по выполненным</div>
            <div className="text-3xl font-black tabular">{formatMoney(totalAmount)} <span className="text-base font-medium opacity-70">сом</span></div>
            <div className="text-xs text-white/50 mt-1">{doneCount} из {rows.length} строк · {progress}%</div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-semibold text-neutral-700 block mb-1.5">Поставщик</label>
              <input type="text" value={completionForm.supplier_name}
                onChange={(e) => setCompletionForm((f) => ({ ...f, supplier_name: e.target.value }))}
                placeholder="ИП"
                className="w-full px-3 py-2.5 rounded-xl border border-neutral-200 text-sm outline-none focus:border-primary"
              />
            </div>
            <div>
              <label className="text-sm font-semibold text-neutral-700 block mb-1.5">Покупатель</label>
              <input type="text" value={completionForm.buyer_name}
                onChange={(e) => setCompletionForm((f) => ({ ...f, buyer_name: e.target.value }))}
                placeholder={order?.client_brand || order?.client_name || ''}
                className="w-full px-3 py-2.5 rounded-xl border border-neutral-200 text-sm outline-none focus:border-primary"
              />
            </div>
          </div>

          <div>
            <label className="text-sm font-semibold text-neutral-700 block mb-1.5">Дата отправки</label>
            <input type="date" value={completionForm.sent_at}
              onChange={(e) => setCompletionForm((f) => ({ ...f, sent_at: e.target.value }))}
              className="w-full px-3 py-2.5 rounded-xl border border-neutral-200 text-sm outline-none focus:border-primary"
            />
          </div>

          <div>
            <label className="text-sm font-semibold text-neutral-700 block mb-2">Статус оплаты</label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { val: 'paid',   label: '✓ Оплачен',    on: 'bg-success text-white border-success' },
                { val: 'unpaid', label: '✗ Не оплачен', on: 'bg-neutral-200 text-neutral-700 border-neutral-200' },
              ].map(({ val, label, on }) => (
                <button key={val} type="button"
                  onClick={() => setCompletionForm((f) => ({ ...f, payment_status: val }))}
                  className={`py-2.5 rounded-xl border-2 text-sm font-semibold transition-all ${
                    completionForm.payment_status === val ? on : 'border-neutral-200 text-neutral-400 hover:border-neutral-300'
                  }`}
                >{label}</button>
              ))}
            </div>
          </div>

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={() => setShowComplete(false)}
              className="flex-1 py-2.5 rounded-xl border border-neutral-200 text-sm font-medium text-neutral-600 hover:bg-neutral-50">
              Отмена
            </button>
            <button type="submit" disabled={completeMutation.isLoading}
              className="flex-1 py-2.5 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary-500 disabled:opacity-60 flex items-center justify-center gap-2">
              {completeMutation.isLoading && <Loader2 size={13} className="animate-spin" />}
              Завершить заказ
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
