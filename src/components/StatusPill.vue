<script setup>
import { computed } from 'vue'
const props = defineProps({ status: String })
const tone = computed(() => ({
  Confirmed: 'bg-brand-50 text-brand-800',
  Active: 'bg-brand-50 text-brand-800',
  Repaid: 'bg-sky-50 text-sky-800',
  Success: 'bg-brand-50 text-brand-800',
  Pending: 'bg-amber-50 text-amber-800',
  Initiated: 'bg-amber-50 text-amber-800',
  Rejected: 'bg-red-50 text-red-700',
  Failed: 'bg-red-50 text-red-700',
  Suspended: 'bg-red-50 text-red-700',
  Cancelled: 'bg-black/5 text-ink-soft',
  Left: 'bg-black/5 text-ink-soft',
}[props.status] || 'bg-black/5 text-ink-soft'))
</script>

<template>
  <span class="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-bold" :class="tone">{{ status }}</span>
</template>
