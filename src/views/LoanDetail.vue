<script setup>
import { ref, computed, onMounted } from 'vue'
import * as api from '../api'
import { current, currency, isAdmin, toast, copyText, loadDashboard } from '../store'
import { money, date, dueIn } from '../format'
import PageHeader from '../components/PageHeader.vue'
import StatusPill from '../components/StatusPill.vue'
import Loader from '../components/Loader.vue'
import ErrorBox from '../components/ErrorBox.vue'
import Sheet from '../components/Sheet.vue'
import TransferConfirm from '../components/TransferConfirm.vue'
import ApprovalSteps from '../components/ApprovalSteps.vue'
import Icon from '../components/Icon.vue'

const props = defineProps({ name: String })
const loan = ref(null)
const error = ref('')
const busy = ref(false)
const confirmCancel = ref(false)
const fixing = ref(false)
const newRef = ref('')
const answering = ref(null) // 'accept' | 'decline'
const note = ref('')
const replacing = ref(null) // a guarantor row
const replaceWith = ref({ member: '', amount: '' })
const members = ref([])
const restructuring = ref(false)
const plan = ref({ months: 6, reason: '' })
const s = computed(() => loan.value?.schedule)
const statusLabel = computed(() => {
  const l = loan.value
  if (!l) return ''
  if (l.status === 'Active') return 'Left to pay'
  if (l.status === 'Repaid') return 'Fully repaid'
  if (l.status === 'Sent') return 'Sent to you'
  return 'Amount requested'
})

async function load() {
  try { loan.value = await api.get('finance.get_loan', { name: props.name }) } catch (e) { error.value = e.message }
}
onMounted(load)

async function run(method, args, message) {
  busy.value = true
  try {
    loan.value = await api.post(method, { ...args })
    toast(message)
    return true
  } catch (e) { toast(e.message, 'error'); return false } finally { busy.value = false }
}
async function updateTransfer() {
  if (await run('finance.update_loan_transfer', { name: props.name, transfer_reference: newRef.value }, 'Transfer updated. The borrower has been asked to confirm.')) fixing.value = false
}
function onConfirmed(updated) {
  loan.value = updated
  loadDashboard().catch(() => {})
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
async function answer() {
  const accept = answering.value === 'accept'
  if (await run('finance.respond_guarantee', { loan: props.name, accept: accept ? 1 : 0, note: note.value },
    accept ? 'Thanks. You’re now a guarantor for this loan.' : 'They’ve been told you can’t guarantee it.')) answering.value = null
}
async function askReplace(g) {
  replacing.value = g
  replaceWith.value = { member: '', amount: g.amount }
  if (!members.value.length) {
    members.value = (await api.get('coop.list_members', { cooperative: current.value.cooperative }).catch(() => []))
      .filter((m) => m.status === 'Active' && m.name !== current.value.name)
  }
}
async function replace() {
  if (await run('finance.replace_guarantor', { loan: props.name, member: replacing.value.member, new_member: replaceWith.value.member,
    amount: replaceWith.value.amount }, 'Asked. They’ll get a notification.')) replacing.value = null
}
async function propose() {
  if (await run('finance.propose_restructure', { loan: props.name, months: plan.value.months, reason: plan.value.reason },
    'Sent for approval')) restructuring.value = false
}
const GUARANTOR_TONE = { Accepted: 'text-pos', Declined: 'text-neg', Pending: 'text-warn', Released: 'text-ink-faint' }
</script>

<template>
  <div>
    <PageHeader title="Loan" :subtitle="[loan?.product_name, name].filter(Boolean).join(' · ')" back="/loans" />
    <div class="space-y-4 px-5 pb-12 pt-1">
      <ErrorBox :message="error" />
      <Loader v-if="!loan && !error" />
      <template v-if="loan">
        <!-- Asked to guarantee it -->
        <section v-if="loan.my_guarantee && !loan.is_mine" class="rounded-3xl border p-5" :class="loan.my_guarantee.status === 'Pending' ? 'border-brand-text/30 bg-brand-soft/60' : 'border-line/10 bg-card'">
          <template v-if="loan.my_guarantee.status === 'Pending'">
            <p class="text-[15px] font-semibold">{{ loan.member_name }} asked you to guarantee {{ money(loan.my_guarantee.amount, currency) }}</p>
            <p class="mt-1 text-sm text-ink-soft">If they don’t repay, the group can recover up to that much from your savings. Until the loan is repaid, that amount of your savings is held: you can’t withdraw it or borrow against it.</p>
            <div class="mt-4 grid grid-cols-2 gap-2">
              <button class="btn-secondary btn-sm" :disabled="busy" @click="answering = 'decline'; note = ''">I can’t</button>
              <button class="btn-primary btn-sm" :disabled="busy" @click="answering = 'accept'; note = ''">I’ll guarantee it</button>
            </div>
          </template>
          <p v-else class="flex gap-2 text-sm"><Icon name="shield" :size="18" class="shrink-0 text-ink-soft" />
            <span>{{ loan.my_guarantee.status === 'Accepted' ? `You’re guaranteeing ${money(loan.my_guarantee.amount, currency)} of this loan.` : loan.my_guarantee.status === 'Released' ? 'Your guarantee has been released.' : 'You declined to guarantee this loan.' }}</span></p>
        </section>

        <section class="card p-5">
          <div class="flex items-center justify-between">
            <p class="text-sm text-ink-soft">{{ statusLabel }}</p>
            <StatusPill :status="s?.is_overdue ? 'Overdue' : loan.status" />
          </div>
          <p class="money mt-1 text-[40px] leading-tight">{{ money(loan.status === 'Active' ? loan.balance : loan.status === 'Repaid' ? loan.total_payable + loan.penalties_charged : loan.principal, currency) }}</p>
          <template v-if="['Active', 'Repaid'].includes(loan.status)">
            <div class="mt-4 h-2.5 overflow-hidden rounded-full bg-line/[0.07]">
              <div class="h-full rounded-full" :class="loan.status === 'Repaid' ? 'bg-pos' : s?.is_overdue ? 'bg-neg' : 'bg-info'" :style="{ width: `${Math.min(100, (loan.amount_repaid / (loan.total_payable + loan.penalties_charged)) * 100)}%` }" />
            </div>
            <p class="mt-2 text-xs text-ink-soft">{{ money(loan.amount_repaid, currency) }} of {{ money(loan.total_payable + loan.penalties_charged, currency) }} repaid</p>
          </template>
          <div v-if="s?.is_overdue" class="mt-4 rounded-2xl bg-neg-soft p-3 text-sm text-neg">
            <p class="flex items-center gap-2 font-semibold"><Icon name="alert" :size="18" /> {{ money(s.overdue_amount, currency) }} overdue · {{ s.days_overdue }} day{{ s.days_overdue === 1 ? '' : 's' }}</p>
            <p v-if="loan.penalty_percent" class="mt-1 text-xs">A late fee of {{ loan.penalty_percent }}% a month is added to an instalment {{ loan.grace_days }} days after it’s due.</p>
          </div>
          <div v-else-if="s?.next_due_date" class="mt-4 flex items-center gap-3 rounded-2xl bg-sunk p-3">
            <Icon name="calendar" :size="18" />
            <p class="flex-1 text-sm"><b>{{ money(s.next_amount, currency) }}</b> due {{ dueIn(s.next_due_date) }}</p>
          </div>
          <RouterLink v-if="loan.status === 'Active' && loan.is_mine" :to="`/loans/${loan.name}/repay`" class="btn-primary mt-4 w-full">Make a repayment</RouterLink>
          <template v-if="['Pending', 'Approved'].includes(loan.status)">
            <p class="mt-3 flex gap-2 text-sm text-ink-soft"><Icon name="clock" :size="18" class="shrink-0" />
              {{ loan.status === 'Approved' ? 'Approved. The treasurer will send it to your bank account and let you know.' : loan.guarantor_blocker || 'Waiting for approval. You’ll get a notification at each step.' }}</p>
            <ApprovalSteps v-if="loan.approval && loan.status === 'Pending' && !loan.guarantor_blocker" :approval="loan.approval" class="mt-4" />
            <button v-if="loan.is_mine" class="btn-ghost mt-3 w-full text-neg" @click="confirmCancel = true">Cancel request</button>
          </template>
        </section>

        <TransferConfirm v-if="loan.status === 'Sent' && loan.is_mine" kind="loan" :doc="loan" @done="onConfirmed" />
        <section v-if="loan.status === 'Sent' && !loan.is_mine && isAdmin" class="card p-5 text-sm">
          <p class="font-semibold">{{ loan.receipt_disputed ? `${loan.member_name} says it hasn’t arrived` : `Waiting for ${loan.member_name} to confirm` }}</p>
          <p class="mt-1 text-ink-soft">Sent to {{ loan.payout_bank_name }} {{ loan.payout_account_number }} · reference {{ loan.transfer_reference }}</p>
          <p v-if="loan.dispute_note" class="mt-2 rounded-2xl bg-warn-soft p-3 text-warn">“{{ loan.dispute_note }}”</p>
          <button v-if="loan.receipt_disputed" class="btn-secondary btn-sm mt-3" @click="fixing = true; newRef = ''">Record a new transfer</button>
        </section>

        <!-- Guarantors -->
        <section v-if="loan.guarantors?.length" class="card p-5">
          <h2 class="text-sm font-semibold">Guarantors</h2>
          <div class="mt-3 divide-soft text-sm">
            <div v-for="g in loan.guarantors" :key="g.member" class="flex items-center justify-between gap-3 py-2.5">
              <div class="min-w-0"><p class="truncate font-semibold">{{ g.member_name }}</p><p class="text-xs text-ink-soft">Guarantees {{ money(g.amount, currency) }}</p></div>
              <div class="text-right">
                <p class="text-xs font-semibold" :class="GUARANTOR_TONE[g.status]">{{ g.status === 'Pending' ? 'Not answered yet' : g.status }}</p>
                <button v-if="loan.is_mine && loan.status === 'Pending' && ['Declined', 'Pending'].includes(g.status)" class="text-xs link" @click="askReplace(g)">Ask someone else</button>
              </div>
            </div>
          </div>
        </section>

        <!-- Instalments -->
        <section v-if="s?.rows?.length" class="card p-5">
          <div class="flex items-center justify-between">
            <h2 class="text-sm font-semibold">Repayment plan</h2>
            <button v-if="loan.can_restructure && !loan.restructure_months" class="text-xs link" @click="restructuring = true; plan = { months: Math.max(2, s.rows.filter((r) => !r.paid).length + 2), reason: '' }">Restructure</button>
          </div>
          <p v-if="loan.restructure_months" class="mt-2 rounded-2xl bg-info-soft p-3 text-xs text-info">A new plan over {{ loan.restructure_months }} months is waiting for approval: “{{ loan.restructure_reason }}”</p>
          <ol class="mt-4 space-y-0">
            <li v-for="(row, i) in s.rows" :key="row.number" class="relative flex gap-3 pb-5 last:pb-0">
              <span v-if="i < s.rows.length - 1" class="absolute left-[11px] top-6 h-full w-0.5" :class="row.paid ? 'bg-pos/40' : 'bg-line/10'" />
              <span class="relative z-10 grid h-6 w-6 place-items-center rounded-full text-[11px] font-bold"
                :class="row.paid ? 'bg-pos text-white' : row.late ? 'bg-neg text-white' : 'border-2 border-line/20 bg-card text-ink-soft'">
                <Icon v-if="row.paid" name="check" :size="13" :stroke="3" /><template v-else>{{ row.number }}</template>
              </span>
              <div class="min-w-0 flex-1">
                <div class="flex items-baseline justify-between gap-2">
                  <span class="text-sm" :class="row.paid ? 'text-ink-soft' : ''">{{ date(row.due_date) }}
                    <span v-if="row.late" class="ml-1 text-xs font-semibold text-neg">overdue</span>
                    <span v-else-if="row.status === 'Part paid'" class="ml-1 text-xs font-semibold text-warn">part paid</span>
                    <span v-if="row.settled" class="ml-1 text-xs text-ink-faint">(before restructure)</span>
                  </span>
                  <span class="num text-sm font-semibold" :class="row.paid ? 'text-ink-faint line-through' : ''">{{ money(row.paid ? row.amount : row.owed, currency) }}</span>
                </div>
                <p v-if="row.interest || row.penalty" class="text-xs text-ink-faint">
                  {{ money(row.principal, currency) }} + {{ money(row.interest, currency) }} interest<template v-if="row.penalty"> + <span class="text-neg">{{ money(row.penalty, currency) }} late fee</span></template>
                </p>
              </div>
            </li>
          </ol>
        </section>

        <section class="card divide-soft px-5 text-sm">
          <div class="flex justify-between py-3"><span class="text-ink-soft">Borrowed</span><span class="num font-semibold">{{ money(loan.principal, currency) }}</span></div>
          <div class="flex justify-between gap-4 py-3"><span class="text-ink-soft">Interest · {{ loan.rate_text }}</span><span class="num font-semibold">{{ money(loan.interest_amount, currency) }}</span></div>
          <div v-if="loan.processing_fee" class="flex justify-between py-3"><span class="text-ink-soft">Processing fee (kept back when sent)</span><span class="num">{{ money(loan.processing_fee, currency) }}</span></div>
          <div v-if="loan.penalties_charged" class="flex justify-between py-3"><span class="text-ink-soft">Late fees charged</span><span class="num text-neg">{{ money(loan.penalties_charged, currency) }}</span></div>
          <div class="flex justify-between py-3"><span class="text-ink-soft">Total to pay back</span><span class="num font-semibold">{{ money(loan.total_payable + (loan.penalties_charged || 0), currency) }}</span></div>
          <div class="flex justify-between py-3"><span class="text-ink-soft">Term</span><span>{{ loan.tenure_months }} month{{ loan.tenure_months > 1 ? 's' : '' }}</span></div>
          <div class="flex justify-between py-3"><span class="text-ink-soft">Requested</span><span>{{ date(loan.application_date) }}</span></div>
          <div v-if="loan.disbursed_on" class="flex justify-between py-3"><span class="text-ink-soft">Sent</span><span>{{ date(loan.disbursed_on) }}</span></div>
          <div v-if="loan.purpose" class="py-3"><p class="text-ink-soft">Purpose</p><p class="mt-0.5">{{ loan.purpose }}</p></div>
          <div v-if="loan.review_note" class="py-3"><p class="text-ink-soft">Note from the officers</p><p class="mt-0.5">{{ loan.review_note }}</p></div>
          <div v-for="r in loan.restructures" :key="r.restructured_on" class="py-3">
            <p class="text-ink-soft">Restructured {{ date(r.restructured_on) }}</p>
            <p class="mt-0.5">{{ money(r.outstanding, currency) }} spread over {{ r.new_months }} months<span v-if="r.reason"> · “{{ r.reason }}”</span></p>
          </div>
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
              <div class="min-w-0 flex-1">
                <p class="text-sm font-semibold">{{ date(r.payment_date) }}</p>
                <p class="truncate text-xs text-ink-soft">{{ r.payment_method === 'Paystack' ? 'Online' : r.payment_method }}<template v-if="r.interest_part || r.penalty_part"> · {{ money(r.principal_part, currency) }} principal, {{ money(r.interest_part, currency) }} interest<template v-if="r.penalty_part">, {{ money(r.penalty_part, currency) }} late fee</template></template></p>
              </div>
              <div class="text-right"><p class="num text-sm font-semibold">{{ money(r.amount, currency) }}</p><StatusPill v-if="r.status !== 'Confirmed'" :status="r.status" /></div>
            </RouterLink>
          </div>
        </section>
      </template>
    </div>

    <Sheet :open="fixing" title="Record the new transfer" subtitle="After you’ve checked or resent the money, enter the reference from your bank app." @close="fixing = false">
      <form class="space-y-4" @submit.prevent="updateTransfer">
        <input v-model="newRef" class="input num" placeholder="Transfer reference" required />
        <button class="btn-primary w-full" :disabled="busy || !newRef.trim()">Save and ask them to confirm</button>
      </form>
    </Sheet>
    <Sheet :open="confirmCancel" title="Cancel this loan request?" subtitle="You can request again any time." @close="confirmCancel = false">
      <div class="grid grid-cols-2 gap-3">
        <button class="btn-secondary" @click="confirmCancel = false">Keep it</button>
        <button class="btn-danger" :disabled="busy" @click="cancel">Cancel request</button>
      </div>
    </Sheet>
    <Sheet :open="!!answering" :title="answering === 'accept' ? `Guarantee ${loan ? money(loan.my_guarantee?.amount, currency) : ''}?` : 'Can’t guarantee it?'"
      :subtitle="answering === 'accept' ? 'That much of your savings is held until the loan is repaid. You can’t withdraw it or borrow against it meanwhile.' : 'They’ll be told, so they can ask someone else.'" @close="answering = null">
      <form class="space-y-4" @submit.prevent="answer">
        <input v-if="answering === 'decline'" v-model="note" class="input" placeholder="A short reason (optional)" />
        <button :class="answering === 'accept' ? 'btn-primary' : 'btn-danger'" class="w-full" :disabled="busy">{{ answering === 'accept' ? 'Yes, I’ll guarantee it' : 'Decline' }}</button>
      </form>
    </Sheet>
    <Sheet :open="!!replacing" title="Ask someone else" :subtitle="replacing ? `Instead of ${replacing.member_name}. They’ll be asked in the app.` : ''" @close="replacing = null">
      <form class="space-y-4" @submit.prevent="replace">
        <select v-model="replaceWith.member" class="input" required>
          <option value="" disabled>Choose a member</option>
          <option v-for="m in members.filter((x) => !loan.guarantors.some((g) => g.member === x.name))" :key="m.name" :value="m.name">{{ m.full_name }}</option>
        </select>
        <div><label class="label" for="rg-amount">Amount they’d guarantee</label><input id="rg-amount" v-model="replaceWith.amount" type="number" min="0" class="input" /></div>
        <button class="btn-primary w-full" :disabled="busy || !replaceWith.member">Ask them</button>
      </form>
    </Sheet>
    <Sheet :open="restructuring" title="Restructure this loan" subtitle="What’s still owed is spread evenly over a new number of months, starting next month. No extra interest. It goes for approval." @close="restructuring = false">
      <form class="space-y-4" @submit.prevent="propose">
        <div><label class="label" for="rs-months">Spread over (months)</label><input id="rs-months" v-model.number="plan.months" type="number" min="1" max="60" class="input" required /></div>
        <p v-if="loan && plan.months > 0" class="hint !-mt-2">About {{ money(loan.balance / plan.months, currency) }} a month.</p>
        <div><label class="label" for="rs-reason">Why</label><input id="rs-reason" v-model="plan.reason" class="input" placeholder="e.g. Lost a customer; needs smaller instalments" required /></div>
        <button class="btn-primary w-full" :disabled="busy || !plan.reason.trim()">Send for approval</button>
      </form>
    </Sheet>
  </div>
</template>
