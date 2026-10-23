const formatters = {}

/** ₦20,000 (no .00 on whole amounts), ₦269.04 when there are kobo, ₦1.2M when compact. */
export function money(amount, currency = 'NGN', { compact = false } = {}) {
  const raw = Number(amount) || 0
  // A stray kobo shouldn't read as "-₦0"
  const n = Math.abs(raw) < (compact ? 0.5 : 0.005) ? 0 : raw
  const whole = Math.abs(n - Math.round(n)) < 0.005
  const key = `${currency}|${compact}|${whole}`
  if (!formatters[key]) {
    try {
      formatters[key] = new Intl.NumberFormat('en-NG', {
        style: 'currency',
        currency,
        currencyDisplay: 'narrowSymbol',
        notation: compact ? 'compact' : 'standard',
        minimumFractionDigits: compact || whole ? 0 : 2,
        maximumFractionDigits: compact ? 1 : whole ? 0 : 2,
      })
    } catch {
      formatters[key] = { format: (x) => `${currency} ${Number(x).toLocaleString()}` }
    }
  }
  return formatters[key].format(n)
}

const asDate = (value) => (value instanceof Date ? value : new Date(String(value).replace(' ', 'T').slice(0, 19)))

export function date(value, opts = { day: 'numeric', month: 'short', year: 'numeric' }) {
  if (!value) return '—'
  const d = asDate(value)
  return isNaN(d) ? value : d.toLocaleDateString('en-GB', opts)
}

export const shortDate = (value) => date(value, { day: 'numeric', month: 'short' })

/** "today", "tomorrow", "in 5 days", "3 days ago" for due dates */
export function dueIn(value) {
  if (!value) return ''
  const d = asDate(value)
  const start = new Date()
  start.setHours(0, 0, 0, 0)
  const days = Math.round((d - start) / 86400000)
  if (days === 0) return 'today'
  if (days === 1) return 'tomorrow'
  if (days === -1) return 'yesterday'
  if (days > 1 && days < 14) return `in ${days} days`
  if (days < -1 && days > -14) return `${-days} days ago`
  return `on ${shortDate(value)}`
}

export function relative(value) {
  if (!value) return ''
  const diff = (Date.now() - asDate(value).getTime()) / 1000
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  if (diff < 86400 * 7) return `${Math.floor(diff / 86400)}d ago`
  return date(value)
}

export function initials(name = '') {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join('') || '?'
}

export const firstName = (name = '') => name.trim().split(/\s+/)[0] || ''

export function today() {
  const d = new Date()
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10)
}

/** Name of the contribution period that starts on `value`: "October", "Q4 2026", "week of 19 Oct" */
export function periodName(value, frequency) {
  if (!value) return ''
  const d = asDate(value)
  if (frequency === 'Weekly') return `week of ${shortDate(d)}`
  if (frequency === 'Quarterly') return `Q${Math.floor(d.getMonth() / 3) + 1} ${d.getFullYear()}`
  const sameYear = d.getFullYear() === new Date().getFullYear()
  return d.toLocaleDateString('en-GB', sameYear ? { month: 'long' } : { month: 'long', year: 'numeric' })
}

/** "Paid up to November" from the paid_through (end) date */
export function paidThroughLabel(value, frequency) {
  if (!value) return ''
  const d = asDate(value)
  if (frequency === 'Weekly') return `Paid up to ${shortDate(d)}`
  if (frequency === 'Quarterly') return `Paid up to Q${Math.floor(d.getMonth() / 3) + 1} ${d.getFullYear()}`
  const sameYear = d.getFullYear() === new Date().getFullYear()
  return `Paid up to ${d.toLocaleDateString('en-GB', sameYear ? { month: 'long' } : { month: 'long', year: 'numeric' })}`
}

export const periodWord = (frequency, n = 1) =>
  ({ Weekly: 'week', Monthly: 'month', Quarterly: 'quarter' }[frequency] || 'period') + (n === 1 ? '' : 's')

/** International digits for wa.me links; assumes Nigeria for local 0XXXXXXXXXX numbers. */
export function waNumber(phone) {
  let digits = String(phone || '').replace(/\D/g, '')
  if (!digits) return ''
  if (digits.length === 11 && digits.startsWith('0')) digits = '234' + digits.slice(1)
  return digits
}

export function whatsappLink(phone, text) {
  const n = waNumber(phone)
  return `https://wa.me/${n}?text=${encodeURIComponent(text)}`
}

export const appUrl = (path = '') => `${location.origin}${path}`

// Paystack's local fee, as set in Cooperative360 Settings, in words.
export function feeRule(fees, currency) {
  if (!fees) return ''
  const flat = fees.flat ? ` + ${money(fees.flat, currency)}` : ''
  const waived = fees.flat && fees.flat_waived_below ? ` (no ${money(fees.flat, currency)} under ${money(fees.flat_waived_below, currency)})` : ''
  const cap = fees.cap ? `, never more than ${money(fees.cap, currency)}` : ''
  return `Paystack charges ${fees.percent}%${flat}${waived}${cap}`
}

/** Accounting figure for report columns: 12,345.00, and (12,345.00) when negative. */
export function figure(amount) {
  const n = Number(amount) || 0
  if (Math.abs(n) < 0.005) return '–'
  const text = Math.abs(n).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return n < 0 ? `(${text})` : text
}

/** yyyy-mm-dd for date inputs. */
export const isoDate = (d) => {
  const x = d instanceof Date ? d : new Date(String(d).slice(0, 10) + 'T00:00:00')
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`
}

/** "Sat 7 Nov, 10:00 am" for meeting times (site and members share Nigeria's time zone). */
export const dateTime = (value) => date(value, { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })

/** A server datetime as the value of an <input type="datetime-local">. */
export const localInput = (value) => (value ? String(value).replace(' ', 'T').slice(0, 16) : '')
