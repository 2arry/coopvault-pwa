<script setup>
// Big, friendly amount input with the currency symbol and optional quick-pick chips.
import { computed } from 'vue'
import { money } from '../format'

const model = defineModel()
const props = defineProps({
  currency: { type: String, default: 'NGN' },
  label: { type: String, default: 'Amount' },
  chips: { type: Array, default: () => [] }, // [{ label, value }]
  invalid: Boolean,
  id: { type: String, default: 'amount' },
})
const symbol = computed(() => money(0, props.currency).replace(/[\d.,\s]/g, '') || props.currency)
</script>

<template>
  <div>
    <label class="label" :for="id">{{ label }}</label>
    <div class="flex items-center gap-2 rounded-3xl border bg-card px-5 py-3.5 transition focus-within:ring-4"
      :class="invalid ? 'border-neg/60 focus-within:ring-neg/15' : 'border-line/15 focus-within:border-brand-text focus-within:ring-brand-text/15'">
      <span class="money text-3xl text-ink-faint">{{ symbol }}</span>
      <input :id="id" v-model="model" type="number" inputmode="decimal" min="0" step="0.01" placeholder="0"
        class="money w-full min-w-0 bg-transparent text-[40px] font-medium leading-none text-ink outline-none placeholder:text-ink-faint/60" />
    </div>
    <div v-if="chips.length" class="no-scrollbar -mx-1 mt-3 flex gap-2 overflow-x-auto px-1">
      <button v-for="c in chips" :key="c.label" type="button"
        class="shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-semibold transition"
        :class="Number(model) === Number(c.value) ? 'border-brand-text/40 bg-brand-soft text-brand-text' : 'border-line/12 bg-card text-ink-soft hover:border-line/25'"
        @click="model = c.value">
        {{ c.label }}
      </button>
    </div>
  </div>
</template>
