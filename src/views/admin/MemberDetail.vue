<script setup>
import { ref, computed, onMounted } from 'vue'
import * as api from '../../api'
import { current, currency, toast } from '../../store'
import { money, today } from '../../format'
import PageHeader from '../../components/PageHeader.vue'
import ActivityRow from '../../components/ActivityRow.vue'
import Loader from '../../components/Loader.vue'
import ErrorBox from '../../components/ErrorBox.vue'
import Sheet from '../../components/Sheet.vue'
import StatusPill from '../../components/StatusPill.vue'
import MethodTabs from '../../components/MethodTabs.vue'
import Icon from '../../components/Icon.vue'

const props = defineProps({ name: String })
const member = ref(null)
const statement = ref(null)
const loans = ref([])
const error = ref('')
const recording = ref(false)
const busy = ref(false)
const pay = ref({ kind: 'contribution', amount: '', method: 'Cash', loan: '', date: today(), reference: '' })
const activeLoans = computed(() => loans.value.filter((l) => l.status === 'Active'))

async function load() {
  try {
    const coop = current.value.cooperative
    const [members, st, ls] = await Promise.all([
      api.get('coop.list_members', { cooperative: coop }),
      api.get('coop.get_statement', { cooperative: coop, member: props.name }),
      api.get('finance.list_loans', { cooperative: coop, scope: 'all' }),
    ])
    member.value = members.find((m) => m.name === props.name)
    statement.value = st
    loans.value = ls.filter((l) => l.member === props.name)
  } catch (e) { error.value = e.message }
}

async function update(fields) {
  try {
    await api.post('coop.update_member', { member: props.name, ...fields })
    Object.assign(member.value, fields)
    toast('Member updated')
  } catch (e) { toast(e.message, 'error') }
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
    <PageHeader :title="member?.full_name || 'Member'" :subtitle="member?.user" back="/admin?tab=members" />
    <div class="space-y-5 px-5 pb-10">
      <ErrorBox :message="error" />
      <Loader v-if="!member && !error" />
      <template v-if="member && statement">
        <section class="card grid grid-cols-3 divide-x divide-black/5 py-4 text-center">
          <div><p class="text-[11px] text-ink-soft">Saved</p><p class="num text-sm font-bold">{{ money(statement.balances.total_contributed, currency, { compact: true }) }}</p></div>
          <div><p class="text-[11px] text-ink-soft">Owes</p><p class="num text-sm font-bold">{{ money(statement.balances.loan_outstanding, currency, { compact: true }) }}</p></div>
          <div><p class="text-[11px] text-ink-soft">Can borrow</p><p class="num text-sm font-bold">{{ money(statement.balances.borrow_limit, currency, { compact: true }) }}</p></div>
        </section>

        <button class="btn-primary w-full" @click="recording = true"><Icon name="plus" /> Record a payment</button>

        <section class="card divide-y divide-black/5 text-sm">
          <div class="flex items-center justify-between p-4"><span class="text-ink-soft">Phone</span><span>{{ member.phone || '—' }}</span></div>
          <div class="flex items-center justify-between p-4">
            <span class="text-ink-soft">Role</span>
            <select :value="member.role" class="rounded-lg border border-black/10 bg-white px-2 py-1" @change="update({ role: $event.target.value })">
              <option>Member</option><option>Treasurer</option><option>Admin</option>
            </select>
          </div>
          <div class="flex items-center justify-between p-4">
            <span class="text-ink-soft">Status</span>
            <div class="flex items-center gap-2">
              <StatusPill :status="member.status" />
              <button v-if="member.status === 'Active'" class="text-xs font-semibold text-red-700" @click="update({ status: 'Suspended' })">Suspend</button>
              <button v-else class="text-xs font-semibold text-brand-700" @click="update({ status: 'Active' })">Activate</button>
            </div>
          </div>
        </section>

        <section>
          <h2 class="section-title">Statement</h2>
          <div v-if="statement.entries.length" class="card mt-3 divide-y divide-black/5 px-4">
            <ActivityRow v-for="e in statement.entries" :key="e.doctype + e.name" :entry="e" :currency="currency" />
          </div>
          <p v-else class="mt-3 text-sm text-ink-soft">No transactions yet.</p>
        </section>
      </template>
    </div>

    <Sheet :open="recording" title="Record a payment" @close="recording = false">
      <form class="space-y-4" @submit.prevent="record">
        <div class="grid grid-cols-2 gap-1 rounded-xl bg-black/5 p-1 text-sm font-semibold">
          <button type="button" class="rounded-lg py-2" :class="pay.kind === 'contribution' ? 'bg-white shadow-sm' : 'text-ink-soft'" @click="pay.kind = 'contribution'">Contribution</button>
          <button type="button" class="rounded-lg py-2" :class="pay.kind === 'repayment' ? 'bg-white shadow-sm' : 'text-ink-soft'" :disabled="!activeLoans.length" @click="pay.kind = 'repayment'; pay.loan = activeLoans[0]?.name">Loan repayment</button>
        </div>
        <div v-if="pay.kind === 'repayment'">
          <label class="label">Loan</label>
          <select v-model="pay.loan" class="input" required>
            <option v-for="l in activeLoans" :key="l.name" :value="l.name">{{ l.name }} — owes {{ money(l.balance, currency) }}</option>
          </select>
        </div>
        <div><label class="label">Amount ({{ currency }})</label><input v-model="pay.amount" type="number" min="1" step="0.01" inputmode="decimal" class="input num text-xl font-bold" required /></div>
        <MethodTabs v-model="pay.method" :options="[{ value: 'Cash', label: 'Cash', icon: 'cash' }, { value: 'Bank Transfer', label: 'Bank transfer', icon: 'bank' }]" />
        <div class="grid grid-cols-2 gap-3">
          <div><label class="label">Date</label><input v-model="pay.date" type="date" :max="today()" class="input" /></div>
          <div><label class="label">Reference</label><input v-model="pay.reference" class="input" placeholder="Optional" /></div>
        </div>
        <p class="hint">Payments you record as an admin are confirmed immediately.</p>
        <button class="btn-primary w-full" :disabled="busy">Record payment</button>
      </form>
    </Sheet>
  </div>
</template>
