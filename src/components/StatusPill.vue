<script setup>
import { computed } from 'vue'
const props = defineProps({ status: String, label: String })
const tone = computed(() => ({
  Confirmed: 'bg-pos-soft text-pos',
  Active: 'bg-pos-soft text-pos',
  Success: 'bg-pos-soft text-pos',
  Assigned: 'bg-pos-soft text-pos',
  Repaid: 'bg-info-soft text-info',
  Completed: 'bg-pos-soft text-pos',
  Sent: 'bg-brand-soft text-brand-text',
  Reversed: 'bg-neg-soft text-neg',
  Refunded: 'bg-neg-soft text-neg',
  Disputed: 'bg-warn-soft text-warn',
  Pending: 'bg-warn-soft text-warn',
  Requested: 'bg-warn-soft text-warn',
  Initiated: 'bg-warn-soft text-warn',
  Overdue: 'bg-neg-soft text-neg',
  Rejected: 'bg-neg-soft text-neg',
  Failed: 'bg-neg-soft text-neg',
  Suspended: 'bg-neg-soft text-neg',
  Posted: 'bg-pos-soft text-pos',
  Approved: 'bg-info-soft text-info',
  Draft: 'bg-warn-soft text-warn',
  Cancelled: 'bg-line/[0.07] text-ink-soft',
  Unmatched: 'bg-warn-soft text-warn',
}[props.status] || 'bg-line/[0.07] text-ink-soft'))
const text = computed(() => props.label || ({ Pending: 'Awaiting approval', Approved: 'Approved, to be sent', Initiated: 'Processing', Sent: 'On its way' }[props.status] || props.status))
</script>

<template>
  <span class="inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-bold" :class="tone">{{ text }}</span>
</template>
