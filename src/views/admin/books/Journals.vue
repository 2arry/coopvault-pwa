<script setup>
import { ref, watch, onMounted } from 'vue'
import * as api from '../../../api'
import { current, currency } from '../../../store'
import { money, date } from '../../../format'
import PageHeader from '../../../components/PageHeader.vue'
import Loader from '../../../components/Loader.vue'
import ErrorBox from '../../../components/ErrorBox.vue'
import StatusPill from '../../../components/StatusPill.vue'
import Icon from '../../../components/Icon.vue'

const FILTERS = [
  { key: '', label: 'All' },
  { key: 'Draft', label: 'To approve', status: true },
  { key: 'Manual Journal', label: 'Manual' },
  { key: 'Contribution', label: 'Savings' },
  { key: 'Loan Disbursement', label: 'Loans' },
  { key: 'Loan Repayment', label: 'Repayments' },
  { key: 'Withdrawal', label: 'Withdrawals' },
  { key: 'Payment Charges', label: 'Fees' },
  { key: 'Share-out', label: 'Share-outs' },
]
const filter = ref(FILTERS[0])
const rows = ref(null)
const error = ref('')
const more = ref(false)

async function load(append = false) {
  error.value = ''
  const f = filter.value
  const args = { cooperative: current.value.cooperative, start: append ? rows.value.length : 0, limit: 50 }
  if (f.key) args[f.status ? 'status' : 'voucher_type'] = f.key
  try {
    const page = await api.get('accounts.journals', args)
    rows.value = append ? [...rows.value, ...page] : page
    more.value = page.length === 50
  } catch (e) { error.value = e.message }
}
onMounted(() => load())
watch(filter, () => { rows.value = null; load() })
</script>

<template>
  <div>
    <PageHeader title="Journal entries" :subtitle="current?.cooperative_name" back="/admin?tab=books">
      <template #actions><RouterLink to="/admin/books/journal/new" class="btn-primary btn-sm"><Icon name="plus" :size="16" /> New</RouterLink></template>
    </PageHeader>
    <div class="no-scrollbar -mt-1 flex gap-2 overflow-x-auto px-5 pb-3">
      <button v-for="f in FILTERS" :key="f.label" class="shrink-0 rounded-full px-3.5 py-1.5 text-sm font-semibold"
        :class="filter === f ? 'bg-navy-800 text-white' : 'border border-line/12 bg-card text-ink-soft'" @click="filter = f">{{ f.label }}</button>
    </div>
    <div class="px-5 pb-12">
      <ErrorBox :message="error" />
      <Loader v-if="!rows && !error" />
      <div v-else-if="rows && !rows.length" class="card p-8 text-center text-sm text-ink-soft">Nothing here yet.</div>
      <div v-else-if="rows" class="card divide-soft">
        <RouterLink v-for="j in rows" :key="j.name" :to="`/admin/books/journal/${j.name}`" class="flex items-center gap-3 px-4 py-3">
          <div class="min-w-0 flex-1">
            <p class="truncate text-sm font-semibold">{{ j.remarks || j.voucher_type }}</p>
            <p class="truncate text-xs text-ink-soft">{{ date(j.posting_date) }} · {{ j.voucher_type }} · <span class="num">{{ j.name }}</span></p>
          </div>
          <div class="text-right">
            <p class="num text-sm font-semibold">{{ money(j.total_debit, currency) }}</p>
            <StatusPill v-if="j.status !== 'Posted'" :status="j.status" :label="j.status === 'Draft' ? 'To approve' : undefined" />
          </div>
        </RouterLink>
      </div>
      <button v-if="more" class="btn-secondary mt-3 w-full" @click="load(true)">Show more</button>
    </div>
  </div>
</template>
