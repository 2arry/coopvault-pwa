<script setup>
// Shared by Save and Repay: pay online (Paystack popup), transfer to a dedicated account,
// or record a payment already made (bank transfer / cash) for the treasurer to confirm.
import { ref, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import * as api from '../api'
import { current, currency, isAdmin, dashboard, copyText, toast } from '../store'
import { money, today, periodWord } from '../format'
import { payWithPaystack, receiptPath } from '../payments'
import AmountField from './AmountField.vue'
import ProofPicker from './ProofPicker.vue'
import ErrorBox from './ErrorBox.vue'
import Icon from './Icon.vue'

const props = defineProps({
  purpose: { type: String, required: true }, // 'Contribution' | 'Loan Repayment'
  loan: String,
  max: Number,
  initial: [Number, String],
  chips: { type: Array, default: () => [] },
})
const router = useRouter()
const d = computed(() => dashboard.value)
const coop = computed(() => d.value?.cooperative || {})
const online = computed(() => !!d.value?.payments?.online)
const dva = computed(() => props.purpose === 'Contribution' && d.value?.dedicated_account?.status === 'Assigned' ? d.value.dedicated_account : null)
const canAutosave = computed(() => props.purpose === 'Contribution' && d.value?.payments?.autosave && !d.value?.autosave?.enabled && d.value?.standing?.tracked)

const amount = ref(props.initial || '')
const method = ref(online.value ? 'online' : 'manual')
const manualKind = ref('Bank Transfer')
const autosave = ref(false)
const reference = ref('')
const notes = ref('')
const paidOn = ref(today())
const proof = ref(null)
const busy = ref(false)
const error = ref('')
const quote = ref(null)

const value = computed(() => Number(amount.value) || 0)
const overMax = computed(() => props.max != null && value.value > props.max + 0.005)

let quoteTimer
watch([value, method], () => {
  clearTimeout(quoteTimer)
  quote.value = null
  if (method.value !== 'online' || value.value < 100 || d.value?.payments?.fee_bearer !== 'Member') return
  quoteTimer = setTimeout(async () => {
    try { quote.value = await api.get('payments.quote', { cooperative: current.value.cooperative, amount: value.value }) } catch {}
  }, 300)
}, { immediate: true })

const total = computed(() => (quote.value && Number(quote.value.amount) === value.value ? quote.value.total : value.value))

function validate() {
  if (!(value.value > 0)) return 'Enter an amount'
  if (overMax.value) return `The most you can pay is ${money(props.max, currency.value)}`
  if (method.value === 'online' && value.value < 100) return `The minimum online payment is ${money(100, currency.value)}`
  return ''
}

async function payOnline() {
  const tx = await payWithPaystack({
    cooperative: current.value.cooperative, purpose: props.purpose, amount: value.value, loan: props.loan,
    setup_autosave: autosave.value ? 1 : 0,
  })
  if (!tx) return // closed the popup
  if (tx.status === 'Success') return router.replace(receiptPath(tx))
  if (tx.status === 'Failed') throw new Error(tx.message || 'The payment did not go through. You have not been charged.')
  toast('Payment is processing. We’ll update your balance as soon as Paystack confirms it.')
  router.replace(props.loan ? `/loans/${props.loan}` : '/activity')
}

async function recordManual() {
  const payload = { amount: value.value, payment_method: manualKind.value, reference: reference.value, notes: notes.value }
  if (proof.value) {
    payload.proof_data = await api.fileToDataUrl(proof.value)
    payload.proof_filename = proof.value.name
  }
  const doc = props.purpose === 'Contribution'
    ? await api.post('finance.record_contribution', { ...payload, cooperative: current.value.cooperative, contribution_date: paidOn.value })
    : await api.post('finance.record_repayment', { ...payload, loan: props.loan, payment_date: paidOn.value })
  router.replace(`/receipt/${encodeURIComponent(doc.doctype)}/${encodeURIComponent(doc.name)}?new=1`)
}

async function submit() {
  error.value = validate()
  if (error.value) return
  busy.value = true
  try {
    await (method.value === 'online' ? payOnline() : recordManual())
  } catch (e) {
    error.value = e.message
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <form class="space-y-6" @submit.prevent="submit">
    <AmountField v-model="amount" :currency="currency" :chips="chips" :invalid="overMax" :label="purpose === 'Contribution' ? 'How much are you saving?' : 'How much are you repaying?'" />
    <p v-if="overMax" class="-mt-4 text-sm text-neg">That’s more than the {{ money(max, currency) }} you owe.</p>

    <!-- Method -->
    <fieldset class="space-y-2.5">
      <legend class="label">How would you like to pay?</legend>
      <label v-if="online" class="flex cursor-pointer items-start gap-3.5 rounded-3xl border p-4 transition"
        :class="method === 'online' ? 'border-brand-text/50 bg-brand-soft/60 ring-4 ring-brand-text/10' : 'border-line/12 bg-card'">
        <input v-model="method" type="radio" value="online" class="sr-only" />
        <span class="grid h-10 w-10 place-items-center rounded-2xl bg-card text-brand-text shadow-sm"><Icon name="zap" /></span>
        <span class="flex-1">
          <span class="block font-semibold">Pay now</span>
          <span class="block text-sm text-ink-soft">Card, bank transfer or USSD. Confirmed instantly.</span>
        </span>
        <span class="mt-1 grid h-5 w-5 place-items-center rounded-full border-2" :class="method === 'online' ? 'border-brand-text' : 'border-line/25'"><span v-if="method === 'online'" class="h-2.5 w-2.5 rounded-full bg-brand-text" /></span>
      </label>
      <label v-if="dva" class="flex cursor-pointer items-start gap-3.5 rounded-3xl border p-4 transition"
        :class="method === 'dva' ? 'border-brand-text/50 bg-brand-soft/60 ring-4 ring-brand-text/10' : 'border-line/12 bg-card'">
        <input v-model="method" type="radio" value="dva" class="sr-only" />
        <span class="grid h-10 w-10 place-items-center rounded-2xl bg-card text-brand-text shadow-sm"><Icon name="bank" /></span>
        <span class="flex-1">
          <span class="block font-semibold">Transfer to your account number</span>
          <span class="block text-sm text-ink-soft">From any bank app. Recorded automatically.</span>
        </span>
        <span class="mt-1 grid h-5 w-5 place-items-center rounded-full border-2" :class="method === 'dva' ? 'border-brand-text' : 'border-line/25'"><span v-if="method === 'dva'" class="h-2.5 w-2.5 rounded-full bg-brand-text" /></span>
      </label>
      <label class="flex cursor-pointer items-start gap-3.5 rounded-3xl border p-4 transition"
        :class="method === 'manual' ? 'border-brand-text/50 bg-brand-soft/60 ring-4 ring-brand-text/10' : 'border-line/12 bg-card'">
        <input v-model="method" type="radio" value="manual" class="sr-only" />
        <span class="grid h-10 w-10 place-items-center rounded-2xl bg-card text-brand-text shadow-sm"><Icon name="receipt" /></span>
        <span class="flex-1">
          <span class="block font-semibold">{{ isAdmin ? 'Record a payment' : 'I’ve already paid' }}</span>
          <span class="block text-sm text-ink-soft">{{ isAdmin ? 'Transfer or cash you received. Confirmed straight away.' : 'Bank transfer or cash. The treasurer confirms it.' }}</span>
        </span>
        <span class="mt-1 grid h-5 w-5 place-items-center rounded-full border-2" :class="method === 'manual' ? 'border-brand-text' : 'border-line/25'"><span v-if="method === 'manual'" class="h-2.5 w-2.5 rounded-full bg-brand-text" /></span>
      </label>
    </fieldset>

    <!-- Online -->
    <template v-if="method === 'online'">
      <div v-if="value >= 100" class="card-flat divide-soft px-4 text-sm">
        <div class="flex justify-between py-3"><span class="text-ink-soft">{{ purpose === 'Contribution' ? 'Added to your savings' : 'Paid off your loan' }}</span><span class="num font-semibold">{{ money(value, currency) }}</span></div>
        <div v-if="d?.payments?.fee_bearer === 'Member'" class="flex justify-between py-3">
          <span class="text-ink-soft">Paystack fee</span>
          <span class="num">{{ quote ? money(quote.fee, currency) : '…' }}</span>
        </div>
        <div class="flex justify-between py-3"><span class="font-semibold">You pay</span><span class="money text-lg">{{ money(total, currency) }}</span></div>
      </div>
      <label v-if="canAutosave" class="flex cursor-pointer items-start gap-3 rounded-3xl bg-sunk p-4">
        <input v-model="autosave" type="checkbox" class="mt-1 h-5 w-5 rounded accent-[rgb(var(--brand))]" />
        <span class="text-sm">
          <span class="block font-semibold">Pay this automatically every {{ periodWord(d.standing.frequency) }}</span>
          <span class="block text-ink-soft">We’ll save your card securely with Paystack and charge your regular {{ money(d.standing.amount, currency) }} each {{ periodWord(d.standing.frequency) }}, starting when the next one is due. Turn it off any time.</span>
        </span>
      </label>
    </template>

    <!-- Dedicated account -->
    <div v-else-if="method === 'dva'" class="card p-5">
      <p class="text-sm text-ink-soft">Send {{ value ? money(value, currency) : 'any amount' }} to</p>
      <div class="mt-2 flex items-center justify-between gap-3">
        <p class="money text-3xl tracking-wider">{{ dva.account_number }}</p>
        <button type="button" class="btn-secondary btn-sm" @click="copyText(dva.account_number, 'Account number copied')"><Icon name="copy" :size="16" /> Copy</button>
      </div>
      <p class="text-sm text-ink-soft">{{ dva.bank_name }} · {{ dva.account_name }}</p>
      <p class="mt-4 flex gap-2 rounded-2xl bg-pos-soft p-3 text-sm text-pos"><Icon name="checkCircle" :size="18" class="mt-0.5" /> No form needed. Your savings update as soon as the transfer lands.</p>
    </div>

    <!-- Manual record -->
    <template v-else>
      <div class="seg grid-cols-2">
        <button type="button" :class="{ on: manualKind === 'Bank Transfer' }" @click="manualKind = 'Bank Transfer'">Bank transfer</button>
        <button type="button" :class="{ on: manualKind === 'Cash' }" @click="manualKind = 'Cash'">Cash</button>
      </div>
      <div v-if="manualKind === 'Bank Transfer' && coop.account_number" class="card p-5">
        <div class="flex items-center justify-between">
          <p class="text-sm text-ink-soft">Cooperative account</p>
          <span v-if="coop.account_verified" class="chip bg-pos-soft text-pos"><Icon name="checkCircle" :size="13" /> Verified</span>
        </div>
        <div class="mt-2 flex items-center justify-between gap-3">
          <p class="money text-[28px] tracking-wider">{{ coop.account_number }}</p>
          <button type="button" class="btn-secondary btn-sm" @click="copyText(coop.account_number, 'Account number copied')"><Icon name="copy" :size="16" /> Copy</button>
        </div>
        <p class="text-sm text-ink-soft">{{ coop.bank_name }} · {{ coop.account_name }}</p>
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
      <ProofPicker v-if="manualKind === 'Bank Transfer'" v-model="proof" />
      <div>
        <label class="label" for="notes">Note <span class="font-normal text-ink-faint">(optional)</span></label>
        <input id="notes" v-model="notes" class="input" :placeholder="manualKind === 'Cash' ? 'e.g. Paid at the October meeting' : ''" />
      </div>
      <p v-if="!isAdmin" class="flex gap-2 text-xs text-ink-soft"><Icon name="info" :size="16" /> It shows as “awaiting approval” until the treasurer confirms the money arrived.</p>
    </template>

    <ErrorBox :message="error" />
    <button v-if="method !== 'dva'" class="btn-primary btn-lg w-full" :disabled="busy || overMax">
      <template v-if="busy">{{ method === 'online' ? 'Opening secure checkout…' : 'Saving…' }}</template>
      <template v-else-if="method === 'online'"><Icon name="lock" :size="18" /> Pay {{ value ? money(total, currency) : '' }}</template>
      <template v-else>{{ isAdmin ? 'Record payment' : 'Send for confirmation' }}</template>
    </button>
    <p v-if="method === 'online'" class="-mt-3 text-center text-xs text-ink-faint">Secured by Paystack. CoopVault never sees your card details.</p>
  </form>
</template>
