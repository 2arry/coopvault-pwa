<script setup>
import { computed } from 'vue'
import { money, date } from '../format'
import Icon from './Icon.vue'
import StatusPill from './StatusPill.vue'

const props = defineProps({ entry: Object, currency: String, showName: String })
const meta = computed(() => ({
  Contribution: { icon: 'arrowDown', tone: 'bg-pos-soft text-pos', label: 'Saved', sign: '+' },
  Loan: { icon: 'arrowUp', tone: 'bg-accent-soft text-accent-text', label: 'Borrowed', sign: '' },
  Repayment: { icon: 'check', tone: 'bg-info-soft text-info', label: 'Repaid loan', sign: '' },
  Withdrawal: { icon: 'arrowUp', tone: 'bg-brand-soft text-brand-text', label: 'Took out savings', sign: '−' },
  'Share-out': { icon: 'sparkle', tone: 'bg-pos-soft text-pos', label: 'Share of surplus', sign: '+' },
}[props.entry.type]))
const link = computed(() => {
  const e = props.entry
  if (e.type === 'Loan') return `/loans/${e.name}`
  if (e.type === 'Withdrawal') return `/withdrawals/${e.name}`
  if (e.type === 'Share-out') return `/share-out/${e.name}`
  return `/receipt/${encodeURIComponent(e.doctype)}/${encodeURIComponent(e.name)}`
})
// Voluntary savings name their product ("Saved to Christmas savings")
const label = computed(() => {
  const p = props.entry.product
  if (!p) return meta.value.label
  return props.entry.type === 'Withdrawal' ? `Took out of ${p}` : `Saved to ${p}`
})
const settled = computed(() => ['Confirmed', 'Active', 'Repaid', 'Completed'].includes(props.entry.status))
const methodLabel = (m) => ({ Paystack: 'Online', 'Bank Transfer': 'Transfer', 'Opening Balance': 'Opening balance' }[m] || m)
</script>

<template>
  <RouterLink :to="link" class="-mx-2 flex items-center gap-3 rounded-2xl px-2 py-3 transition hover:bg-line/[0.03]">
    <div class="grid h-10 w-10 place-items-center rounded-2xl" :class="settled ? meta.tone : 'bg-line/[0.06] text-ink-faint'">
      <Icon :name="meta.icon" :size="18" />
    </div>
    <div class="min-w-0 flex-1">
      <p class="truncate text-[15px] font-semibold">{{ showName ? `${showName} · ${label.toLowerCase()}` : label }}</p>
      <p class="truncate text-xs text-ink-soft">{{ date(entry.date, { day: 'numeric', month: 'short' }) }}<span v-if="entry.method"> · {{ methodLabel(entry.method) }}</span></p>
    </div>
    <div class="text-right">
      <p class="num text-[15px] font-semibold" :class="[['Rejected', 'Cancelled', 'Reversed'].includes(entry.status) ? 'text-ink-faint line-through' : '', meta.sign === '+' && settled ? 'text-pos' : '']">
        {{ meta.sign === '+' && settled ? meta.sign : '' }}{{ money(entry.amount, currency) }}
      </p>
      <StatusPill v-if="!settled" :status="entry.status" />
    </div>
  </RouterLink>
</template>
