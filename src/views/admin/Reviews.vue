<script setup>
// Everything waiting on the officers. Approvals follow the group's rules; "Ready to send" is
// money already approved; then transfers that went wrong or couldn't be matched.
import { ref, computed, onMounted, onActivated } from 'vue'
import * as api from '../../api'
import { current, currency, toast, copyText, loadDashboard, can } from '../../store'
import { money, date, relative, initials } from '../../format'
import Loader from '../../components/Loader.vue'
import ErrorBox from '../../components/ErrorBox.vue'
import Sheet from '../../components/Sheet.vue'
import Icon from '../../components/Icon.vue'
import ApprovalSteps from '../../components/ApprovalSteps.vue'
import RecordPayment from '../../components/RecordPayment.vue'

const data = ref(null)
const error = ref('')
const busy = ref('')
const declining = ref(null) // an approval
const sending = ref(null) // a loan or withdrawal row ready to send
const fixing = ref(null) // a disputed loan or withdrawal
const matching = ref(null) // an unmatched transfer
const recording = ref(false)
const note = ref('')
const reference = ref('')
const matchTo = ref('')
const members = ref([])

const mine = computed(() => (data.value?.approvals || []).filter((a) => a.can_decide))
const others = computed(() => (data.value?.approvals || []).filter((a) => !a.can_decide))
const empty = computed(() => data.value && !mine.value.length && !others.value.length &&
  !['to_send', 'disputes', 'unmatched', 'awaiting_members'].some((k) => data.value[k]?.length))

async function load() {
  error.value = ''
  try { data.value = await api.get('finance.pending_reviews', { cooperative: current.value.cooperative }) } catch (e) { error.value = e.message }
}
async function refresh() {
  await load()
  loadDashboard().catch(() => {})
}
onMounted(load)
onActivated(() => data.value && load())

const amountOf = (row) => row.principal ?? row.amount
const recentlyChanged = (row) => {
  const c = row?.payout_account?.payout_changed_on
  return c && Date.now() - new Date(String(c).replace(' ', 'T')).getTime() < 72 * 3600 * 1000
}
const TITLES = {
  'Member admission': 'Wants to join',
  Loan: 'Loan request',
  Withdrawal: 'Withdrawal',
  'Offline payment': 'Offline payment to check',
  'Manual journal': 'Journal entry',
  'Share-out': 'Year-end share-out',
}
const stageText = (a) => (a.steps.length > 1 ? `Stage ${a.current_stage} of ${a.steps.length}: ${a.steps[a.current_stage - 1].label}` : '')

async function decide(a, approve, why) {
  busy.value = a.name
  try {
    const res = await api.post('approvals.decide', { name: a.name, approve: approve ? 1 : 0, note: why || null })
    declining.value = null
    toast(!approve ? 'Declined. They’ve been told why.' : res.status === 'Approved' ? 'Approved' : 'Approved. It moves to the next stage.')
    await refresh()
    // Approved money: offer to send it straight away if this officer can
    if (approve && res.status === 'Approved' && ['Loan', 'Withdrawal'].includes(a.action) && can('pay_out')) {
      const row = data.value.to_send.find((r) => r.name === a.reference_name)
      if (row && !row.is_mine) askSend(row)
    }
  } catch (e) { toast(e.message, 'error') } finally { busy.value = '' }
}
function askDecline(a) { note.value = ''; declining.value = a }
function askSend(row) { reference.value = ''; sending.value = row }

async function send() {
  const row = sending.value
  busy.value = row.name
  try {
    await api.post(row.kind === 'loan' ? 'finance.send_loan' : 'finance.send_withdrawal', { name: row.name, transfer_reference: reference.value })
    toast('Marked as sent. We’ve asked them to confirm it arrived.')
    sending.value = null
    await refresh()
  } catch (e) { toast(e.message, 'error') } finally { busy.value = '' }
}
async function declineApproved(row) {
  busy.value = row.name
  try {
    await api.post(row.kind === 'loan' ? 'finance.review_loan' : 'finance.review_withdrawal', { name: row.name, action: 'reject', note: note.value })
    toast('Declined. They’ve been told why.')
    declining.value = null
    await refresh()
  } catch (e) { toast(e.message, 'error') } finally { busy.value = '' }
}
function askFix(row) { reference.value = ''; fixing.value = row }
async function saveFix() {
  const row = fixing.value
  busy.value = row.name
  try {
    await api.post(row.kind === 'loan' ? 'finance.update_loan_transfer' : 'finance.update_withdrawal_transfer', { name: row.name, transfer_reference: reference.value })
    toast('Saved. We’ve asked them to check again.')
    fixing.value = null
    await refresh()
  } catch (e) { toast(e.message, 'error') } finally { busy.value = '' }
}
async function askMatch(tx) {
  matchTo.value = ''
  matching.value = tx
  if (!members.value.length) {
    members.value = (await api.get('coop.list_members', { cooperative: current.value.cooperative }).catch(() => []))
      .filter((m) => m.status !== 'Pending' && m.name !== current.value.name)
  }
}
async function match() {
  busy.value = matching.value.name
  try {
    await api.post('finance.allocate_unmatched', { reference: matching.value.name, member: matchTo.value })
    toast('Added to their savings. They’ve been told.')
    matching.value = null
    await refresh()
  } catch (e) { toast(e.message, 'error') } finally { busy.value = '' }
}
</script>

<template>
  <div class="space-y-6">
    <ErrorBox :message="error" />
    <button v-if="can('record')" class="card flex w-full items-center gap-3.5 p-4 text-left" @click="recording = true">
      <span class="grid h-10 w-10 place-items-center rounded-2xl bg-brand-soft text-brand-text"><Icon name="plus" :size="18" /></span>
      <span class="flex-1"><span class="block font-semibold">Record an offline payment</span><span class="block text-xs text-ink-soft">A transfer or cash paid outside the app</span></span>
      <Icon name="chevron" :size="18" class="text-ink-faint" />
    </button>
    <Loader v-if="!data && !error" />
    <div v-else-if="empty" class="card p-8 text-center">
      <div class="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-pos-soft text-pos"><Icon name="check" :size="28" /></div>
      <p class="mt-4 font-display text-xl font-semibold">All caught up</p>
      <p class="mt-1 text-sm text-ink-soft">Nothing is waiting for you. Payments through Paystack confirm themselves.</p>
    </div>

    <template v-if="data">
      <!-- Approvals this officer can decide -->
      <section v-if="mine.length">
        <h2 class="px-1 text-sm font-semibold">Needs your approval</h2>
        <div class="mt-3 space-y-2">
          <div v-for="a in mine" :key="a.name" class="card p-4">
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0">
                <p class="text-xs font-semibold text-brand-text">{{ TITLES[a.action] }}<span v-if="stageText(a)" class="font-normal text-ink-soft"> · {{ stageText(a) }}</span></p>
                <p class="mt-0.5 truncate font-semibold">{{ a.detail?.member_name || a.detail?.full_name || a.detail?.remarks || a.summary }}</p>
              </div>
              <p v-if="a.amount" class="money shrink-0 text-xl">{{ money(a.amount, currency) }}</p>
            </div>

            <!-- What they need to decide it -->
            <div v-if="a.action === 'Member admission'" class="mt-3 flex items-center gap-3">
              <span class="grid h-10 w-10 place-items-center rounded-full bg-sunk text-sm font-bold">{{ initials(a.detail.full_name) }}</span>
              <p class="text-sm text-ink-soft">{{ a.detail.phone || a.detail.user }} · asked {{ relative(a.detail.creation) }}</p>
            </div>
            <template v-else-if="a.action === 'Loan'">
              <p class="mt-1 text-xs text-ink-soft">{{ a.detail.product_name ? `${a.detail.product_name} · ` : '' }}{{ a.detail.rate_text }} · {{ a.detail.tenure_months }} month{{ a.detail.tenure_months > 1 ? 's' : '' }} · pays back {{ money(a.detail.total_payable, currency) }}</p>
              <p v-if="a.detail.purpose" class="mt-2 rounded-2xl bg-sunk p-3 text-sm">{{ a.detail.purpose }}</p>
              <dl class="mt-3 grid grid-cols-3 gap-2 text-xs">
                <div><dt class="text-ink-soft">Saved</dt><dd class="num font-semibold">{{ money(a.detail.member_balances.savings, currency) }}</dd></div>
                <div><dt class="text-ink-soft">Owes</dt><dd class="num font-semibold">{{ money(a.detail.member_balances.loan_outstanding, currency) }}</dd></div>
                <div><dt class="text-ink-soft">Limit</dt><dd class="num font-semibold">{{ money(a.detail.member_balances.borrow_limit, currency) }}</dd></div>
              </dl>
              <p v-if="a.detail.guarantors?.length" class="mt-2 text-xs text-ink-soft">Guarantors: {{ a.detail.guarantors.map((g) => `${g.member_name} ${money(g.amount, currency)} (${g.status === 'Accepted' ? 'agreed' : g.status.toLowerCase()})`).join(', ') }}</p>
              <p v-if="a.amount > data.pool.pool_balance" class="mt-3 rounded-2xl bg-warn-soft p-3 text-xs text-warn">The pool has {{ money(data.pool.pool_balance, currency) }} now, so it can’t be sent until more comes in.</p>
            </template>
            <template v-else-if="a.action === 'Withdrawal'">
              <p v-if="a.detail.reason" class="mt-2 rounded-2xl bg-sunk p-3 text-sm">{{ a.detail.reason }}</p>
              <dl class="mt-3 grid grid-cols-2 gap-2 text-xs">
                <div><dt class="text-ink-soft">Savings</dt><dd class="num font-semibold">{{ money(a.detail.member_balances.savings, currency) }}</dd></div>
                <div><dt class="text-ink-soft">Left after</dt><dd class="num font-semibold">{{ money(a.detail.member_balances.savings - a.amount, currency) }}</dd></div>
              </dl>
            </template>
            <template v-else-if="a.action === 'Offline payment'">
              <dl class="mt-3 grid grid-cols-2 gap-2 text-xs">
                <div><dt class="text-ink-soft">{{ a.detail.payment_method === 'Cash' ? 'Cash' : 'Bank transfer' }}</dt><dd class="num font-semibold">{{ a.detail.reference || '—' }}</dd></div>
                <div><dt class="text-ink-soft">Paid on</dt><dd class="font-semibold">{{ date(a.detail.date) }}</dd></div>
                <div><dt class="text-ink-soft">For</dt><dd class="font-semibold">{{ a.detail.loan ? `Loan ${a.detail.loan}` : 'Savings' }}</dd></div>
                <div><dt class="text-ink-soft">Recorded by</dt><dd class="font-semibold">{{ a.detail.recorded_by_name }}</dd></div>
              </dl>
              <p v-if="a.detail.notes" class="mt-2 text-xs text-ink-soft">“{{ a.detail.notes }}”</p>
              <p class="mt-3 flex gap-2 rounded-2xl bg-info-soft p-3 text-xs text-info"><Icon name="info" :size="14" class="mt-0.5 shrink-0" /> Check the bank statement shows this {{ a.detail.payment_method === 'Cash' ? 'cash was banked' : 'transfer' }} before approving.</p>
            </template>
            <template v-else-if="a.action === 'Manual journal'">
              <div class="mt-2 space-y-1 rounded-2xl bg-sunk p-3 text-xs">
                <p v-for="(l, i) in a.detail.lines" :key="i" class="flex justify-between gap-3"><span>{{ l.account_name }}</span><span class="num">{{ l.debit ? `Dr ${money(l.debit, currency)}` : `Cr ${money(l.credit, currency)}` }}</span></p>
              </div>
              <RouterLink :to="`/admin/books/journal/${a.reference_name}`" class="mt-2 inline-block text-xs link">Open the entry</RouterLink>
            </template>
            <template v-else-if="a.action === 'Share-out'">
              <p class="mt-1 text-xs text-ink-soft">{{ date(a.detail.period_start) }} – {{ date(a.detail.period_end) }} · surplus {{ money(a.detail.surplus, currency) }} · reserve {{ money(a.detail.reserve_amount, currency) }}</p>
              <RouterLink :to="`/admin/books/share-out/${a.reference_name}`" class="mt-2 inline-block text-xs link">See every member’s share</RouterLink>
            </template>

            <p v-if="recentlyChanged(a.detail)" class="mt-3 flex gap-2 rounded-2xl bg-warn-soft p-3 text-xs text-warn"><Icon name="alert" :size="14" class="mt-0.5 shrink-0" /> Their payout account changed {{ relative(a.detail.payout_account.payout_changed_on) }}. Check with them first.</p>
            <ApprovalSteps v-if="a.steps.length > 1" :approval="a" compact class="mt-4" />
            <div class="mt-4 grid grid-cols-2 gap-2">
              <button class="btn-secondary btn-sm" :disabled="busy === a.name" @click="a.action === 'Member admission' ? decide(a, false) : askDecline(a)">Decline</button>
              <button class="btn-primary btn-sm" :disabled="busy === a.name" @click="decide(a, true)">Approve</button>
            </div>
          </div>
        </div>
      </section>

      <!-- Approved money to send -->
      <section v-if="data.to_send.length">
        <h2 class="px-1 text-sm font-semibold">Ready to send</h2>
        <div class="mt-3 space-y-2">
          <div v-for="r in data.to_send" :key="r.name" class="card flex items-center gap-3 p-4">
            <div class="min-w-0 flex-1">
              <p class="truncate font-semibold">{{ r.member_name }}<span v-if="r.is_mine" class="ml-1.5 text-xs font-normal text-ink-soft">(you)</span></p>
              <p class="text-xs text-ink-soft">{{ r.kind === 'loan' ? 'Loan' : 'Withdrawal' }} approved · to {{ r.payout_account?.payout_bank_name || 'no account yet' }}</p>
            </div>
            <p class="money text-lg">{{ money(amountOf(r), currency) }}</p>
            <button v-if="!r.is_mine" class="btn-primary btn-sm" :disabled="busy === r.name" @click="askSend(r)">Send</button>
          </div>
        </div>
      </section>

      <section v-if="data.disputes.length">
        <h2 class="px-1 text-sm font-semibold text-warn">Says it hasn’t arrived</h2>
        <div class="mt-3 space-y-2">
          <div v-for="d in data.disputes" :key="d.name" class="card border-warn/30 p-4">
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0">
                <p class="truncate font-semibold">{{ d.member_name }}</p>
                <p class="text-xs text-ink-soft">{{ d.kind === 'loan' ? 'Loan' : 'Withdrawal' }} · sent {{ date(d.disbursed_on || d.sent_on) }} · ref <span class="num whitespace-nowrap">{{ d.transfer_reference }}</span></p>
              </div>
              <p class="money text-xl">{{ money(amountOf(d), currency) }}</p>
            </div>
            <p class="mt-1 text-xs text-ink-soft">To {{ d.payout_bank_name }} {{ d.payout_account_number }}</p>
            <p v-if="d.dispute_note" class="mt-3 rounded-2xl bg-warn-soft p-3 text-sm text-warn">“{{ d.dispute_note }}”</p>
            <p v-if="d.is_mine" class="mt-3 text-xs text-ink-soft">This is yours, so another officer has to sort it out.</p>
            <div v-else class="mt-3 flex gap-2">
              <RouterLink :to="d.kind === 'loan' ? `/loans/${d.name}` : `/withdrawals/${d.name}`" class="btn-secondary btn-sm flex-1">Details</RouterLink>
              <button class="btn-primary btn-sm flex-1" @click="askFix(d)">New transfer</button>
            </div>
          </div>
        </div>
      </section>

      <section v-if="data.unmatched?.length">
        <h2 class="px-1 text-sm font-semibold text-warn">Transfers to match</h2>
        <p class="mt-1 px-1 text-xs text-ink-soft">Money that reached the group’s account without a member’s account number. Find out who sent it.</p>
        <div class="mt-3 space-y-2">
          <div v-for="u in data.unmatched" :key="u.name" class="card flex items-center gap-3 p-4">
            <div class="min-w-0 flex-1">
              <p class="money text-xl">{{ money(u.amount, currency) }}</p>
              <p class="truncate text-xs text-ink-soft">{{ relative(u.creation) }} · {{ u.message }}</p>
            </div>
            <button class="btn-primary btn-sm" :disabled="busy === u.name" @click="askMatch(u)">Match</button>
          </div>
        </div>
      </section>

      <!-- Approvals waiting on someone else -->
      <section v-if="others.length">
        <h2 class="px-1 text-sm font-semibold">Waiting on others</h2>
        <div class="card mt-3 divide-soft">
          <details v-for="a in others" :key="a.name" class="group px-4 py-3">
            <summary class="flex cursor-pointer list-none items-center gap-3">
              <div class="min-w-0 flex-1">
                <p class="truncate text-sm font-semibold">{{ a.summary }}</p>
                <p class="truncate text-xs" :class="a.stuck ? 'text-warn' : 'text-ink-soft'">{{ a.stuck ? 'Nobody else can approve this yet' : a.why_not }}</p>
              </div>
              <Icon name="chevronDown" :size="16" class="text-ink-faint transition group-open:rotate-180" />
            </summary>
            <ApprovalSteps :approval="a" class="mt-3" />
            <button v-if="a.can_reject" class="btn-secondary btn-sm mt-3 w-full" :disabled="busy === a.name" @click="askDecline(a)">Decline it</button>
          </details>
        </div>
      </section>

      <section v-if="data.awaiting_members.length">
        <h2 class="px-1 text-sm font-semibold">Waiting for members</h2>
        <p class="mt-1 px-1 text-xs text-ink-soft">Opening balances proposed. They count once the member confirms.</p>
        <div class="card mt-3 divide-soft px-4">
          <div v-for="o in data.awaiting_members" :key="o.name" class="flex items-center justify-between gap-3 py-3 text-sm">
            <div class="min-w-0"><p class="truncate font-semibold">{{ o.member_name }}</p><p class="text-xs text-ink-soft">As of {{ date(o.contribution_date) }}</p></div>
            <p class="num font-semibold">{{ money(o.amount, currency) }}</p>
          </div>
        </div>
      </section>
    </template>

    <Sheet :open="!!sending" :title="sending ? `Send ${money(amountOf(sending), currency)} to ${sending.member_name}` : ''"
      subtitle="Transfer from the cooperative’s bank app, then enter the reference so they can match it." @close="sending = null">
      <template v-if="sending">
        <div v-if="sending.payout_account?.payout_account_number" class="rounded-3xl bg-sunk p-4">
          <p class="text-xs text-ink-soft">{{ sending.payout_account.payout_bank_name }}</p>
          <div class="mt-1 flex items-center justify-between gap-3">
            <p class="money text-2xl tracking-wider">{{ sending.payout_account.payout_account_number }}</p>
            <button class="btn-secondary btn-sm" @click="copyText(sending.payout_account.payout_account_number)"><Icon name="copy" :size="16" /> Copy</button>
          </div>
          <p class="mt-1 flex items-center gap-1.5 text-sm font-semibold"><Icon name="checkCircle" :size="16" class="text-pos" /> {{ sending.payout_account.payout_account_name }}</p>
          <p class="mt-2 text-xs text-ink-soft">Name checked with the bank through Paystack.</p>
        </div>
        <p v-else class="rounded-3xl bg-warn-soft p-4 text-sm text-warn">They haven’t added a bank account yet. Ask them to add one under Me → Where to send my money.</p>
        <p v-if="recentlyChanged(sending)" class="mt-3 flex gap-2 rounded-2xl bg-warn-soft p-3 text-xs text-warn"><Icon name="alert" :size="14" class="mt-0.5 shrink-0" /> This account was changed {{ relative(sending.payout_account.payout_changed_on) }}. Call them to make sure it was really them.</p>
        <p v-if="amountOf(sending) > data.pool.pool_balance" class="mt-3 rounded-2xl bg-warn-soft p-3 text-xs text-warn">The pool has {{ money(data.pool.pool_balance, currency) }} right now, which isn’t enough.</p>
        <form class="mt-5 space-y-4" @submit.prevent="send">
          <div>
            <label class="label" for="send-ref">Transfer reference</label>
            <input id="send-ref" v-model="reference" class="input num" placeholder="From your bank app’s receipt" required autocomplete="off" />
            <p class="hint">{{ sending.kind === 'loan' ? 'They confirm it arrived, and their repayment plan starts that day.' : 'They confirm it arrived, and it comes off their savings.' }}</p>
          </div>
          <button class="btn-primary w-full" :disabled="busy === sending.name || !reference.trim()">I’ve sent it</button>
          <button type="button" class="btn-ghost w-full text-neg" :disabled="busy === sending.name" @click="note = ''; declining = { row: sending }; sending = null">Don’t send: decline it instead</button>
        </form>
      </template>
    </Sheet>
    <Sheet :open="!!declining" title="Decline this?" subtitle="They’ll see your reason, so they know what to change." @close="declining = null">
      <form class="space-y-4" @submit.prevent="declining.row ? declineApproved(declining.row) : decide(declining, false, note)">
        <textarea v-model="note" rows="3" class="input" placeholder="e.g. Please repay your current loan first" required />
        <button class="btn-danger w-full" :disabled="!!busy || !note.trim()">Decline</button>
      </form>
    </Sheet>
    <Sheet :open="!!fixing" title="Record the new transfer" subtitle="After you’ve checked or resent the money, enter the reference from your bank app." @close="fixing = null">
      <form class="space-y-4" @submit.prevent="saveFix">
        <input v-model="reference" class="input num" placeholder="Transfer reference" required autocomplete="off" />
        <button class="btn-primary w-full" :disabled="!!busy || !reference.trim()">Save and ask them to confirm</button>
      </form>
    </Sheet>
    <Sheet :open="!!matching" :title="matching ? `Who sent ${money(matching.amount, currency)}?` : ''" subtitle="It’s added to their savings and they’re told. You can’t match a transfer to yourself." @close="matching = null">
      <form class="space-y-4" @submit.prevent="match">
        <select v-model="matchTo" class="input" required>
          <option value="" disabled>Choose the member</option>
          <option v-for="m in members" :key="m.name" :value="m.name">{{ m.full_name }}{{ m.phone ? ` · ${m.phone}` : '' }}</option>
        </select>
        <button class="btn-primary w-full" :disabled="!!busy || !matchTo">Add to their savings</button>
      </form>
    </Sheet>
    <RecordPayment :open="recording" @close="recording = false" @done="refresh" />
  </div>
</template>
