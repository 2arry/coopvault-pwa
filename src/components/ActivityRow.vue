<script setup>
import { computed } from 'vue'
import { money, date } from '../format'
import Icon from './Icon.vue'
import StatusPill from './StatusPill.vue'

const props = defineProps({ entry: Object, currency: String })
const meta = computed(() => ({
  Contribution: { icon: 'arrowDown', tone: 'bg-brand-50 text-brand-700', label: 'Contribution' },
  Loan: { icon: 'arrowUp', tone: 'bg-amber-50 text-amber-700', label: 'Loan' },
  Repayment: { icon: 'check', tone: 'bg-sky-50 text-sky-700', label: 'Loan repayment' },
}[props.entry.type]))
const link = computed(() => props.entry.type === 'Loan' ? `/loans/${props.entry.name}` : props.entry.loan ? `/loans/${props.entry.loan}` : null)
</script>

<template>
  <component :is="link ? 'RouterLink' : 'div'" :to="link" class="flex items-center gap-3 py-3">
    <div class="rounded-full p-2" :class="meta.tone"><Icon :name="meta.icon" :size="18" /></div>
    <div class="min-w-0 flex-1">
      <p class="truncate text-sm font-semibold">{{ meta.label }}</p>
      <p class="text-xs text-ink-soft">{{ date(entry.date) }}<span v-if="entry.method"> · {{ entry.method }}</span></p>
    </div>
    <div class="text-right">
      <p class="num text-sm font-bold" :class="entry.status === 'Rejected' ? 'text-ink-faint line-through' : ''">{{ money(entry.amount, currency) }}</p>
      <StatusPill v-if="!['Confirmed', 'Active'].includes(entry.status)" :status="entry.status" />
    </div>
  </component>
</template>
