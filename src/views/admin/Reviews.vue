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
const approving = ref(null)
const note = ref('')
const proofUrl = ref(null)
const empty = computed(() => data.value && !['members', 'contributions', 'loans', 'repayments'].some((k) => data.value[k].length))
const groups = [
  { key: 'contributions', kind: 'contribution', doctype: 'Coop Contribution', title: 'Payments to confirm', dateField: 'contribution_date' },
  { key: 'repayments', kind: 'repayment', doctype: 'Coop Loan Repayment', title: 'Loan repayments to confirm', dateField: 'payment_date' },
]

async function load() {
  error.value = ''
  try { data.value = await api.get('finance.pending_reviews', { cooperative: current.value.cooperative }) } catch (e) { error.value = e.message }
}

const actions = {
  member: (row, ok) => api.post('coop.update_member', { member: row.name, status: ok ? 'Active' : 'Left' }),
  contribution: (row, ok, n) => api.post('finance.review_contribution', { name: row.name, action: ok ? 'confirm' : 'reject', note: n }),
  repayment: (row, ok, n) => api.post('finance.review_repayment', { name: row.name, action: ok ? 'confirm' : 'reject', note: n }),
  loan: (row, ok, n) => api.post('finance.review_loan', { name: row.name, action: ok ? 'approve' : 'reject', note: n }),
}
const messages = {
  member: ['Member approved', 'Request declined'],
  contribution: ['Payment confirmed', 'Payment rejected'],
  repayment: ['Repayment confirmed', 'Repayment rejected'],
  loan: ['Loan approved', 'Loan request rejected'],
}

async function act(kind, row, ok, n) {
  busy.value = row.name
  try {
    await actions[kind](row, ok, n)
    toast(messages[kind][ok ? 0 : 1])
    rejecting.value = null
    approving.value = null
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
async function viewProof(doctype, name) {
  try { proofUrl.value = await api.downloadProof(doctype, name) } catch (e) { toast(e.message, 'error') }
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
      <p class="mt-1 text-sm text-ink-soft">Nothing is waiting for you. Online payments confirm themselves.</p>
    </div>

    <template v-if="data">
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

      <template v-for="group in groups" :key="group.key">
      <section v-if="data[group.key].length">
        <h2 class="px-1 text-sm font-semibold">{{ group.title }}</h2>
        <div class="mt-3 space-y-2">
          <div v-for="c in data[group.key]" :key="c.name" class="card p-4">
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0">
                <p class="truncate font-semibold">{{ c.member_name }}</p>
                <p class="text-xs text-ink-soft">{{ c.payment_method }} · {{ date(c[group.dateField]) }}<span v-if="c.reference"> · Ref {{ c.reference }}</span></p>
                <p v-if="c.notes" class="mt-1 text-xs italic text-ink-soft">“{{ c.notes }}”</p>
              </div>
              <p class="money text-xl">{{ money(c.amount, currency) }}</p>
            </div>
            <p class="mt-2 text-xs text-ink-soft">Check that it arrived in the cooperative’s account before confirming.</p>
            <div class="mt-3 flex gap-2">
              <button v-if="c.proof" class="btn-secondary btn-sm" @click="viewProof(group.doctype, c.name)"><Icon name="file" :size="16" /> Receipt</button>
              <div class="flex-1" />
              <button class="btn-secondary btn-sm" :disabled="busy === c.name" @click="askReject(group.kind, c)">Reject</button>
              <button class="btn-primary btn-sm" :disabled="busy === c.name" @click="act(group.kind, c, true)">It arrived</button>
            </div>
          </div>
        </div>
      </section>
      </template>

      <section v-if="data.loans.length">
        <h2 class="px-1 text-sm font-semibold">Loan requests</h2>
        <div class="mt-3 space-y-2">
          <div v-for="l in data.loans" :key="l.name" class="card p-4">
            <div class="flex items-start justify-between gap-3">
              <div>
                <p class="font-semibold">{{ l.member_name }}</p>
                <p class="text-xs text-ink-soft">{{ l.tenure_months }} month{{ l.tenure_months > 1 ? 's' : '' }} · asked {{ date(l.application_date) }}</p>
              </div>
              <p class="money text-2xl">{{ money(l.principal, currency) }}</p>
            </div>
            <p v-if="l.purpose" class="mt-2 rounded-2xl bg-sunk p-3 text-sm">{{ l.purpose }}</p>
            <dl class="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
              <div><dt class="text-ink-soft">Has saved</dt><dd class="num font-semibold">{{ money(l.member_balances.total_contributed, currency) }}</dd></div>
              <div><dt class="text-ink-soft">Already owes</dt><dd class="num font-semibold">{{ money(l.member_balances.loan_outstanding, currency) }}</dd></div>
              <div><dt class="text-ink-soft">Limit</dt><dd class="num font-semibold">{{ money(l.member_balances.borrow_limit, currency) }}</dd></div>
              <div><dt class="text-ink-soft">Pays back</dt><dd class="num font-semibold">{{ money(l.total_payable, currency) }}</dd></div>
            </dl>
            <p v-if="l.principal > data.pool.pool_balance" class="mt-3 rounded-2xl bg-warn-soft p-3 text-xs font-semibold text-warn">The pool has {{ money(data.pool.pool_balance, currency) }}, which isn’t enough for this loan yet.</p>
            <div class="mt-4 grid grid-cols-2 gap-2">
              <button class="btn-secondary btn-sm" :disabled="busy === l.name" @click="askReject('loan', l)">Reject</button>
              <button class="btn-primary btn-sm" :disabled="busy === l.name || l.principal > data.pool.pool_balance" @click="approving = l">Approve</button>
            </div>
          </div>
        </div>
      </section>
    </template>

    <Sheet :open="!!approving" :title="`Send ${approving ? money(approving.principal, currency) : ''} to ${approving?.member_name}`" subtitle="Transfer the money, then mark the loan as sent. Repayments start a month from today." @close="approving = null">
      <template v-if="approving">
        <div v-if="approving.payout_account?.payout_account_number" class="rounded-3xl bg-sunk p-4">
          <p class="text-xs text-ink-soft">{{ approving.payout_account.payout_bank_name }}</p>
          <div class="mt-1 flex items-center justify-between gap-3">
            <p class="money text-2xl tracking-wider">{{ approving.payout_account.payout_account_number }}</p>
            <button class="btn-secondary btn-sm" @click="copyText(approving.payout_account.payout_account_number)"><Icon name="copy" :size="16" /> Copy</button>
          </div>
          <p class="mt-1 flex items-center gap-1.5 text-sm font-semibold"><Icon name="checkCircle" :size="16" class="text-pos" /> {{ approving.payout_account.payout_account_name }}</p>
        </div>
        <p v-else class="rounded-3xl bg-warn-soft p-4 text-sm text-warn">{{ approving.member_name }} hasn’t added a payout account yet. Ask them for their bank details before sending.</p>
        <button class="btn-primary mt-5 w-full" :disabled="busy === approving.name" @click="act('loan', approving, true)">I’ve sent it, approve the loan</button>
      </template>
    </Sheet>
    <Sheet :open="!!rejecting" title="Reject this?" subtitle="The member will see your reason." @close="rejecting = null">
      <form class="space-y-4" @submit.prevent="act(rejecting.kind, rejecting.row, false, note)">
        <textarea v-model="note" rows="3" class="input" placeholder="e.g. We couldn’t find this transfer in the account" />
        <button class="btn-danger w-full" :disabled="!!busy">Reject</button>
      </form>
    </Sheet>
    <Sheet :open="!!proofUrl" title="Payment receipt" @close="proofUrl = null">
      <img v-if="proofUrl?.type.startsWith('image/')" :src="proofUrl.url" alt="Receipt uploaded by the member" class="w-full rounded-2xl" />
      <p v-else class="text-sm text-ink-soft">This file can’t be previewed here.</p>
      <a :href="proofUrl?.url" target="_blank" rel="noopener" class="btn-secondary mt-4 w-full"><Icon name="external" :size="16" /> Open file</a>
    </Sheet>
  </div>
</template>
