<script setup>
import { ref, onMounted } from 'vue'
import * as api from '../api'
import { currency, isAdmin, toast } from '../store'
import { money, date } from '../format'
import PageHeader from '../components/PageHeader.vue'
import StatusPill from '../components/StatusPill.vue'
import Loader from '../components/Loader.vue'
import ErrorBox from '../components/ErrorBox.vue'
import Icon from '../components/Icon.vue'

const props = defineProps({ name: String })
const loan = ref(null)
const error = ref('')
const busy = ref(false)

async function load() {
  try { loan.value = await api.get('finance.get_loan', { name: props.name }) } catch (e) { error.value = e.message }
}
async function cancel() {
  busy.value = true
  try {
    await api.post('finance.cancel_loan', { name: props.name })
    toast('Loan request cancelled')
    await load()
  } catch (e) { error.value = e.message } finally { busy.value = false }
}
onMounted(load)
</script>

<template>
  <div>
    <PageHeader title="Loan details" :subtitle="name" back="/loans" />
    <div class="space-y-5 px-5 pb-10 pt-2">
      <ErrorBox :message="error" />
      <Loader v-if="!loan && !error" />
      <template v-if="loan">
        <section class="card p-5">
          <div class="flex items-center justify-between">
            <p class="text-sm text-ink-soft">{{ loan.status === 'Active' ? 'Balance to pay back' : 'Amount' }}</p>
            <StatusPill :status="loan.status" />
          </div>
          <p class="num mt-1 text-3xl font-extrabold">{{ money(loan.status === 'Active' ? loan.balance : loan.principal, currency) }}</p>
          <div v-if="['Active', 'Repaid'].includes(loan.status)" class="mt-4">
            <div class="h-2.5 overflow-hidden rounded-full bg-black/5">
              <div class="h-full rounded-full bg-brand-600" :style="{ width: `${Math.min(100, (loan.amount_repaid / loan.total_payable) * 100)}%` }" />
            </div>
            <p class="mt-2 text-xs text-ink-soft">{{ money(loan.amount_repaid, currency) }} of {{ money(loan.total_payable, currency) }} repaid</p>
          </div>
          <RouterLink v-if="loan.status === 'Active'" :to="`/loans/${loan.name}/repay`" class="btn-primary mt-5 w-full">Make a repayment</RouterLink>
          <button v-if="loan.status === 'Pending' && !isAdmin" class="btn-danger mt-5 w-full" :disabled="busy" @click="cancel">Cancel request</button>
          <p v-if="loan.status === 'Pending'" class="mt-3 text-center text-xs text-ink-soft">Waiting for an admin to approve and disburse.</p>
        </section>

        <section class="card divide-y divide-black/5 px-4 text-sm">
          <div class="flex justify-between py-3"><span class="text-ink-soft">Borrowed</span><span class="num font-semibold">{{ money(loan.principal, currency) }}</span></div>
          <div class="flex justify-between py-3"><span class="text-ink-soft">Interest ({{ loan.interest_rate }}%)</span><span class="num font-semibold">{{ money(loan.interest_amount, currency) }}</span></div>
          <div class="flex justify-between py-3"><span class="text-ink-soft">Total payable</span><span class="num font-semibold">{{ money(loan.total_payable, currency) }}</span></div>
          <div class="flex justify-between py-3"><span class="text-ink-soft">Requested</span><span>{{ date(loan.application_date) }}</span></div>
          <div v-if="loan.disbursed_on" class="flex justify-between py-3"><span class="text-ink-soft">Disbursed</span><span>{{ date(loan.disbursed_on) }}</span></div>
          <div v-if="loan.due_date" class="flex justify-between py-3"><span class="text-ink-soft">Due</span><span class="font-semibold">{{ date(loan.due_date) }}</span></div>
          <div v-if="loan.purpose" class="py-3"><p class="text-ink-soft">Purpose</p><p class="mt-0.5">{{ loan.purpose }}</p></div>
          <div v-if="loan.review_note" class="py-3"><p class="text-ink-soft">Admin note</p><p class="mt-0.5">{{ loan.review_note }}</p></div>
        </section>

        <section>
          <h2 class="section-title">Repayments</h2>
          <div v-if="loan.repayments.length" class="card mt-3 divide-y divide-black/5 px-4">
            <div v-for="r in loan.repayments" :key="r.name" class="flex items-center gap-3 py-3">
              <div class="rounded-full bg-sky-50 p-2 text-sky-700"><Icon name="check" :size="16" /></div>
              <div class="flex-1"><p class="text-sm font-semibold">{{ date(r.payment_date) }}</p><p class="text-xs text-ink-soft">{{ r.payment_method }}</p></div>
              <div class="text-right"><p class="num text-sm font-bold">{{ money(r.amount, currency) }}</p><StatusPill v-if="r.status !== 'Confirmed'" :status="r.status" /></div>
            </div>
          </div>
          <p v-else class="mt-3 text-sm text-ink-soft">No repayments yet.</p>
        </section>
      </template>
    </div>
  </div>
</template>
