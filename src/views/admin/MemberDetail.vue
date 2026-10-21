<script setup>
import { ref, computed, onMounted } from 'vue'
import * as api from '../../api'
import { current, currency, toast, shareText, copyText } from '../../store'
import { money, today, paidThroughLabel, periodWord, whatsappLink } from '../../format'
import { memberReminder } from '../../reminders'
import PageHeader from '../../components/PageHeader.vue'
import ActivityRow from '../../components/ActivityRow.vue'
import Loader from '../../components/Loader.vue'
import ErrorBox from '../../components/ErrorBox.vue'
import Sheet from '../../components/Sheet.vue'
import StatusPill from '../../components/StatusPill.vue'
import Icon from '../../components/Icon.vue'

const props = defineProps({ name: String })
const st = ref(null)
const error = ref('')
const recording = ref(false)
const busy = ref(false)
const pay = ref({ kind: 'contribution', amount: '', method: 'Cash', loan: '', date: today(), reference: '' })
const member = computed(() => st.value?.member)
const s = computed(() => st.value?.standing)
const activeLoans = computed(() => (st.value?.loans || []).filter((l) => l.status === 'Active'))
const owing = computed(() => ['due', 'behind'].includes(s.value?.state))
const reminder = computed(() => (st.value && owing.value ? memberReminder({ ...member.value, standing: s.value }, current.value.cooperative_name, currency.value) : ''))

async function load() {
  try { st.value = await api.get('coop.get_statement', { cooperative: current.value.cooperative, member: props.name }) } catch (e) { error.value = e.message }
}

async function update(fields) {
  try {
    await api.post('coop.update_member', { member: props.name, ...fields })
    Object.assign(st.value.member, fields)
    toast('Member updated')
  } catch (e) { toast(e.message, 'error') }
}

function openRecord() {
  pay.value.amount = s.value?.due_now > 0 ? s.value.due_now : ''
  recording.value = true
}

async function record() {
  busy.value = true
  try {
    const p = pay.value
    const common = { amount: p.amount, payment_method: p.method, reference: p.reference }
    if (p.kind === 'contribution') {
      await api.post('finance.record_contribution', { ...common, cooperative: current.value.cooperative, member: props.name, contribution_date: p.date })
    } else {
      await api.post('finance.record_repayment', { ...common, loan: p.loan, payment_date: p.date })
    }
    toast('Payment recorded')
    recording.value = false
    pay.value = { ...pay.value, amount: '', reference: '' }
    await load()
  } catch (e) { toast(e.message, 'error') } finally { busy.value = false }
}
onMounted(load)
</script>

<template>
  <div>
    <PageHeader :title="member?.full_name || 'Member'" :subtitle="member?.phone" back="/admin?tab=members" />
    <div class="space-y-4 px-5 pb-12 pt-1">
      <ErrorBox :message="error" />
      <Loader v-if="!st && !error" />
      <template v-if="st">
        <section class="card p-5">
          <div class="grid grid-cols-3 gap-2 text-center">
            <div><p class="text-xs text-ink-soft">Saved</p><p class="money text-lg">{{ money(st.balances.total_contributed, currency, { compact: true }) }}</p></div>
            <div><p class="text-xs text-ink-soft">Owes</p><p class="money text-lg">{{ money(st.balances.loan_outstanding, currency, { compact: true }) }}</p></div>
            <div><p class="text-xs text-ink-soft">Can borrow</p><p class="money text-lg">{{ money(st.balances.borrow_limit, currency, { compact: true }) }}</p></div>
          </div>
          <div v-if="s?.tracked" class="mt-4 flex items-center gap-3 rounded-2xl p-3"
            :class="s.state === 'behind' ? 'bg-neg-soft text-neg' : s.state === 'due' ? 'bg-warn-soft text-warn' : 'bg-pos-soft text-pos'">
            <Icon :name="owing ? 'clock' : 'checkCircle'" :size="18" />
            <p class="flex-1 text-sm font-semibold">
              <template v-if="s.state === 'behind'">{{ s.periods_behind }} {{ periodWord(s.frequency, s.periods_behind) }} behind · {{ money(s.due_now, currency) }} to catch up</template>
              <template v-else-if="s.state === 'due'">{{ money(s.due_now, currency) }} due this {{ periodWord(s.frequency) }}</template>
              <template v-else-if="s.paid_through">{{ paidThroughLabel(s.paid_through, s.frequency) }}</template>
              <template v-else>Starts next {{ periodWord(s.frequency) }}</template>
            </p>
          </div>
          <div class="mt-4 grid gap-2" :class="owing ? 'grid-cols-2' : 'grid-cols-1'">
            <button class="btn-primary btn-sm" @click="openRecord"><Icon name="plus" :size="16" /> Record payment</button>
            <template v-if="owing">
              <a v-if="member.phone" :href="whatsappLink(member.phone, reminder)" target="_blank" rel="noopener" class="btn-secondary btn-sm"><Icon name="chat" :size="16" /> Remind</a>
              <button v-else class="btn-secondary btn-sm" @click="shareText(reminder)"><Icon name="share" :size="16" /> Remind</button>
            </template>
          </div>
        </section>

        <section class="card divide-soft text-sm">
          <div class="flex items-center justify-between p-4"><span class="text-ink-soft">Phone</span><span>{{ member.phone || '—' }}</span></div>
          <div class="flex items-center justify-between p-4">
            <span class="text-ink-soft">Role</span>
            <select :value="member.role" class="rounded-xl border border-line/12 bg-card px-3 py-1.5" @change="update({ role: $event.target.value })">
              <option>Member</option><option>Treasurer</option><option>Admin</option>
            </select>
          </div>
          <div class="flex items-center justify-between p-4">
            <span class="text-ink-soft">Status</span>
            <div class="flex items-center gap-3">
              <StatusPill :status="member.status" />
              <button v-if="member.status === 'Active'" class="text-xs font-semibold text-neg" @click="update({ status: 'Suspended' })">Suspend</button>
              <button v-else class="text-xs font-semibold text-brand-text" @click="update({ status: 'Active' })">Activate</button>
            </div>
          </div>
          <div class="flex items-center justify-between gap-3 p-4">
            <span class="text-ink-soft">Payout account</span>
            <button v-if="member.payout_account_number" class="text-right" @click="copyText(member.payout_account_number)">
              <span class="num block font-semibold">{{ member.payout_account_number }}</span>
              <span class="block text-xs text-ink-soft">{{ member.payout_bank_name }} · {{ member.payout_account_name }}</span>
            </button>
            <span v-else class="text-ink-faint">Not added</span>
          </div>
        </section>

        <section>
          <h2 class="px-1 text-sm font-semibold">Statement</h2>
          <div v-if="st.entries.length" class="card mt-3 px-4 py-1">
            <ActivityRow v-for="e in st.entries" :key="e.doctype + e.name" :entry="e" :currency="currency" />
          </div>
          <p v-else class="mt-3 px-1 text-sm text-ink-soft">No payments or loans yet.</p>
        </section>
      </template>
    </div>

    <Sheet :open="recording" title="Record a payment" subtitle="For cash or transfers you’ve received. It’s confirmed straight away." @close="recording = false">
      <form class="space-y-4" @submit.prevent="record">
        <div class="seg grid-cols-2">
          <button type="button" :class="{ on: pay.kind === 'contribution' }" @click="pay.kind = 'contribution'">Savings</button>
          <button type="button" :class="{ on: pay.kind === 'repayment' }" :disabled="!activeLoans.length" @click="pay.kind = 'repayment'; pay.loan = activeLoans[0]?.name; pay.amount = activeLoans[0]?.schedule?.next_amount || ''">Loan repayment</button>
        </div>
        <div v-if="pay.kind === 'repayment'">
          <label class="label" for="rloan">Loan</label>
          <select id="rloan" v-model="pay.loan" class="input" required>
            <option v-for="l in activeLoans" :key="l.name" :value="l.name">{{ money(l.principal, currency) }} loan · {{ money(l.balance, currency) }} left</option>
          </select>
        </div>
        <div><label class="label" for="ramt">Amount</label><input id="ramt" v-model="pay.amount" type="number" min="1" step="0.01" inputmode="decimal" class="input money text-2xl" required /></div>
        <div class="seg grid-cols-2">
          <button type="button" :class="{ on: pay.method === 'Cash' }" @click="pay.method = 'Cash'">Cash</button>
          <button type="button" :class="{ on: pay.method === 'Bank Transfer' }" @click="pay.method = 'Bank Transfer'">Bank transfer</button>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div><label class="label" for="rdate">Date</label><input id="rdate" v-model="pay.date" type="date" :max="today()" class="input" /></div>
          <div><label class="label" for="rref">Reference</label><input id="rref" v-model="pay.reference" class="input" placeholder="Optional" /></div>
        </div>
        <button class="btn-primary w-full" :disabled="busy">{{ busy ? 'Saving…' : 'Record payment' }}</button>
      </form>
    </Sheet>
  </div>
</template>
