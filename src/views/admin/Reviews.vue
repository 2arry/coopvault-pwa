<script setup>
import { ref, computed, onMounted, onActivated } from 'vue'
import * as api from '../../api'
import { current, currency, toast, copyText, loadDashboard } from '../../store'
import { money, date, relative, initials } from '../../format'
import Loader from '../../components/Loader.vue'
import ErrorBox from '../../components/ErrorBox.vue'
import Sheet from '../../components/Sheet.vue'
import Icon from '../../components/Icon.vue'

const data = ref(null)
const error = ref('')
const busy = ref('')
const rejecting = ref(null)
const sending = ref(null) // { kind, row }
const fixing = ref(null) // a disputed loan or withdrawal
const note = ref('')
const reference = ref('')
const empty = computed(() => data.value && !['members', 'loans', 'withdrawals', 'disputes'].some((k) => data.value[k].length))

async function load() {
  error.value = ''
  try { data.value = await api.get('finance.pending_reviews', { cooperative: current.value.cooperative }) } catch (e) { error.value = e.message }
}

const amountOf = (row) => row.principal ?? row.amount
const recentlyChanged = (row) => {
  const c = row.payout_account?.payout_changed_on
  return c && Date.now() - new Date(String(c).replace(' ', 'T')).getTime() < 72 * 3600 * 1000
}

const actions = {
  member: (row, ok) => api.post('coop.update_member', { member: row.name, status: ok ? 'Active' : 'Left' }),
  loan: (row, ok, n, ref) => api.post('finance.review_loan', { name: row.name, action: ok ? 'approve' : 'reject', note: n, transfer_reference: ref }),
  withdrawal: (row, ok, n, ref) => api.post('finance.review_withdrawal', { name: row.name, action: ok ? 'approve' : 'reject', note: n, transfer_reference: ref }),
}
const messages = {
  member: ['Member approved', 'Request declined'],
  loan: ['Marked as sent. We’ve asked them to confirm it arrived.', 'Loan request declined'],
  withdrawal: ['Marked as sent. We’ve asked them to confirm it arrived.', 'Withdrawal declined'],
}

async function act(kind, row, ok, n, ref) {
  busy.value = row.name
  try {
    await actions[kind](row, ok, n, ref)
    toast(messages[kind][ok ? 0 : 1])
    rejecting.value = null
    sending.value = null
    await load()
    loadDashboard().catch(() => {})
  } catch (e) {
    toast(e.message, 'error')
  } finally {
    busy.value = ''
  }
}
function askReject(kind, row) {
  note.value = ''
  rejecting.value = { kind, row }
}
function askSend(kind, row) {
  reference.value = ''
  sending.value = { kind, row }
}
function askFix(row) {
  reference.value = ''
  fixing.value = row
}
async function saveFix() {
  const row = fixing.value
  busy.value = row.name
  try {
    await api.post(row.kind === 'loan' ? 'finance.update_loan_transfer' : 'finance.update_withdrawal_transfer', { name: row.name, transfer_reference: reference.value })
    toast('Saved. We’ve asked them to check again.')
    fixing.value = null
    await load()
    loadDashboard().catch(() => {})
  } catch (e) { toast(e.message, 'error') } finally { busy.value = '' }
}
onMounted(load)
onActivated(() => data.value && load())
</script>

<template>
  <div class="space-y-6">
    <ErrorBox :message="error" />
    <Loader v-if="!data && !error" />
    <div v-else-if="empty" class="card p-8 text-center">
      <div class="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-pos-soft text-pos"><Icon name="check" :size="28" /></div>
      <p class="mt-4 font-display text-xl font-semibold">All caught up</p>
      <p class="mt-1 text-sm text-ink-soft">Nothing is waiting for you. Payments and repayments go through Paystack and confirm themselves.</p>
    </div>

    <template v-if="data">
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
            <p v-if="d.is_mine" class="mt-3 text-xs text-ink-soft">This is yours, so another admin or the treasurer has to sort it out.</p>
            <div v-else class="mt-3 flex gap-2">
              <RouterLink :to="d.kind === 'loan' ? `/loans/${d.name}` : `/withdrawals/${d.name}`" class="btn-secondary btn-sm flex-1">Details</RouterLink>
              <button class="btn-primary btn-sm flex-1" @click="askFix(d)">New transfer</button>
            </div>
          </div>
        </div>
      </section>

      <section v-if="data.members.length">
        <h2 class="px-1 text-sm font-semibold">Want to join</h2>
        <div class="mt-3 space-y-2">
          <div v-for="m in data.members" :key="m.name" class="card p-4">
            <div class="flex items-center gap-3">
              <span class="grid h-10 w-10 place-items-center rounded-full bg-sunk text-sm font-bold">{{ initials(m.full_name) }}</span>
              <div class="min-w-0 flex-1">
                <p class="truncate font-semibold">{{ m.full_name }}</p>
                <p class="truncate text-xs text-ink-soft">{{ m.phone || m.user }} · asked {{ relative(m.creation) }}</p>
              </div>
            </div>
            <div class="mt-3 grid grid-cols-2 gap-2">
              <button class="btn-secondary btn-sm" :disabled="busy === m.name" @click="act('member', m, false)">Decline</button>
              <button class="btn-primary btn-sm" :disabled="busy === m.name" @click="act('member', m, true)">Approve</button>
            </div>
          </div>
        </div>
      </section>

      <section v-if="data.loans.length">
        <h2 class="px-1 text-sm font-semibold">Loan requests</h2>
        <div class="mt-3 space-y-2">
          <div v-for="l in data.loans" :key="l.name" class="card p-4">
            <div class="flex items-start justify-between gap-3">
              <div>
                <p class="font-semibold">{{ l.member_name }}<span v-if="l.is_mine" class="ml-1.5 text-xs font-normal text-ink-soft">(you)</span></p>
                <p class="text-xs text-ink-soft">{{ l.tenure_months }} month{{ l.tenure_months > 1 ? 's' : '' }} · asked {{ date(l.application_date) }}</p>
              </div>
              <p class="money text-2xl">{{ money(l.principal, currency) }}</p>
            </div>
            <p v-if="l.purpose" class="mt-2 rounded-2xl bg-sunk p-3 text-sm">{{ l.purpose }}</p>
            <dl class="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
              <div><dt class="text-ink-soft">Has saved</dt><dd class="num font-semibold">{{ money(l.member_balances.savings, currency) }}</dd></div>
              <div><dt class="text-ink-soft">Already owes</dt><dd class="num font-semibold">{{ money(l.member_balances.loan_outstanding, currency) }}</dd></div>
              <div><dt class="text-ink-soft">Limit</dt><dd class="num font-semibold">{{ money(l.member_balances.borrow_limit, currency) }}</dd></div>
              <div><dt class="text-ink-soft">Pays back</dt><dd class="num font-semibold">{{ money(l.total_payable, currency) }}</dd></div>
            </dl>
            <p v-if="recentlyChanged(l)" class="mt-3 flex gap-2 rounded-2xl bg-warn-soft p-3 text-xs text-warn"><Icon name="alert" :size="14" class="mt-0.5 shrink-0" /> Payout account changed {{ relative(l.payout_account.payout_changed_on) }}. Check with them before sending.</p>
            <p v-if="l.principal > data.pool.pool_balance" class="mt-3 rounded-2xl bg-warn-soft p-3 text-xs font-semibold text-warn">The pool has {{ money(data.pool.pool_balance, currency) }}, which isn’t enough for this loan yet.</p>
            <p v-if="l.is_mine" class="mt-3 text-xs text-ink-soft">This is your own request, so another admin or the treasurer has to send it.</p>
            <div v-else class="mt-4 grid grid-cols-2 gap-2">
              <button class="btn-secondary btn-sm" :disabled="busy === l.name" @click="askReject('loan', l)">Decline</button>
              <button class="btn-primary btn-sm" :disabled="busy === l.name || l.principal > data.pool.pool_balance" @click="askSend('loan', l)">Send money</button>
            </div>
          </div>
        </div>
      </section>

      <section v-if="data.withdrawals.length">
        <h2 class="px-1 text-sm font-semibold">Withdrawals</h2>
        <div class="mt-3 space-y-2">
          <div v-for="w in data.withdrawals" :key="w.name" class="card p-4">
            <div class="flex items-start justify-between gap-3">
              <div>
                <p class="font-semibold">{{ w.member_name }}<span v-if="w.is_mine" class="ml-1.5 text-xs font-normal text-ink-soft">(you)</span></p>
                <p class="text-xs text-ink-soft">Asked {{ date(w.requested_on) }}</p>
              </div>
              <p class="money text-2xl">{{ money(w.amount, currency) }}</p>
            </div>
            <p v-if="w.reason" class="mt-2 rounded-2xl bg-sunk p-3 text-sm">{{ w.reason }}</p>
            <dl class="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
              <div><dt class="text-ink-soft">Savings</dt><dd class="num font-semibold">{{ money(w.member_balances.savings, currency) }}</dd></div>
              <div><dt class="text-ink-soft">Left after</dt><dd class="num font-semibold">{{ money(w.member_balances.savings - w.amount, currency) }}</dd></div>
            </dl>
            <p v-if="recentlyChanged(w)" class="mt-3 flex gap-2 rounded-2xl bg-warn-soft p-3 text-xs text-warn"><Icon name="alert" :size="14" class="mt-0.5 shrink-0" /> Payout account changed {{ relative(w.payout_account.payout_changed_on) }}. Check with them before sending.</p>
            <p v-if="w.amount > data.pool.pool_balance" class="mt-3 rounded-2xl bg-warn-soft p-3 text-xs font-semibold text-warn">The pool has {{ money(data.pool.pool_balance, currency) }} right now. Wait for repayments to come in.</p>
            <p v-if="w.is_mine" class="mt-3 text-xs text-ink-soft">This is your own withdrawal, so another admin or the treasurer has to send it.</p>
            <div v-else class="mt-4 grid grid-cols-2 gap-2">
              <button class="btn-secondary btn-sm" :disabled="busy === w.name" @click="askReject('withdrawal', w)">Decline</button>
              <button class="btn-primary btn-sm" :disabled="busy === w.name || w.amount > data.pool.pool_balance" @click="askSend('withdrawal', w)">Send money</button>
            </div>
          </div>
        </div>
      </section>

      <section v-if="data.awaiting_members.length">
        <h2 class="px-1 text-sm font-semibold">Waiting for members</h2>
        <p class="mt-1 px-1 text-xs text-ink-soft">Opening balances you proposed. They count once the member confirms.</p>
        <div class="card mt-3 divide-soft px-4">
          <div v-for="o in data.awaiting_members" :key="o.name" class="flex items-center justify-between gap-3 py-3 text-sm">
            <div class="min-w-0"><p class="truncate font-semibold">{{ o.member_name }}</p><p class="text-xs text-ink-soft">As of {{ date(o.contribution_date) }}</p></div>
            <p class="num font-semibold">{{ money(o.amount, currency) }}</p>
          </div>
        </div>
      </section>
    </template>

    <Sheet :open="!!sending" :title="sending ? `Send ${money(amountOf(sending.row), currency)} to ${sending.row.member_name}` : ''"
      subtitle="Transfer from the cooperative’s bank app, then enter the reference so they can match it." @close="sending = null">
      <template v-if="sending">
        <div v-if="sending.row.payout_account?.payout_account_number" class="rounded-3xl bg-sunk p-4">
          <p class="text-xs text-ink-soft">{{ sending.row.payout_account.payout_bank_name }}</p>
          <div class="mt-1 flex items-center justify-between gap-3">
            <p class="money text-2xl tracking-wider">{{ sending.row.payout_account.payout_account_number }}</p>
            <button class="btn-secondary btn-sm" @click="copyText(sending.row.payout_account.payout_account_number)"><Icon name="copy" :size="16" /> Copy</button>
          </div>
          <p class="mt-1 flex items-center gap-1.5 text-sm font-semibold"><Icon name="checkCircle" :size="16" class="text-pos" /> {{ sending.row.payout_account.payout_account_name }}</p>
          <p class="mt-2 text-xs text-ink-soft">Name checked with the bank through Paystack.</p>
        </div>
        <p v-if="recentlyChanged(sending.row)" class="mt-3 flex gap-2 rounded-2xl bg-warn-soft p-3 text-xs text-warn"><Icon name="alert" :size="14" class="mt-0.5 shrink-0" /> This account was changed {{ relative(sending.row.payout_account.payout_changed_on) }}. Call them to make sure it was really them.</p>
        <form class="mt-5 space-y-4" @submit.prevent="act(sending.kind, sending.row, true, '', reference)">
          <div>
            <label class="label" for="send-ref">Transfer reference</label>
            <input id="send-ref" v-model="reference" class="input num" placeholder="From your bank app’s receipt" required autocomplete="off" />
            <p class="hint">{{ sending.kind === 'loan' ? 'They confirm it arrived, and their repayment plan starts that day.' : 'They confirm it arrived, and it comes off their savings.' }}</p>
          </div>
          <button class="btn-primary w-full" :disabled="busy === sending.row.name || !reference.trim()">I’ve sent it</button>
        </form>
      </template>
    </Sheet>
    <Sheet :open="!!fixing" title="Record the new transfer" subtitle="After you’ve checked or resent the money, enter the reference from your bank app." @close="fixing = null">
      <form class="space-y-4" @submit.prevent="saveFix">
        <input v-model="reference" class="input num" placeholder="Transfer reference" required autocomplete="off" />
        <button class="btn-primary w-full" :disabled="!!busy || !reference.trim()">Save and ask them to confirm</button>
      </form>
    </Sheet>
    <Sheet :open="!!rejecting" title="Decline this request?" subtitle="They’ll see your reason." @close="rejecting = null">
      <form class="space-y-4" @submit.prevent="act(rejecting.kind, rejecting.row, false, note)">
        <textarea v-model="note" rows="3" class="input" placeholder="e.g. The pool is low until the end of the month" />
        <button class="btn-danger w-full" :disabled="!!busy">Decline</button>
      </form>
    </Sheet>
  </div>
</template>
