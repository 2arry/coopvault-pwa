<script setup>
import { ref, computed, onMounted } from 'vue'
import * as api from '../api'
import { current, currency, dashboard, loadDashboard } from '../store'
import { money, date, dueIn } from '../format'
import PageHeader from '../components/PageHeader.vue'
import StatusPill from '../components/StatusPill.vue'
import Loader from '../components/Loader.vue'
import ErrorBox from '../components/ErrorBox.vue'
import Icon from '../components/Icon.vue'

const loans = ref(null)
const error = ref('')
const canBorrow = computed(() => Math.max(0, Math.min(dashboard.value?.balances?.borrow_limit || 0, dashboard.value?.pool?.pool_balance || 0)))
const OPEN = ['Pending', 'Approved', 'Sent', 'Active']
const open = computed(() => (loans.value || []).filter((l) => OPEN.includes(l.status)))
const closed = computed(() => (loans.value || []).filter((l) => !OPEN.includes(l.status)))
const scheduleOf = (name) => dashboard.value?.active_loans?.find((l) => l.name === name)?.schedule

onMounted(async () => {
  loadDashboard().catch(() => {})
  try { loans.value = await api.get('finance.list_loans', { cooperative: current.value.cooperative }) } catch (e) { error.value = e.message }
})
</script>

<template>
  <div>
    <PageHeader title="Loans" :subtitle="current?.cooperative_name" />
    <div class="space-y-5 px-5 pb-6">
      <RouterLink to="/loans/new" class="flex items-center gap-4 rounded-4xl bg-gradient-to-br from-navy-800 to-navy-700 p-5 text-white shadow-lift">
        <div class="flex-1">
          <p class="text-sm text-navy-100/75">You can borrow up to</p>
          <p class="money text-[32px] leading-tight">{{ money(canBorrow, currency) }}</p>
        </div>
        <span class="btn-light btn-sm">Borrow <Icon name="arrowRight" :size="16" /></span>
      </RouterLink>

      <ErrorBox :message="error" />
      <Loader v-if="!loans && !error" />
      <div v-else-if="loans && !loans.length" class="card p-8 text-center">
        <div class="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-accent-soft text-accent-text"><Icon name="loans" :size="28" /></div>
        <p class="mt-4 font-display text-xl font-semibold">No loans yet</p>
        <p class="mt-1 text-sm text-ink-soft">When you need one, you can borrow up to what you’ve saved and pay it back monthly.</p>
      </div>

      <section v-if="open.length" class="space-y-3">
        <RouterLink v-for="l in open" :key="l.name" :to="`/loans/${l.name}`" class="card block p-4">
          <div class="flex items-start justify-between gap-3">
            <div>
              <p class="money text-2xl">{{ money(l.status === 'Active' ? l.balance : l.principal, currency) }}</p>
              <p class="text-xs text-ink-soft">{{ l.status === 'Active' ? `left of ${money(l.total_payable, currency)}` : `requested ${date(l.application_date)}` }}{{ l.purpose ? ` · ${l.purpose}` : '' }}</p>
            </div>
            <StatusPill :status="scheduleOf(l.name)?.is_overdue ? 'Overdue' : l.status" />
          </div>
          <template v-if="l.status === 'Active'">
            <div class="mt-3 h-1.5 overflow-hidden rounded-full bg-line/[0.07]"><div class="h-full rounded-full bg-info" :style="{ width: `${Math.min(100, (l.amount_repaid / l.total_payable) * 100)}%` }" /></div>
            <p v-if="scheduleOf(l.name)?.next_due_date" class="mt-2 text-xs text-ink-soft">Next: <b class="text-ink">{{ money(scheduleOf(l.name).next_amount, currency) }}</b> due {{ dueIn(scheduleOf(l.name).next_due_date) }}</p>
          </template>
        </RouterLink>
      </section>

      <section v-if="closed.length">
        <h2 class="px-1 text-sm font-semibold">Past loans</h2>
        <div class="card mt-3 divide-soft px-4">
          <RouterLink v-for="l in closed" :key="l.name" :to="`/loans/${l.name}`" class="flex items-center gap-3 py-3.5">
            <div class="min-w-0 flex-1">
              <p class="num font-semibold">{{ money(l.principal, currency) }}</p>
              <p class="truncate text-xs text-ink-soft">{{ l.purpose || 'Loan' }} · {{ date(l.application_date) }}</p>
            </div>
            <StatusPill :status="l.status" />
            <Icon name="chevron" :size="18" class="text-ink-faint" />
          </RouterLink>
        </div>
      </section>
    </div>
  </div>
</template>
