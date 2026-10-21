<script setup>
// Shared by Save and Repay. Money only comes in through Paystack: checkout in the app
// (card, bank transfer or USSD) or a transfer to the member's personal account number.
import { ref, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import * as api from '../api'
import { state, current, currency, dashboard, copyText, toast } from '../store'
import { money, periodWord, feeRule as describeFee } from '../format'
import { payWithPaystack, receiptPath } from '../payments'
import AmountField from './AmountField.vue'
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
const online = computed(() => !!d.value?.payments?.online)
const dva = computed(() => props.purpose === 'Contribution' && d.value?.dedicated_account?.status === 'Assigned' ? d.value.dedicated_account : null)
const canAutosave = computed(() => props.purpose === 'Contribution' && d.value?.payments?.autosave && !d.value?.autosave?.enabled && d.value?.standing?.tracked)
const fees = computed(() => d.value?.payments?.fees)
const memberPaysFee = computed(() => d.value?.payments?.fee_bearer === 'Member')

const amount = ref(props.initial || '')
const method = ref(online.value ? 'online' : dva.value ? 'dva' : 'online')
const autosave = ref(false)
const busy = ref(false)
const error = ref('')
const quote = ref(null)

const value = computed(() => Number(amount.value) || 0)
const overMax = computed(() => props.max != null && value.value > props.max + 0.005)

let quoteTimer
watch([value, method], () => {
  clearTimeout(quoteTimer)
  quote.value = null
  if (method.value !== 'online' || value.value < 100 || !memberPaysFee.value) return
  quoteTimer = setTimeout(async () => {
    try { quote.value = await api.get('payments.quote', { cooperative: current.value.cooperative, amount: value.value }) } catch {}
  }, 300)
}, { immediate: true })

const total = computed(() => (quote.value && Number(quote.value.amount) === value.value ? quote.value.total : value.value))
const feeRule = computed(() => fees.value && `${describeFee(fees.value, currency.value)}. It’s added so the full amount reaches the pool.`)

async function submit() {
  error.value = ''
  if (!(value.value > 0)) return (error.value = 'Enter an amount')
  if (overMax.value) return (error.value = `The most you can pay is ${money(props.max, currency.value)}`)
  if (value.value < 100) return (error.value = `The minimum online payment is ${money(100, currency.value)}`)
  busy.value = true
  try {
    const tx = await payWithPaystack({
      cooperative: current.value.cooperative, purpose: props.purpose, amount: value.value, loan: props.loan,
      setup_autosave: autosave.value ? 1 : 0,
    })
    if (!tx) return // closed the popup
    if (tx.status === 'Success') return router.replace(receiptPath(tx))
    if (tx.status === 'Failed') throw new Error(tx.message || 'The payment did not go through. You have not been charged.')
    toast('Payment is processing. We’ll update your balance as soon as Paystack confirms it.')
    router.replace(props.loan ? `/loans/${props.loan}` : '/activity')
  } catch (e) {
    error.value = e.message
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div v-if="!online && !dva" class="card p-6 text-center">
    <div class="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-warn-soft text-warn"><Icon name="info" /></div>
    <p class="mt-3 font-semibold">Online payments aren’t switched on yet</p>
    <p class="mt-1 text-sm text-ink-soft">Ask your cooperative’s admin to turn them on. Payments are only accepted through Paystack, so there’s nothing to upload or confirm by hand.</p>
  </div>

  <form v-else class="space-y-6" @submit.prevent="submit">
    <AmountField v-if="method === 'online'" v-model="amount" :currency="currency" :chips="chips" :invalid="overMax"
      :label="purpose === 'Contribution' ? 'How much are you saving?' : 'How much are you repaying?'" />
    <p v-if="overMax" class="-mt-4 text-sm text-neg">That’s more than the {{ money(max, currency) }} you owe.</p>

    <fieldset v-if="online && dva" class="seg grid-cols-2">
      <legend class="sr-only">How would you like to pay?</legend>
      <button type="button" :class="{ on: method === 'online' }" @click="method = 'online'">Pay now</button>
      <button type="button" :class="{ on: method === 'dva' }" @click="method = 'dva'">Bank transfer</button>
    </fieldset>

    <!-- Online checkout -->
    <template v-if="method === 'online'">
      <div class="flex items-start gap-3 rounded-3xl bg-brand-soft/70 p-4">
        <span class="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-card text-brand-text shadow-sm"><Icon name="zap" /></span>
        <p class="text-sm"><b class="block text-[15px]">Pay securely with Paystack</b><span class="text-ink-soft">Card, bank transfer or USSD. Confirmed the moment it goes through, with a receipt.</span></p>
      </div>
      <div v-if="value >= 100" class="card-flat divide-soft px-4 text-sm">
        <div class="flex justify-between py-3"><span class="text-ink-soft">{{ purpose === 'Contribution' ? 'Added to your savings' : 'Paid off your loan' }}</span><span class="num font-semibold">{{ money(value, currency) }}</span></div>
        <div v-if="memberPaysFee" class="py-3">
          <div class="flex justify-between"><span class="text-ink-soft">Paystack fee</span><span class="num">{{ quote ? money(quote.fee, currency) : '…' }}</span></div>
          <p class="mt-1 text-xs leading-relaxed text-ink-faint">{{ feeRule }}</p>
        </div>
        <div class="flex justify-between py-3"><span class="font-semibold">You pay</span><span class="money text-lg">{{ money(total, currency) }}</span></div>
      </div>
      <label v-if="canAutosave" class="flex cursor-pointer items-start gap-3 rounded-3xl bg-sunk p-4">
        <input v-model="autosave" type="checkbox" class="mt-1 h-5 w-5 rounded accent-[rgb(var(--brand))]" />
        <span class="text-sm">
          <span class="block font-semibold">Pay this automatically every {{ periodWord(d.standing.frequency) }}</span>
          <span class="block text-ink-soft">We’ll save your card securely with Paystack and charge your regular {{ money(d.standing.amount, currency) }} each {{ periodWord(d.standing.frequency) }}, starting when the next one is due. We remind you 2 days before. Turn it off any time.</span>
        </span>
      </label>
      <ErrorBox :message="error" />
      <button class="btn-primary btn-lg w-full" :disabled="busy || overMax">
        <template v-if="busy">Opening secure checkout…</template>
        <template v-else><Icon name="lock" :size="18" /> Pay {{ value ? money(total, currency) : '' }}</template>
      </button>
      <p class="-mt-3 text-center text-xs text-ink-faint">Secured by Paystack. Cooperative360 never sees your card details.</p>
      <p v-if="state.paystack.test_mode" class="flex gap-2 rounded-2xl bg-info-soft p-3 text-xs text-info">
        <Icon name="info" :size="16" class="shrink-0" />
        <span>Demo mode: no real money moves. In the Paystack window choose <b>Success</b>, or use the test card <b class="num">4084 0840 8408 4081</b>, any future expiry, CVV <b>408</b>.</span>
      </p>
    </template>

    <!-- Personal account number -->
    <div v-else class="card p-5">
      <p class="text-sm text-ink-soft">Send any amount to your savings account number</p>
      <div class="mt-2 flex items-center justify-between gap-3">
        <p class="money text-3xl tracking-wider">{{ dva.account_number }}</p>
        <button type="button" class="btn-secondary btn-sm" @click="copyText(dva.account_number, 'Account number copied')"><Icon name="copy" :size="16" /> Copy</button>
      </div>
      <p class="text-sm text-ink-soft">{{ dva.bank_name }} · {{ dva.account_name }}</p>
      <p class="mt-4 flex gap-2 rounded-2xl bg-pos-soft p-3 text-sm text-pos"><Icon name="checkCircle" :size="18" class="mt-0.5" /> Paystack confirms the transfer and your savings update automatically.</p>
    </div>
  </form>
</template>
