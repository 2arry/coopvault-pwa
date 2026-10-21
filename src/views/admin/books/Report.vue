<script setup>
// One screen for the four financial reports. "Save as PDF" uses the browser's print dialog,
// so nothing is generated or stored on the server.
import { ref, computed, watch, onMounted } from 'vue'
import * as api from '../../../api'
import { current } from '../../../store'
import { date, figure, isoDate } from '../../../format'
import PageHeader from '../../../components/PageHeader.vue'
import Loader from '../../../components/Loader.vue'
import ErrorBox from '../../../components/ErrorBox.vue'
import Icon from '../../../components/Icon.vue'

const props = defineProps({ kind: String })
const KINDS = {
  'balance-sheet': { title: 'Balance sheet', method: 'accounts.balance_sheet', asOf: true },
  income: { title: 'Income statement', method: 'accounts.income_statement' },
  'cash-flow': { title: 'Cash flow', method: 'accounts.cash_flow' },
  'trial-balance': { title: 'Trial balance', method: 'accounts.trial_balance' },
}
const k = computed(() => KINDS[props.kind] || KINDS['balance-sheet'])
const r = ref(null)
const error = ref('')
const from = ref('')
const to = ref(isoDate(new Date()))

async function load() {
  error.value = ''
  r.value = null
  const args = { cooperative: current.value.cooperative }
  if (k.value.asOf) args.as_of = to.value
  else Object.assign(args, from.value ? { from_date: from.value } : {}, { to_date: to.value })
  try {
    r.value = await api.get(k.value.method, args)
    if (!k.value.asOf && !from.value) from.value = String(r.value.from_date).slice(0, 10)
  } catch (e) { error.value = e.message }
}
onMounted(load)
watch(() => props.kind, () => { from.value = ''; load() })

const period = computed(() => r.value && (k.value.asOf ? `As at ${date(r.value.as_of)}` : `${date(r.value.from_date)} to ${date(r.value.to_date)}`))
const print = () => window.print()
</script>

<template>
  <div>
    <PageHeader :title="k.title" :subtitle="current?.cooperative_name" back="/admin?tab=books" class="no-print">
      <template #actions>
        <button v-if="r" class="btn-secondary btn-sm" @click="print"><Icon name="download" :size="16" /> PDF</button>
      </template>
    </PageHeader>
    <div class="space-y-4 px-5 pb-12 pt-1">
      <form class="no-print grid gap-2" :class="k.asOf ? 'grid-cols-[1fr_auto]' : 'grid-cols-[1fr_1fr_auto]'" @submit.prevent="load">
        <div v-if="!k.asOf"><label class="label text-xs" for="r-from">From</label><input id="r-from" v-model="from" type="date" class="input py-2.5" /></div>
        <div><label class="label text-xs" for="r-to">{{ k.asOf ? 'As at' : 'To' }}</label><input id="r-to" v-model="to" type="date" class="input py-2.5" /></div>
        <button class="btn-secondary self-end py-2.5">Show</button>
      </form>
      <ErrorBox :message="error" />
      <Loader v-if="!r && !error" />

      <article v-if="r" class="report card p-5">
        <header class="mb-4 border-b border-line/10 pb-3">
          <p class="font-display text-lg font-semibold">{{ current?.cooperative_name }}</p>
          <p class="text-sm">{{ k.title }} · {{ period }}</p>
          <p class="text-xs text-ink-soft">Amounts in {{ r.currency }}</p>
        </header>

        <!-- Balance sheet -->
        <template v-if="props.kind === 'balance-sheet'">
          <template v-for="sec in [['Assets', r.assets, r.total_assets], ['Liabilities', r.liabilities, r.total_liabilities], ['Equity', r.equity, r.total_equity]]" :key="sec[0]">
            <h3 class="mt-4 text-xs font-semibold uppercase tracking-[0.08em] text-ink-soft first:mt-0">{{ sec[0] }}</h3>
            <div v-for="row in sec[1]" :key="row.account_name" class="row"><span>{{ row.account_name }}</span><span class="num">{{ figure(row.amount) }}</span></div>
            <div class="row total"><span>Total {{ sec[0].toLowerCase() }}</span><span class="num">{{ figure(sec[2]) }}</span></div>
          </template>
          <div class="row grand"><span>Liabilities and equity</span><span class="num">{{ figure(r.total_liabilities + r.total_equity) }}</span></div>
          <p v-if="!r.balanced" class="mt-3 rounded-2xl bg-neg-soft p-3 text-sm text-neg">The balance sheet doesn’t balance. Contact support.</p>
        </template>

        <!-- Income statement -->
        <template v-else-if="props.kind === 'income'">
          <h3 class="text-xs font-semibold uppercase tracking-[0.08em] text-ink-soft">Income</h3>
          <div v-for="row in r.income" :key="row.name" class="row"><span>{{ row.account_name }}</span><span class="num">{{ figure(row.amount) }}</span></div>
          <p v-if="!r.income.length" class="row text-ink-soft"><span>No income in this period</span></p>
          <div class="row total"><span>Total income</span><span class="num">{{ figure(r.total_income) }}</span></div>
          <h3 class="mt-4 text-xs font-semibold uppercase tracking-[0.08em] text-ink-soft">Costs</h3>
          <div v-for="row in r.expenses" :key="row.name" class="row"><span>{{ row.account_name }}</span><span class="num">{{ figure(row.amount) }}</span></div>
          <p v-if="!r.expenses.length" class="row text-ink-soft"><span>No costs in this period</span></p>
          <div class="row total"><span>Total costs</span><span class="num">{{ figure(r.total_expenses) }}</span></div>
          <div class="row grand"><span>{{ r.surplus < 0 ? 'Deficit' : 'Surplus' }}</span><span class="num" :class="r.surplus < 0 ? 'text-neg' : ''">{{ figure(r.surplus) }}</span></div>
        </template>

        <!-- Cash flow -->
        <template v-else-if="props.kind === 'cash-flow'">
          <div class="row total"><span>Cash at the start</span><span class="num">{{ figure(r.opening) }}</span></div>
          <div v-for="row in r.items" :key="row.voucher_type" class="row"><span>{{ row.label }}</span><span class="num" :class="row.amount < 0 ? 'text-neg' : ''">{{ figure(row.amount) }}</span></div>
          <p v-if="!r.items.length" class="row text-ink-soft"><span>No money moved in this period</span></p>
          <div class="row total"><span>Net change</span><span class="num">{{ figure(r.net) }}</span></div>
          <div class="row grand"><span>Cash at the end</span><span class="num">{{ figure(r.closing) }}</span></div>
          <p class="mt-3 text-xs text-ink-soft">Cash is the bank account, cash at hand and Paystack balance awaiting settlement.</p>
        </template>

        <!-- Trial balance -->
        <template v-else>
          <div class="row head"><span>Account</span><span class="num">Debit</span><span class="num">Credit</span></div>
          <RouterLink v-for="row in r.rows" :key="row.name" :to="`/admin/books/ledger/${row.name}`" class="row tb">
            <span><span class="num text-ink-faint">{{ row.account_code }}</span> {{ row.account_name }}</span>
            <span class="num">{{ figure(row.closing_debit) }}</span><span class="num">{{ figure(row.closing_credit) }}</span>
          </RouterLink>
          <div class="row grand tb"><span>Total</span><span class="num">{{ figure(r.total_debit) }}</span><span class="num">{{ figure(r.total_credit) }}</span></div>
        </template>
        <p class="mt-5 hidden text-[10px] text-ink-faint print:block">Printed {{ date(new Date(), { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) }} from Cooperative360</p>
      </article>
    </div>
  </div>
</template>

<style scoped>
.row { @apply flex items-baseline justify-between gap-3 py-1.5 text-sm; }
.row.tb { @apply grid grid-cols-[1fr_auto_auto] gap-4; }
.row.head { @apply grid grid-cols-[1fr_auto_auto] gap-4 border-b border-line/10 text-xs font-semibold text-ink-soft; }
.row.total { @apply mt-1 border-t border-line/10 pt-2 font-semibold; }
.row.grand { @apply mt-3 border-t-2 border-line/20 pt-2 text-base font-bold; }
.num { @apply tabular-nums text-right; }
</style>
