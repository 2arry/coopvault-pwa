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
const filters = ['All', 'Contribution', 'Loan', 'Repayment']
const entries = computed(() => (data.value?.entries || []).filter((e) => filter.value === 'All' || e.type === filter.value))

onMounted(async () => {
  try { data.value = await api.get('coop.get_statement', { cooperative: current.value.cooperative }) } catch (e) { error.value = e.message }
})
</script>

<template>
  <div>
    <PageHeader title="History" :subtitle="current?.cooperative_name" />
    <div class="px-5 pb-6">
      <ErrorBox :message="error" />
      <Loader v-if="!data && !error" />
      <template v-if="data">
        <div class="card grid grid-cols-3 divide-x divide-black/5 py-3 text-center">
          <div><p class="text-[11px] text-ink-soft">Saved</p><p class="num text-sm font-bold">{{ money(data.balances.total_contributed, currency, { compact: true }) }}</p></div>
          <div><p class="text-[11px] text-ink-soft">Repaid</p><p class="num text-sm font-bold">{{ money(data.balances.total_repaid, currency, { compact: true }) }}</p></div>
          <div><p class="text-[11px] text-ink-soft">Owing</p><p class="num text-sm font-bold">{{ money(data.balances.loan_outstanding, currency, { compact: true }) }}</p></div>
        </div>
        <div class="-mx-5 mt-4 flex gap-2 overflow-x-auto px-5">
          <button v-for="f in filters" :key="f" class="shrink-0 rounded-full px-3.5 py-1.5 text-sm font-semibold"
            :class="filter === f ? 'bg-ink text-white' : 'bg-white text-ink-soft border border-black/10'" @click="filter = f">
            {{ f === 'All' ? 'All' : f + 's' }}
          </button>
        </div>
        <div v-if="entries.length" class="card mt-4 divide-y divide-black/5 px-4">
          <ActivityRow v-for="e in entries" :key="e.doctype + e.name" :entry="e" :currency="currency" />
        </div>
        <p v-else class="mt-8 text-center text-sm text-ink-soft">Nothing here yet.</p>
      </template>
    </div>
  </div>
</template>
