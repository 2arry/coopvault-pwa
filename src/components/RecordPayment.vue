<script setup>
// Record a bank transfer or cash payment made outside Paystack. Text only (no receipts or
// images); it counts once another officer checks it arrived and approves it.
import { ref, computed, watch } from 'vue'
import * as api from '../api'
import { current, currency, dashboard, toast } from '../store'
import { money, isoDate } from '../format'
import AmountField from './AmountField.vue'
import ErrorBox from './ErrorBox.vue'
import Sheet from './Sheet.vue'
import Icon from './Icon.vue'

const props = defineProps({ open: Boolean, member: Object }) // member: { name, full_name } to preselect
const emit = defineEmits(['close', 'done'])
const members = ref([])
const loans = ref([])
const busy = ref(false)
const error = ref('')
const blank = () => ({ member: props.member?.name || '', purpose: 'savings', loan: '', amount: '', payment_date: isoDate(new Date()),
  payment_method: 'Bank Transfer', reference: '', note: '', savings_product: '' })
const products = computed(() => dashboard.value?.savings_products || [])
const form = ref(blank())

watch(() => props.open, async (open) => {
  if (!open) return
  form.value = blank()
  error.value = ''
  if (!props.member && !members.value.length) {
    members.value = (await api.get('coop.list_members', { cooperative: current.value.cooperative }).catch(() => []))
      .filter((m) => m.status === 'Active')
  }
  if (form.value.member) loadLoans()
})
watch(() => form.value.member, (m, old) => { if (m && m !== old) loadLoans() })

async function loadLoans() {
  loans.value = []
  try {
    const st = await api.get('coop.get_statement', { cooperative: current.value.cooperative, member: form.value.member })
    loans.value = (st.loans || []).filter((l) => l.status === 'Active')
  } catch {}
}
const chosenLoan = computed(() => loans.value.find((l) => l.name === form.value.loan))

async function submit() {
  error.value = ''
  busy.value = true
  try {
    const f = form.value
    await api.post('finance.record_offline_payment', {
      cooperative: current.value.cooperative, member: f.member, amount: f.amount, payment_date: f.payment_date,
      payment_method: f.payment_method, reference: f.reference, note: f.note, loan: f.purpose === 'loan' ? f.loan : null,
      savings_product: f.purpose === 'savings' ? f.savings_product || null : null,
    })
    toast('Recorded. Another officer approves it once they’ve checked it arrived.')
    emit('done')
    emit('close')
  } catch (e) { error.value = e.message } finally { busy.value = false }
}
</script>

<template>
  <Sheet :open="open" title="Record an offline payment" subtitle="A transfer or cash paid outside the app. It counts once another officer checks it arrived." @close="emit('close')">
    <form class="space-y-4" @submit.prevent="submit">
      <div v-if="!member">
        <label class="label" for="rp-member">Who paid</label>
        <select id="rp-member" v-model="form.member" class="input" required>
          <option value="" disabled>Choose the member</option>
          <option v-for="m in members" :key="m.name" :value="m.name">{{ m.full_name }}</option>
        </select>
      </div>
      <p v-else class="rounded-2xl bg-sunk p-3 text-sm">From <b>{{ member.full_name }}</b></p>
      <div v-if="loans.length" class="seg grid-cols-2">
        <button type="button" :class="{ on: form.purpose === 'savings' }" @click="form.purpose = 'savings'">Savings</button>
        <button type="button" :class="{ on: form.purpose === 'loan' }" @click="form.purpose = 'loan'; form.loan = form.loan || loans[0].name">Loan repayment</button>
      </div>
      <div v-if="form.purpose === 'loan' && loans.length > 1">
        <label class="label" for="rp-loan">Which loan</label>
        <select id="rp-loan" v-model="form.loan" class="input"><option v-for="l in loans" :key="l.name" :value="l.name">{{ l.name }} · {{ money(l.balance, currency) }} left</option></select>
      </div>
      <div v-if="form.purpose === 'savings' && products.length > 1">
        <label class="label" for="rp-product">Saved into</label>
        <select id="rp-product" v-model="form.savings_product" class="input">
          <option v-for="p in products" :key="p.name" :value="p.kind === 'Regular contributions' ? '' : p.name">{{ p.product_name }}</option>
        </select>
      </div>
      <AmountField v-model="form.amount" :currency="currency" label="Amount" id="rp-amount" />
      <p v-if="form.purpose === 'loan' && chosenLoan" class="hint !-mt-2">{{ money(chosenLoan.balance, currency) }} left on this loan.</p>
      <div class="seg grid-cols-2">
        <button type="button" :class="{ on: form.payment_method === 'Bank Transfer' }" @click="form.payment_method = 'Bank Transfer'">Bank transfer</button>
        <button type="button" :class="{ on: form.payment_method === 'Cash' }" @click="form.payment_method = 'Cash'">Cash</button>
      </div>
      <div class="grid grid-cols-[1fr_auto] gap-3">
        <div>
          <label class="label" for="rp-ref">{{ form.payment_method === 'Cash' ? 'Receipt or note number' : 'Bank reference' }} <span v-if="form.payment_method === 'Cash'" class="font-normal text-ink-faint">(optional)</span></label>
          <input id="rp-ref" v-model="form.reference" class="input num" :required="form.payment_method === 'Bank Transfer'" autocomplete="off" placeholder="e.g. FT2310457" />
        </div>
        <div><label class="label" for="rp-date">Paid on</label><input id="rp-date" v-model="form.payment_date" type="date" :max="isoDate(new Date())" class="input" required /></div>
      </div>
      <div><label class="label" for="rp-note">Note <span class="font-normal text-ink-faint">(optional)</span></label><input id="rp-note" v-model="form.note" class="input" placeholder="e.g. Paid at the October meeting" /></div>
      <ErrorBox :message="error" />
      <button class="btn-primary w-full" :disabled="busy || !form.member || !(Number(form.amount) > 0)">Record for approval</button>
      <p class="flex gap-2 text-xs text-ink-soft"><Icon name="shield" :size="14" class="mt-0.5 shrink-0" /> No receipts or photos: whoever approves checks it against the bank statement.</p>
    </form>
  </Sheet>
</template>
