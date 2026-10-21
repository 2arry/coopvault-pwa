<script setup>
import { ref, computed, onMounted } from 'vue'
import * as api from '../api'
import { currency, dashboard, loadDashboard } from '../store'
import { money, dueIn } from '../format'
import PageHeader from '../components/PageHeader.vue'
import PayPanel from '../components/PayPanel.vue'
import Loader from '../components/Loader.vue'
import ErrorBox from '../components/ErrorBox.vue'

const props = defineProps({ name: String })
const loan = ref(null)
const error = ref('')

const chips = computed(() => {
  const l = loan.value
  if (!l) return []
  const out = []
  if (l.schedule?.is_overdue) out.push({ label: `Overdue · ${money(l.schedule.overdue_amount, currency.value)}`, value: round(l.schedule.overdue_amount) })
  if (l.schedule?.next_amount && !out.some((c) => c.value === round(l.schedule.next_amount))) {
    out.push({ label: `Next instalment · ${money(l.schedule.next_amount, currency.value)}`, value: round(l.schedule.next_amount) })
  }
  if (!out.some((c) => c.value === round(l.balance))) out.push({ label: `Pay it all off · ${money(l.balance, currency.value)}`, value: round(l.balance) })
  return out
})
const round = (n) => Math.round(Number(n) * 100) / 100

onMounted(async () => {
  try {
    const [l] = await Promise.all([api.get('finance.get_loan', { name: props.name }), dashboard.value ? null : loadDashboard()])
    loan.value = l
  } catch (e) { error.value = e.message }
})
</script>

<template>
  <div>
    <PageHeader title="Repay loan" :back="`/loans/${name}`" />
    <div class="px-5 pb-12 pt-1">
      <ErrorBox :message="error" />
      <Loader v-if="!loan && !error" />
      <template v-else-if="loan">
        <div class="card mb-6 p-5">
          <div class="flex items-end justify-between">
            <div>
              <p class="text-sm text-ink-soft">Left to pay</p>
              <p class="money text-[34px] leading-tight">{{ money(loan.balance, currency) }}</p>
            </div>
            <p v-if="loan.schedule?.next_due_date" class="text-right text-sm" :class="loan.schedule.is_overdue ? 'text-neg' : 'text-ink-soft'">
              {{ loan.schedule.is_overdue ? 'Overdue' : 'Next due' }}<br /><b class="text-ink">{{ dueIn(loan.schedule.next_due_date) }}</b>
            </p>
          </div>
          <div class="mt-4 h-2 overflow-hidden rounded-full bg-line/[0.07]">
            <div class="h-full rounded-full bg-info" :style="{ width: `${Math.min(100, (loan.amount_repaid / loan.total_payable) * 100)}%` }" />
          </div>
          <p class="mt-2 text-xs text-ink-soft">{{ money(loan.amount_repaid, currency) }} of {{ money(loan.total_payable, currency) }} repaid · {{ loan.schedule?.paid_instalments || 0 }} of {{ loan.schedule?.instalments || loan.tenure_months }} instalments</p>
        </div>
        <ErrorBox v-if="loan.status !== 'Active'" :message="`This loan is ${loan.status.toLowerCase()}, so there’s nothing to repay.`" />
        <PayPanel v-else purpose="Loan Repayment" :loan="loan.name" :max="loan.balance" :chips="chips" :initial="chips[0]?.value" />
      </template>
    </div>
  </div>
</template>
