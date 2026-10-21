<script setup>
import { ref, computed, onMounted } from 'vue'
import * as api from '../api'
import { current, currency } from '../store'
import { money } from '../format'
import PageHeader from '../components/PageHeader.vue'
import ActivityRow from '../components/ActivityRow.vue'
import Loader from '../components/Loader.vue'
import ErrorBox from '../components/ErrorBox.vue'

const data = ref(null)
const error = ref('')
const filter = ref('All')
const filters = [
  { key: 'All', label: 'All' },
  { key: 'Contribution', label: 'Savings' },
  { key: 'Loan', label: 'Loans' },
  { key: 'Repayment', label: 'Repayments' },
]
const groups = computed(() => {
  const out = []
  for (const e of data.value?.entries || []) {
    if (filter.value !== 'All' && e.type !== filter.value) continue
    const d = new Date(String(e.date))
    const label = d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
    let g = out[out.length - 1]
    if (!g || g.label !== label) out.push((g = { label, entries: [] }))
    g.entries.push(e)
  }
  return out
})

onMounted(async () => {
  try { data.value = await api.get('coop.get_statement', { cooperative: current.value.cooperative }) } catch (e) { error.value = e.message }
})
</script>

<template>
  <div>
    <PageHeader title="Activity" :subtitle="current?.cooperative_name" />
    <div class="px-5 pb-6">
      <ErrorBox :message="error" />
      <Loader v-if="!data && !error" />
      <template v-if="data">
        <div class="card grid grid-cols-3 divide-x divide-line/[0.07] py-4 text-center">
          <div><p class="text-xs text-ink-soft">Saved</p><p class="money mt-0.5 text-lg">{{ money(data.balances.total_contributed, currency, { compact: true }) }}</p></div>
          <div><p class="text-xs text-ink-soft">Repaid</p><p class="money mt-0.5 text-lg">{{ money(data.balances.total_repaid, currency, { compact: true }) }}</p></div>
          <div><p class="text-xs text-ink-soft">Owing</p><p class="money mt-0.5 text-lg">{{ money(data.balances.loan_outstanding, currency, { compact: true }) }}</p></div>
        </div>
        <div class="no-scrollbar -mx-5 mt-5 flex gap-2 overflow-x-auto px-5">
          <button v-for="f in filters" :key="f.key" class="shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition"
            :class="filter === f.key ? 'bg-forest-800 text-white' : 'border border-line/12 bg-card text-ink-soft'" @click="filter = f.key">
            {{ f.label }}
          </button>
        </div>
        <section v-for="g in groups" :key="g.label" class="mt-6">
          <h2 class="px-1 text-sm font-semibold text-ink-soft">{{ g.label }}</h2>
          <div class="card mt-2 px-4 py-1">
            <ActivityRow v-for="e in g.entries" :key="e.doctype + e.name" :entry="e" :currency="currency" />
          </div>
        </section>
        <div v-if="!groups.length" class="mt-10 text-center">
          <p class="font-semibold">Nothing here yet</p>
          <p class="mt-1 text-sm text-ink-soft">Payments and loans will show up as they happen.</p>
        </div>
      </template>
    </div>
  </div>
</template>
