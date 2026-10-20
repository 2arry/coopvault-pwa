<script setup>
import { ref, computed, onMounted } from 'vue'
import * as api from '../../api'
import { current, currency, toast } from '../../store'
import { money, date, relative } from '../../format'
import Loader from '../../components/Loader.vue'
import ErrorBox from '../../components/ErrorBox.vue'
import Sheet from '../../components/Sheet.vue'
import Icon from '../../components/Icon.vue'

const data = ref(null)
const error = ref('')
const busy = ref('')
const rejecting = ref(null)
const note = ref('')
const proofUrl = ref(null)
const empty = computed(() => data.value && !['members', 'contributions', 'loans', 'repayments'].some((k) => data.value[k].length))

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

async function act(kind, row, ok, n) {
  busy.value = row.name
  try {
    await actions[kind](row, ok, n)
    toast(ok ? 'Approved' : 'Rejected')
    rejecting.value = null
    await load()
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
defineExpose({ load })
</script>

<template>
  <div class="space-y-6">
    <ErrorBox :message="error" />
    <Loader v-if="!data && !error" />
    <div v-else-if="empty" class="card p-8 text-center">
      <div class="mx-auto w-fit rounded-full bg-brand-50 p-3 text-brand-700"><Icon name="check" :size="28" /></div>
      <p class="mt-3 font-semibold">All caught up</p>
      <p class="mt-1 text-sm text-ink-soft">Nothing is waiting for review.</p>
    </div>

    <template v-if="data">
      <div class="flex items-center justify-between rounded-2xl bg-brand-50 px-4 py-3 text-sm text-brand-900">
        <span>Pool available</span><span class="num font-bold">{{ money(data.pool.pool_balance, currency) }}</span>
      </div>

      <section v-if="data.members.length">
        <h2 class="section-title">Join requests</h2>
        <div class="mt-3 space-y-2">
          <div v-for="m in data.members" :key="m.name" class="card flex items-center gap-3 p-4">
            <div class="min-w-0 flex-1">
              <p class="truncate font-semibold">{{ m.full_name }}</p>
              <p class="truncate text-xs text-ink-soft">{{ m.user }}<span v-if="m.phone"> · {{ m.phone }}</span> · {{ relative(m.creation) }}</p>
            </div>
            <button class="btn-secondary btn-sm" :disabled="busy === m.name" @click="act('member', m, false)">Decline</button>
            <button class="btn-primary btn-sm" :disabled="busy === m.name" @click="act('member', m, true)">Approve</button>
          </div>
        </div>
      </section>

      <section v-if="data.loans.length">
        <h2 class="section-title">Loan requests</h2>
        <div class="mt-3 space-y-2">
          <div v-for="l in data.loans" :key="l.name" class="card p-4">
            <div class="flex items-start justify-between gap-3">
              <div>
                <p class="font-semibold">{{ l.member_name }}</p>
                <p class="text-xs text-ink-soft">{{ l.tenure_months }} month{{ l.tenure_months > 1 ? 's' : '' }} · {{ date(l.application_date) }}</p>
              </div>
              <p class="num text-lg font-extrabold">{{ money(l.principal, currency) }}</p>
            </div>
            <p v-if="l.purpose" class="mt-2 rounded-lg bg-black/[0.03] p-2 text-sm">{{ l.purpose }}</p>
            <dl class="mt-3 grid grid-cols-2 gap-2 text-xs">
              <div><dt class="text-ink-soft">Contributed</dt><dd class="num font-semibold">{{ money(l.member_balances.total_contributed, currency) }}</dd></div>
              <div><dt class="text-ink-soft">Can borrow</dt><dd class="num font-semibold">{{ money(l.member_balances.borrow_limit, currency) }}</dd></div>
              <div><dt class="text-ink-soft">Already owes</dt><dd class="num font-semibold">{{ money(l.member_balances.loan_outstanding, currency) }}</dd></div>
              <div><dt class="text-ink-soft">Will repay</dt><dd class="num font-semibold">{{ money(l.total_payable, currency) }}</dd></div>
            </dl>
            <p v-if="l.principal > data.pool.pool_balance" class="mt-2 text-xs font-semibold text-amber-700">The pool doesn't have enough to disburse this yet.</p>
            <div class="mt-4 grid grid-cols-2 gap-2">
              <button class="btn-secondary btn-sm" :disabled="busy === l.name" @click="askReject('loan', l)">Reject</button>
              <button class="btn-primary btn-sm" :disabled="busy === l.name || l.principal > data.pool.pool_balance" @click="act('loan', l, true)">Approve & disburse</button>
            </div>
          </div>
        </div>
      </section>

      <section v-for="group in [{ key: 'contributions', kind: 'contribution', doctype: 'Coop Contribution', title: 'Contributions to confirm', dateField: 'contribution_date' }, { key: 'repayments', kind: 'repayment', doctype: 'Coop Loan Repayment', title: 'Repayments to confirm', dateField: 'payment_date' }]"
        v-show="data[group.key].length" :key="group.key">
        <h2 class="section-title">{{ group.title }}</h2>
        <div class="mt-3 space-y-2">
          <div v-for="c in data[group.key]" :key="c.name" class="card p-4">
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0">
                <p class="truncate font-semibold">{{ c.member_name }}</p>
                <p class="text-xs text-ink-soft">{{ c.payment_method }} · {{ date(c[group.dateField]) }}<span v-if="c.reference"> · Ref {{ c.reference }}</span></p>
                <p v-if="c.notes" class="mt-1 text-xs text-ink-soft">“{{ c.notes }}”</p>
              </div>
              <p class="num text-lg font-extrabold">{{ money(c.amount, currency) }}</p>
            </div>
            <div class="mt-3 flex gap-2">
              <button v-if="c.proof" class="btn-secondary btn-sm" @click="viewProof(group.doctype, c.name)"><Icon name="file" :size="16" /> Proof</button>
              <div class="flex-1" />
              <button class="btn-secondary btn-sm" :disabled="busy === c.name" @click="askReject(group.kind, c)">Reject</button>
              <button class="btn-primary btn-sm" :disabled="busy === c.name" @click="act(group.kind, c, true)">Confirm received</button>
            </div>
          </div>
        </div>
      </section>
    </template>

    <Sheet :open="!!rejecting" title="Reject this request?" @close="rejecting = null">
      <form class="space-y-4" @submit.prevent="act(rejecting.kind, rejecting.row, false, note)">
        <div><label class="label">Reason <span class="font-normal text-ink-faint">(shown to the member)</span></label><textarea v-model="note" rows="3" class="input" /></div>
        <button class="btn-danger w-full" :disabled="!!busy">Reject</button>
      </form>
    </Sheet>
    <Sheet :open="!!proofUrl" title="Proof of payment" @close="proofUrl = null">
      <img v-if="proofUrl?.type.startsWith('image/')" :src="proofUrl.url" alt="Proof of payment" class="w-full rounded-xl" />
      <p v-else class="text-sm text-ink-soft">Preview isn't available for this file type.</p>
      <a :href="proofUrl?.url" target="_blank" rel="noopener" class="btn-secondary mt-4 w-full"><Icon name="download" :size="16" /> Open file</a>
    </Sheet>
  </div>
</template>
