<script setup>
// Shared by Contribute and Repay: Paystack checkout or a manual (bank/cash) record with proof.
import { ref, computed, onMounted } from 'vue'
import * as api from '../api'
import { state, current, currency, isAdmin, toast } from '../store'
import { money, today } from '../format'
import ErrorBox from './ErrorBox.vue'
import MethodTabs from './MethodTabs.vue'
import ProofPicker from './ProofPicker.vue'
import Icon from './Icon.vue'

const props = defineProps({
  purpose: { type: String, required: true }, // 'Contribution' | 'Loan Repayment'
  loan: String,
  max: Number,
  suggested: Number,
})
const emit = defineEmits(['done'])

const coop = ref(null)
const amount = ref(props.suggested || '')
const methods = computed(() => [
  ...(state.paystack.enabled ? [{ value: 'Paystack', label: 'Pay online', icon: 'card' }] : []),
  { value: 'Bank Transfer', label: 'Bank transfer', icon: 'bank' },
  { value: 'Cash', label: 'Cash', icon: 'cash' },
])
const method = ref(methods.value[0].value)
const reference = ref('')
const notes = ref('')
const paidOn = ref(today())
const proof = ref(null)
const busy = ref(false)
const error = ref('')

onMounted(async () => {
  try {
    coop.value = (await api.get('coop.get_dashboard', { cooperative: current.value.cooperative })).cooperative
    if (!amount.value && props.purpose === 'Contribution' && coop.value.contribution_amount) amount.value = coop.value.contribution_amount
  } catch {}
})

function copy(text) {
  navigator.clipboard?.writeText(text).then(() => toast('Copied'))
}

async function submit() {
  error.value = ''
  const value = Number(amount.value)
  if (!(value > 0)) return (error.value = 'Enter an amount')
  if (props.max != null && value > props.max + 0.005) return (error.value = `The most you can pay is ${money(props.max, currency.value)}`)
  busy.value = true
  try {
    if (method.value === 'Paystack') {
      const res = await api.post('payments.initialize', {
        cooperative: current.value.cooperative, purpose: props.purpose, amount: value, loan: props.loan,
      })
      window.location.href = res.authorization_url
      return
    }
    const payload = {
      amount: value, payment_method: method.value, reference: reference.value, notes: notes.value,
    }
    if (proof.value) {
      payload.proof_data = await api.fileToDataUrl(proof.value)
      payload.proof_filename = proof.value.name
    }
    const doc = props.purpose === 'Contribution'
      ? await api.post('finance.record_contribution', { ...payload, cooperative: current.value.cooperative, contribution_date: paidOn.value })
      : await api.post('finance.record_repayment', { ...payload, loan: props.loan, payment_date: paidOn.value })
    toast(doc.status === 'Confirmed' ? 'Payment recorded' : 'Submitted. An admin will confirm once the money arrives.')
    emit('done', doc)
  } catch (e) {
    error.value = e.message
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <form class="space-y-5" @submit.prevent="submit">
    <div>
      <label class="label" for="amount">Amount ({{ currency }})</label>
      <input id="amount" v-model="amount" type="number" inputmode="decimal" min="1" step="0.01" class="input num text-2xl font-bold" required />
      <p v-if="max != null" class="hint">Outstanding: <button type="button" class="font-semibold text-brand-700" @click="amount = max">{{ money(max, currency) }}</button></p>
      <p v-else-if="coop?.contribution_amount" class="hint">Expected: {{ money(coop.contribution_amount, currency) }} {{ coop.contribution_frequency?.toLowerCase() }}</p>
    </div>

    <div>
      <p class="label">How are you paying?</p>
      <MethodTabs v-model="method" :options="methods" />
    </div>

    <div v-if="method === 'Paystack'" class="rounded-xl bg-brand-50 p-4 text-sm text-brand-900">
      You'll be taken to Paystack to pay securely by card, bank or USSD. It is recorded automatically once paid.
    </div>

    <template v-else>
      <div v-if="method === 'Bank Transfer' && coop?.account_number" class="card p-4">
        <p class="section-title">Pay into</p>
        <p class="mt-2 font-semibold">{{ coop.account_name }}</p>
        <div class="mt-1 flex items-center justify-between">
          <p class="num text-xl font-bold tracking-wider">{{ coop.account_number }}</p>
          <button type="button" class="btn-secondary btn-sm" @click="copy(coop.account_number)"><Icon name="copy" :size="16" /> Copy</button>
        </div>
        <p class="text-sm text-ink-soft">{{ coop.bank_name }}</p>
      </div>
      <div v-if="!isAdmin" class="flex gap-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
        <Icon name="clock" :size="18" class="mt-0.5 shrink-0" />
        <span>Pay first, then submit this form. An admin confirms it before it counts towards your balance.</span>
      </div>
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="label" for="date">Date paid</label>
          <input id="date" v-model="paidOn" type="date" :max="today()" class="input" />
        </div>
        <div>
          <label class="label" for="ref">Reference</label>
          <input id="ref" v-model="reference" class="input" placeholder="Optional" />
        </div>
      </div>
      <ProofPicker v-model="proof" />
      <div>
        <label class="label" for="notes">Note <span class="font-normal text-ink-faint">(optional)</span></label>
        <input id="notes" v-model="notes" class="input" />
      </div>
    </template>

    <ErrorBox :message="error" />
    <button class="btn-primary w-full" :disabled="busy">
      {{ busy ? 'Please wait…' : method === 'Paystack' ? `Pay ${amount ? money(amount, currency) : ''}` : 'Submit payment' }}
    </button>
  </form>
</template>
