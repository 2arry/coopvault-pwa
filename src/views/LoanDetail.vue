<script setup>
import { ref, computed, onMounted } from 'vue'
import * as api from '../api'
import { currency, isAdmin, toast, copyText } from '../store'
import { money, date, dueIn } from '../format'
import PageHeader from '../components/PageHeader.vue'
import StatusPill from '../components/StatusPill.vue'
import Loader from '../components/Loader.vue'
import ErrorBox from '../components/ErrorBox.vue'
import Sheet from '../components/Sheet.vue'
import Icon from '../components/Icon.vue'

const props = defineProps({ name: String })
const loan = ref(null)
const error = ref('')
const busy = ref(false)
const confirmCancel = ref(false)
const s = computed(() => loan.value?.schedule)
const today = new Date().toISOString().slice(0, 10)

async function load() {
  try { loan.value = await api.get('finance.get_loan', { name: props.name }) } catch (e) { error.value = e.message }
}
async function cancel() {
  busy.value = true
  try {
    await api.post('finance.cancel_loan', { name: props.name })
    toast('Loan request cancelled')
    confirmCancel.value = false
    await load()
  } catch (e) { error.value = e.message } finally { busy.value = false }
}
onMounted(load)
</script>

<template>
  <div>
    <PageHeader title="Loan" :subtitle="name" back="/loans" />
    <div class="space-y-4 px-5 pb-12 pt-1">
      <ErrorBox :message="error" />
      <Loader v-if="!loan && !error" />
      <template v-if="loan">
        <section class="card p-5">
          <div class="flex items-center justify-between">
            <p class="text-sm text-ink-soft">{{ loan.status === 'Active' ? 'Left to pay' : loan.status === 'Repaid' ? 'Fully repaid' : 'Amount requested' }}</p>
            <StatusPill :status="s?.is_overdue ? 'Overdue' : loan.status" />
          </div>
          <p class="money mt-1 text-[40px] leading-tight">{{ money(loan.status === 'Active' ? loan.balance : loan.status === 'Repaid' ? loan.total_payable : loan.principal, currency) }}</p>
          <template v-if="['Active', 'Repaid'].includes(loan.status)">
            <div class="mt-4 h-2.5 overflow-hidden rounded-full bg-line/[0.07]">
              <div class="h-full rounded-full" :class="loan.status === 'Repaid' ? 'bg-pos' : s?.is_overdue ? 'bg-neg' : 'bg-info'" :style="{ width: `${Math.min(100, (loan.amount_repaid / loan.total_payable) * 100)}%` }" />
            </div>
            <p class="mt-2 text-xs text-ink-soft">{{ money(loan.amount_repaid, currency) }} of {{ money(loan.total_payable, currency) }} repaid</p>
          </template>
          <div v-if="s?.next_due_date" class="mt-4 flex items-center gap-3 rounded-2xl p-3" :class="s.is_overdue ? 'bg-neg-soft text-neg' : 'bg-sunk'">
            <Icon :name="s.is_overdue ? 'alert' : 'calendar'" :size="18" />
            <p class="flex-1 text-sm"><b>{{ money(s.is_overdue ? s.overdue_amount : s.next_amount, currency) }}</b> {{ s.is_overdue ? 'is overdue' : `due ${dueIn(s.next_due_date)}` }}</p>
          </div>
          <RouterLink v-if="loan.status === 'Active'" :to="`/loans/${loan.name}/repay`" class="btn-primary mt-4 w-full">Make a repayment</RouterLink>
          <template v-if="loan.status === 'Pending'">
            <p class="mt-3 flex gap-2 text-sm text-ink-soft"><Icon name="clock" :size="18" /> Waiting for the treasurer to approve and send the money.</p>
            <button v-if="!isAdmin" class="btn-ghost mt-3 w-full text-neg" @click="confirmCancel = true">Cancel request</button>
          </template>
        </section>

        <!-- Instalments -->
        <section v-if="s?.rows?.length" class="card p-5">
          <h2 class="text-sm font-semibold">Repayment plan</h2>
          <ol class="mt-4 space-y-0">
            <li v-for="(row, i) in s.rows" :key="row.number" class="relative flex gap-3 pb-5 last:pb-0">
              <span v-if="i < s.rows.length - 1" class="absolute left-[11px] top-6 h-full w-0.5" :class="row.paid ? 'bg-pos/40' : 'bg-line/10'" />
              <span class="relative z-10 grid h-6 w-6 place-items-center rounded-full text-[11px] font-bold"
                :class="row.paid ? 'bg-pos text-white' : row.due_date < today ? 'bg-neg text-white' : 'border-2 border-line/20 bg-card text-ink-soft'">
                <Icon v-if="row.paid" name="check" :size="13" :stroke="3" /><template v-else>{{ row.number }}</template>
              </span>
              <div class="flex flex-1 items-baseline justify-between">
                <span class="text-sm" :class="row.paid ? 'text-ink-soft' : ''">{{ date(row.due_date) }}<span v-if="!row.paid && row.due_date < today" class="ml-1.5 text-xs font-semibold text-neg">overdue</span></span>
                <span class="num text-sm font-semibold" :class="row.paid ? 'text-ink-faint line-through' : ''">{{ money(row.amount, currency) }}</span>
              </div>
            </li>
          </ol>
        </section>

        <section class="card divide-soft px-5 text-sm">
          <div class="flex justify-between py-3"><span class="text-ink-soft">Borrowed</span><span class="num font-semibold">{{ money(loan.principal, currency) }}</span></div>
          <div class="flex justify-between py-3"><span class="text-ink-soft">Interest ({{ loan.interest_rate }}% flat)</span><span class="num font-semibold">{{ money(loan.interest_amount, currency) }}</span></div>
          <div class="flex justify-between py-3"><span class="text-ink-soft">Total to pay back</span><span class="num font-semibold">{{ money(loan.total_payable, currency) }}</span></div>
          <div class="flex justify-between py-3"><span class="text-ink-soft">Term</span><span>{{ loan.tenure_months }} month{{ loan.tenure_months > 1 ? 's' : '' }}</span></div>
          <div class="flex justify-between py-3"><span class="text-ink-soft">Requested</span><span>{{ date(loan.application_date) }}</span></div>
          <div v-if="loan.disbursed_on" class="flex justify-between py-3"><span class="text-ink-soft">Approved</span><span>{{ date(loan.disbursed_on) }}</span></div>
          <div v-if="loan.purpose" class="py-3"><p class="text-ink-soft">Purpose</p><p class="mt-0.5">{{ loan.purpose }}</p></div>
          <div v-if="loan.review_note" class="py-3"><p class="text-ink-soft">Note from the treasurer</p><p class="mt-0.5">{{ loan.review_note }}</p></div>
        </section>

        <section v-if="isAdmin && loan.payout_account?.payout_account_number" class="card p-5">
          <p class="text-sm font-semibold">Member’s payout account</p>
          <div class="mt-2 flex items-center justify-between gap-3">
            <div>
              <p class="money text-2xl tracking-wider">{{ loan.payout_account.payout_account_number }}</p>
              <p class="text-xs text-ink-soft">{{ loan.payout_account.payout_bank_name }} · {{ loan.payout_account.payout_account_name }}</p>
            </div>
            <button class="btn-secondary btn-sm" @click="copyText(loan.payout_account.payout_account_number)"><Icon name="copy" :size="16" /> Copy</button>
          </div>
        </section>

        <section v-if="loan.repayments.length">
          <h2 class="px-1 text-sm font-semibold">Repayments</h2>
          <div class="card mt-3 divide-soft px-4">
            <RouterLink v-for="r in loan.repayments" :key="r.name" :to="`/receipt/Coop Loan Repayment/${r.name}`" class="flex items-center gap-3 py-3">
              <div class="grid h-9 w-9 place-items-center rounded-xl bg-info-soft text-info"><Icon name="check" :size="16" /></div>
              <div class="flex-1"><p class="text-sm font-semibold">{{ date(r.payment_date) }}</p><p class="text-xs text-ink-soft">{{ r.payment_method === 'Paystack' ? 'Online' : r.payment_method }}</p></div>
              <div class="text-right"><p class="num text-sm font-semibold">{{ money(r.amount, currency) }}</p><StatusPill v-if="r.status !== 'Confirmed'" :status="r.status" /></div>
            </RouterLink>
          </div>
        </section>
      </template>
    </div>

    <Sheet :open="confirmCancel" title="Cancel this loan request?" subtitle="You can request again any time." @close="confirmCancel = false">
      <div class="grid grid-cols-2 gap-3">
        <button class="btn-secondary" @click="confirmCancel = false">Keep it</button>
        <button class="btn-danger" :disabled="busy" @click="cancel">Cancel request</button>
      </div>
    </Sheet>
  </div>
</template>
