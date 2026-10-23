<script setup>
// One payment for everything that's due: contributions first, then loan instalments, plus any
// extra savings. Paystack charges once; the server records each part separately.
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import * as api from '../api'
import { state, current, currency, dashboard, loadDashboard } from '../store'
import { money, feeRule as describeFee } from '../format'
import { payWithPaystack, receiptPath } from '../payments'
import PageHeader from '../components/PageHeader.vue'
import Loader from '../components/Loader.vue'
import ErrorBox from '../components/ErrorBox.vue'
import Icon from '../components/Icon.vue'

const router = useRouter()
const plan = ref(null)
const lines = ref([])
const extras = ref([])
const error = ref('')
const busy = ref(false)
const quote = ref(null)
const online = computed(() => !!dashboard.value?.payments?.online)
const memberPaysFee = computed(() => dashboard.value?.payments?.fee_bearer === 'Member')
const fees = computed(() => dashboard.value?.payments?.fees)

onMounted(async () => {
  try {
    if (!dashboard.value) await loadDashboard()
    plan.value = await api.get('finance.payment_plan', { cooperative: current.value.cooperative })
    const balance = Object.fromEntries(plan.value.loans.map((l) => [l.name, l.balance]))
    lines.value = plan.value.due.map((d) => ({ ...d, on: true, max: d.kind === 'loan' ? balance[d.loan] : null,
      sub: d.kind === 'loan' ? `${money(balance[d.loan], currency.value)} left to repay` : 'Brings your contributions up to date' }))
    const dueProducts = new Set(plan.value.due.filter((d) => d.kind === 'savings').map((d) => d.savings_product))
    extras.value = plan.value.products.filter((p) => !dueProducts.has(p.name)).map((p) => ({ kind: 'savings', savings_product: p.name,
      label: p.kind === 'Regular contributions' ? 'Pay ahead on contributions' : p.product_name, amount: '' }))
  } catch (e) { error.value = e.message }
})

const chosen = computed(() => [...lines.value.filter((l) => l.on), ...extras.value]
  .map((l) => ({ kind: l.kind, loan: l.loan, savings_product: l.savings_product, amount: Number(l.amount) || 0 }))
  .filter((l) => l.amount > 0))
const total = computed(() => Math.round(chosen.value.reduce((t, l) => t + l.amount, 0) * 100) / 100)
const tooMuch = computed(() => lines.value.find((l) => l.on && l.max != null && Number(l.amount) > l.max + 0.005))

let timer
watch(total, (v) => {
  clearTimeout(timer)
  quote.value = null
  if (v < 100 || !memberPaysFee.value) return
  timer = setTimeout(async () => {
    try { quote.value = await api.get('payments.quote', { cooperative: current.value.cooperative, amount: v }) } catch {}
  }, 300)
})
const charge = computed(() => (quote.value && Number(quote.value.amount) === total.value ? quote.value.total : total.value))

async function pay() {
  error.value = ''
  if (tooMuch.value) return (error.value = `That’s more than the ${money(tooMuch.value.max, currency.value)} left on ${tooMuch.value.loan}`)
  if (total.value < 100) return (error.value = `The minimum online payment is ${money(100, currency.value)}`)
  busy.value = true
  try {
    const tx = await payWithPaystack({ cooperative: current.value.cooperative, purpose: 'Split', allocations: chosen.value })
    if (!tx) return
    if (tx.status === 'Success') return router.replace(receiptPath(tx))
    if (tx.status === 'Failed') throw new Error(tx.message || 'The payment did not go through. You have not been charged.')
    router.replace('/activity')
  } catch (e) { error.value = e.message } finally { busy.value = false }
}
</script>

<template>
  <div>
    <PageHeader title="Pay what’s due" :subtitle="current?.cooperative_name" back="/home" />
    <div class="space-y-5 px-5 pb-12 pt-1">
      <ErrorBox v-if="!plan" :message="error" />
      <Loader v-if="!plan && !error" />
      <template v-if="plan">
        <div v-if="!online" class="card p-6 text-center">
          <p class="font-semibold">Online payments aren’t switched on yet</p>
          <p class="mt-1 text-sm text-ink-soft">Ask your cooperative’s admin to turn them on.</p>
        </div>
        <template v-else>
          <section>
            <h2 class="section-title">{{ lines.length ? 'Due now' : 'Nothing is due' }}</h2>
            <p v-if="!lines.length" class="mt-1 text-sm text-ink-soft">Your contributions and loan payments are up to date. You can still save extra below.</p>
            <div v-else class="card mt-3 divide-soft">
              <div v-for="(l, i) in lines" :key="i" class="flex items-center gap-3 p-4">
                <input :id="`due-${i}`" v-model="l.on" type="checkbox" class="h-5 w-5 shrink-0 accent-[rgb(var(--brand))]" />
                <label :for="`due-${i}`" class="min-w-0 flex-1">
                  <span class="block text-[15px] font-semibold">{{ l.label }}</span>
                  <span class="block truncate text-xs text-ink-soft">{{ l.sub }}</span>
                </label>
                <input v-model="l.amount" type="number" inputmode="decimal" min="0" step="0.01" :disabled="!l.on" :aria-label="`Amount for ${l.label}`"
                  class="input num w-32 py-2 text-right" :class="l.on && l.max != null && Number(l.amount) > l.max + 0.005 ? 'border-neg/60' : ''" />
              </div>
            </div>
            <p v-if="lines.length > 1" class="hint">Contributions are paid first, then loan instalments. You can change any amount.</p>
          </section>

          <section v-if="extras.length">
            <h2 class="section-title">Save extra <span class="font-normal text-ink-faint">(optional)</span></h2>
            <div class="card mt-3 divide-soft">
              <div v-for="(x, i) in extras" :key="x.savings_product" class="flex items-center gap-3 p-4">
                <span class="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-pos-soft text-pos"><Icon name="arrowDown" :size="17" /></span>
                <label :for="`extra-${i}`" class="min-w-0 flex-1 text-[15px] font-semibold">{{ x.label }}</label>
                <input :id="`extra-${i}`" v-model="x.amount" type="number" inputmode="decimal" min="0" step="0.01" placeholder="0" class="input num w-32 py-2 text-right" />
              </div>
            </div>
          </section>

          <div v-if="total > 0" class="card-flat divide-soft px-4 text-sm">
            <div v-for="(c, i) in chosen" :key="i" class="flex justify-between py-2.5">
              <span class="text-ink-soft">{{ [...lines, ...extras].find((l) => (c.kind === 'loan' ? l.loan === c.loan : l.savings_product === c.savings_product))?.label }}</span>
              <span class="num">{{ money(c.amount, currency) }}</span>
            </div>
            <div v-if="memberPaysFee" class="py-3">
              <div class="flex justify-between"><span class="text-ink-soft">Paystack fee</span><span class="num">{{ quote ? money(quote.fee, currency) : '…' }}</span></div>
              <p v-if="fees" class="mt-1 text-xs text-ink-faint">{{ describeFee(fees, currency) }}. It’s added so the full amount reaches the pool.</p>
            </div>
            <div class="flex justify-between py-3"><span class="font-semibold">You pay</span><span class="money text-lg">{{ money(charge, currency) }}</span></div>
          </div>

          <ErrorBox :message="error" />
          <button class="btn-primary btn-lg w-full" :disabled="busy || total <= 0" @click="pay">
            <template v-if="busy">Opening secure checkout…</template>
            <template v-else><Icon name="lock" :size="18" /> Pay {{ total > 0 ? money(charge, currency) : '' }}</template>
          </button>
          <p class="-mt-2 text-center text-xs text-ink-faint">One payment through Paystack. You get one receipt that lists each part.</p>
          <p v-if="state.paystack.test_mode" class="flex gap-2 rounded-2xl bg-info-soft p-3 text-xs text-info">
            <Icon name="info" :size="16" class="shrink-0" />
            <span>Demo mode: no real money moves. In the Paystack window choose <b>Success</b>, or use the test card <b class="num">4084 0840 8408 4081</b>, any future expiry, CVV <b>408</b>.</span>
          </p>
        </template>
      </template>
    </div>
  </div>
</template>
