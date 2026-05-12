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

export const initials = (name = '') =>
  name.split(' ').map((w) => w[0] || '').join('').toUpperCase().slice(0, 2)
