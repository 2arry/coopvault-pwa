<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import * as api from '../../../api'
import { current, currency, toast } from '../../../store'
import { money, isoDate } from '../../../format'
import PageHeader from '../../../components/PageHeader.vue'
import AmountField from '../../../components/AmountField.vue'
import Loader from '../../../components/Loader.vue'
import ErrorBox from '../../../components/ErrorBox.vue'
import Icon from '../../../components/Icon.vue'

const router = useRouter()
const accounts = ref(null)
const members = ref([])
const error = ref('')
const busy = ref(false)
const mode = ref('expense')
const MODES = [
  { key: 'expense', label: 'Expense' },
  { key: 'income', label: 'Income' },
  { key: 'move', label: 'Move money' },
  { key: 'custom', label: 'Custom' },
]
const form = ref({ posting_date: isoDate(new Date()), remarks: '', amount: '', what: '', from: '', to: '' })
const lines = ref([{ account: '', debit: '', credit: '', member: '' }, { account: '', debit: '', credit: '', member: '' }])

onMounted(async () => {
  try {
    const [chart, list] = await Promise.all([
      api.get('accounts.chart', { cooperative: current.value.cooperative }),
      api.get('coop.list_members', { cooperative: current.value.cooperative }),
    ])
    accounts.value = chart.accounts.filter((a) => !a.disabled)
    members.value = list.filter((m) => m.status !== 'Pending')
    const bank = accounts.value.find((a) => a.account_type === 'Bank')
    form.value.from = form.value.to = bank?.name || ''
  } catch (e) { error.value = e.message }
})

const byRoot = (root) => (accounts.value || []).filter((a) => a.root_type === root)
const cashAccounts = computed(() => (accounts.value || []).filter((a) => ['Bank', 'Cash', 'Paystack Clearing'].includes(a.account_type)))
const needsMember = (id) => ['Member Savings', 'Loan Receivable'].includes((accounts.value || []).find((a) => a.name === id)?.account_type)

const built = computed(() => {
  const f = form.value
  const amt = Number(f.amount) || 0
  if (mode.value === 'expense') return [{ account: f.what, debit: amt }, { account: f.from, credit: amt }]
  if (mode.value === 'income') return [{ account: f.to, debit: amt }, { account: f.what, credit: amt }]
  if (mode.value === 'move') return [{ account: f.to, debit: amt }, { account: f.from, credit: amt }]
  return lines.value.map((l) => ({ account: l.account, debit: Number(l.debit) || 0, credit: Number(l.credit) || 0, member: l.member || null }))
})
const totals = computed(() => ({
  debit: built.value.reduce((s, l) => s + (l.debit || 0), 0),
  credit: built.value.reduce((s, l) => s + (l.credit || 0), 0),
}))
const balanced = computed(() => totals.value.debit > 0 && Math.abs(totals.value.debit - totals.value.credit) < 0.005)

async function submit() {
  error.value = ''
  if (!balanced.value) return (error.value = 'Debits and credits must be equal and more than zero')
  busy.value = true
  try {
    const j = await api.post('accounts.create_journal', {
      cooperative: current.value.cooperative,
      posting_date: form.value.posting_date,
      remarks: form.value.remarks,
      lines: built.value.filter((l) => l.account && (l.debit || l.credit)),
    })
    toast('Sent for approval')
    router.replace(`/admin/books/journal/${j.name}`)
  } catch (e) { error.value = e.message } finally { busy.value = false }
}
</script>

<template>
  <div>
    <PageHeader title="New journal entry" :subtitle="current?.cooperative_name" back="/admin?tab=books" />
    <div class="px-5 pb-12 pt-1">
      <Loader v-if="!accounts && !error" />
      <form v-if="accounts" class="space-y-5" @submit.prevent="submit">
        <div class="seg grid-cols-4 text-[13px]">
          <button v-for="m in MODES" :key="m.key" type="button" :class="{ on: mode === m.key }" @click="mode = m.key">{{ m.label }}</button>
        </div>

        <template v-if="mode !== 'custom'">
          <AmountField v-model="form.amount" :currency="currency" label="Amount" id="j-amount" />
          <div v-if="mode !== 'move'">
            <label class="label" for="j-what">{{ mode === 'expense' ? 'What it was for' : 'What it was' }}</label>
            <select id="j-what" v-model="form.what" class="input" required>
              <option value="" disabled>Choose an account</option>
              <option v-for="a in byRoot(mode === 'expense' ? 'Expense' : 'Income')" :key="a.name" :value="a.name">{{ a.account_name }}</option>
            </select>
          </div>
          <div class="grid gap-3" :class="mode === 'move' ? 'grid-cols-2' : ''">
            <div v-if="mode !== 'income'">
              <label class="label" for="j-from">{{ mode === 'move' ? 'From' : 'Paid from' }}</label>
              <select id="j-from" v-model="form.from" class="input" required><option v-for="a in cashAccounts" :key="a.name" :value="a.name">{{ a.account_name }}</option></select>
            </div>
            <div v-if="mode !== 'expense'">
              <label class="label" for="j-to">{{ mode === 'move' ? 'To' : 'Received into' }}</label>
              <select id="j-to" v-model="form.to" class="input" required><option v-for="a in cashAccounts" :key="a.name" :value="a.name">{{ a.account_name }}</option></select>
            </div>
          </div>
        </template>

        <template v-else>
          <div v-for="(l, i) in lines" :key="i" class="card space-y-2 p-3">
            <div class="flex items-center gap-2">
              <select v-model="l.account" class="input flex-1 py-2.5 text-sm" :aria-label="`Account for line ${i + 1}`">
                <option value="">Account…</option>
                <optgroup v-for="root in ['Asset', 'Liability', 'Equity', 'Income', 'Expense']" :key="root" :label="root">
                  <option v-for="a in byRoot(root)" :key="a.name" :value="a.name">{{ a.account_code }} {{ a.account_name }}</option>
                </optgroup>
              </select>
              <button v-if="lines.length > 2" type="button" class="grid h-9 w-9 place-items-center rounded-xl text-ink-faint hover:text-neg" aria-label="Remove line" @click="lines.splice(i, 1)"><Icon name="x" :size="16" /></button>
            </div>
            <select v-if="needsMember(l.account)" v-model="l.member" class="input py-2.5 text-sm" required>
              <option value="">Which member?</option>
              <option v-for="m in members" :key="m.name" :value="m.name">{{ m.full_name }}</option>
            </select>
            <div class="grid grid-cols-2 gap-2">
              <input v-model="l.debit" type="number" min="0" step="0.01" inputmode="decimal" class="input py-2.5 text-sm" placeholder="Debit" @input="l.debit && (l.credit = '')" />
              <input v-model="l.credit" type="number" min="0" step="0.01" inputmode="decimal" class="input py-2.5 text-sm" placeholder="Credit" @input="l.credit && (l.debit = '')" />
            </div>
          </div>
          <button type="button" class="btn-secondary btn-sm w-full" @click="lines.push({ account: '', debit: '', credit: '', member: '' })"><Icon name="plus" :size="16" /> Add a line</button>
          <p class="flex justify-between rounded-2xl p-3 text-sm" :class="balanced ? 'bg-pos-soft text-pos' : 'bg-sunk text-ink-soft'">
            <span>Debits {{ money(totals.debit, currency) }} · Credits {{ money(totals.credit, currency) }}</span>
            <span class="font-semibold">{{ balanced ? 'Balanced' : 'Not balanced' }}</span>
          </p>
        </template>

        <div class="grid grid-cols-[1fr_auto] gap-3">
          <div><label class="label" for="j-remarks">Description</label><input id="j-remarks" v-model="form.remarks" class="input" placeholder="e.g. Hall rent for the October meeting" required /></div>
          <div><label class="label" for="j-date">Date</label><input id="j-date" v-model="form.posting_date" type="date" :max="isoDate(new Date())" class="input" required /></div>
        </div>
        <ErrorBox :message="error" />
        <button class="btn-primary btn-lg w-full" :disabled="busy || !balanced">Send for approval</button>
        <p class="flex gap-2 text-xs text-ink-soft"><Icon name="shield" :size="14" class="mt-0.5 shrink-0" /> It counts in the books once another staff member approves it.</p>
      </form>
    </div>
  </div>
</template>
