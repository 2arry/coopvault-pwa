const formatters = {}

export function money(amount, currency = 'NGN', { compact = false } = {}) {
  const key = currency + compact
  if (!formatters[key]) {
    try {
      formatters[key] = new Intl.NumberFormat('en-NG', {
        style: 'currency',
        currency,
        maximumFractionDigits: compact ? 1 : 2,
        minimumFractionDigits: compact ? 0 : 2,
        notation: compact ? 'compact' : 'standard',
      })
    } catch {
      formatters[key] = { format: (n) => `${currency} ${Number(n).toLocaleString()}` }
    }
  }
  return formatters[key].format(Number(amount) || 0)
}

export function date(value, opts = { day: 'numeric', month: 'short', year: 'numeric' }) {
  if (!value) return '—'
  const d = new Date(String(value).replace(' ', 'T'))
  return isNaN(d) ? value : d.toLocaleDateString('en-GB', opts)
}

export function relative(value) {
  if (!value) return ''
  const d = new Date(String(value).replace(' ', 'T'))
  const diff = (Date.now() - d.getTime()) / 1000
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)}d ago`
  return date(value)
}

export function initials(name = '') {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join('') || '?'
}

export function today() {
  const d = new Date()
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10)
}
