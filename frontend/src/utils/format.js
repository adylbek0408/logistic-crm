export const formatDate = (iso) => {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('ru-RU', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  })
}

export const formatMoney = (v) => {
  if (v == null) return '—'
  return Number(v).toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export const STATUS_LABELS = {
  new: 'Новый',
  in_progress: 'В процессе',
  completed: 'Завершён',
}

export const STATUS_COLORS = {
  new: 'bg-blue-100 text-blue-700',
  in_progress: 'bg-amber-100 text-amber-700',
  completed: 'bg-emerald-100 text-emerald-700',
}

export const STATUS_BORDER = {
  new: 'border-l-blue-400',
  in_progress: 'border-l-amber-400',
  completed: 'border-l-emerald-400',
}

export const PAYMENT_LABELS = {
  paid: 'Оплачен',
  unpaid: 'Не оплачен',
}

export const FULFILLMENT_COLORS = {
  done: '#10B981',
  failed: '#F43F5E',
  empty: '#9CA3AF',
}

export const initials = (name = '') =>
  name.split(' ').map((w) => w[0] || '').join('').toUpperCase().slice(0, 2)
