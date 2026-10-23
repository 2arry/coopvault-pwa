<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import * as api from '../api'
import { current, currency, toast, loadDashboard } from '../store'
import { money, date } from '../format'
import PageHeader from '../components/PageHeader.vue'
import AmountField from '../components/AmountField.vue'
import ErrorBox from '../components/ErrorBox.vue'
import Loader from '../components/Loader.vue'
import Icon from '../components/Icon.vue'

const router = useRouter()
const info = ref(null)
const products = ref([])
const productId = ref('')
const amount = ref('')
const tenure = ref(1)
const purpose = ref('')
const quote = ref(null)
const quoting = ref(false)
const showRows = ref(false)
const members = ref([])
const guarantors = ref([]) // [{ member, amount }]
const busy = ref(false)
const error = ref('')

onMounted(async () => {
  try {
    const [elig, prods] = await Promise.all([
      api.get('finance.loan_eligibility', { cooperative: current.value.cooperative }),
      api.get('finance.loan_products', { cooperative: current.value.cooperative }),
    ])
    info.value = elig
    products.value = prods
    choose(prods[0])
  } catch (e) { error.value = e.message }
})

const product = computed(() => products.value.find((p) => p.name === productId.value))
function choose(p) {
  if (!p) return
  productId.value = p.name
  tenure.value = Math.min(Math.max(3, p.min_tenure_months), p.max_tenure_months)
  guarantors.value = []
  if (p.guarantors_required && !members.value.length) {
    api.get('coop.list_members', { cooperative: current.value.cooperative })
      .then((list) => { members.value = list.filter((m) => m.status === 'Active' && m.name !== current.value.name) }).catch(() => {})
  }
}
const months = computed(() => {
  const p = product.value
  return p ? Array.from({ length: p.max_tenure_months - p.min_tenure_months + 1 }, (_, i) => p.min_tenure_months + i) : []
})
const value = computed(() => Number(amount.value) || 0)
const limit = computed(() => quote.value?.eligibility?.max_amount ?? Math.max(0, (info.value?.borrow_limit || 0)))
const maxNow = computed(() => Math.max(0, Math.min(limit.value, info.value?.pool_balance || 0)))
const chips = computed(() => {
  const m = maxNow.value
  if (m <= 0) return []
  const round = (x) => Math.max(1000, Math.floor(x / 1000) * 1000)
  return [...new Set([round(m * 0.25), round(m * 0.5), Math.floor(m)])].filter((x) => x <= m)
    .map((x) => ({ label: x === Math.floor(m) ? `Max · ${money(x, currency.value)}` : money(x, currency.value), value: x }))
})

// Live quote: instalments, cost and the eligibility checklist
let timer
watch([productId, value, tenure], () => {
  clearTimeout(timer)
  if (!productId.value) return
  timer = setTimeout(async () => {
    quoting.value = true
    try {
      quote.value = await api.get('finance.loan_quote', { cooperative: current.value.cooperative, product: productId.value,
        amount: value.value || 0, tenure_months: tenure.value })
    } catch (e) { error.value = e.message } finally { quoting.value = false }
  }, 300)
}, { immediate: true })

const checks = computed(() => (quote.value?.eligibility?.checks || []).filter((c) => value.value > 0 || c.key !== 'amount'))
const failing = computed(() => checks.value.filter((c) => !c.ok))
const needsPayout = computed(() => failing.value.some((c) => c.key === 'payout'))
const hold = computed(() => {
  const h = info.value?.security_hold_until
  return h && new Date(String(h).replace(' ', 'T')) > new Date() ? h : null
})

// Guarantors
const needGuarantors = computed(() => product.value?.guarantors_required || 0)
const cover = computed(() => (value.value * (product.value?.guarantee_percent || 0)) / 100)
const pledged = computed(() => guarantors.value.reduce((s, g) => s + (Number(g.amount) || 0), 0))
const guarantorsOk = computed(() => !needGuarantors.value ||
  (guarantors.value.filter((g) => g.member).length >= needGuarantors.value && pledged.value + 0.005 >= cover.value))
function addGuarantor() {
  const share = needGuarantors.value ? Math.ceil(cover.value / needGuarantors.value) : 0
  guarantors.value.push({ member: '', amount: share || '' })
}
watch(needGuarantors, (n) => { while (guarantors.value.length < n) addGuarantor() }, { immediate: true })
const available = (g) => members.value.filter((m) => m.name === g.member || !guarantors.value.some((x) => x.member === m.name))

const canSubmit = computed(() => value.value > 0 && !failing.value.length && guarantorsOk.value && !hold.value && !quoting.value)

async function submit() {
  busy.value = true
  error.value = ''
  try {
    const loan = await api.post('finance.apply_loan', {
      cooperative: current.value.cooperative, amount: value.value, tenure_months: tenure.value, purpose: purpose.value,
      product: productId.value, guarantors: guarantors.value.filter((g) => g.member).map((g) => ({ member: g.member, amount: Number(g.amount) })),
    })
    toast(needGuarantors.value ? 'Request sent. Your guarantors have been asked to agree.' : 'Loan request sent')
    loadDashboard().catch(() => {})
    router.replace(`/loans/${loan.name}`)
  } catch (e) { error.value = e.message } finally { busy.value = false }
}
</script>

<template>
  <div>
    <PageHeader title="Borrow" back="/loans" />
    <div class="px-5 pb-12 pt-1">
      <Loader v-if="!info && !error" />
      <ErrorBox v-if="!info" :message="error" />
      <form v-else class="space-y-6" @submit.prevent="submit">
        <!-- Which loan -->
        <div v-if="products.length > 1" class="space-y-2">
          <span class="label">Which loan?</span>
          <button v-for="p in products" :key="p.name" type="button" class="flex w-full items-start gap-3 rounded-3xl border p-4 text-left transition"
            :class="productId === p.name ? 'border-brand-text/40 bg-brand-soft/60' : 'border-line/10 bg-card'" @click="choose(p)">
            <span class="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border-2" :class="productId === p.name ? 'border-brand-text' : 'border-line/25'">
              <span v-if="productId === p.name" class="h-2.5 w-2.5 rounded-full bg-brand-text" />
            </span>
            <span class="min-w-0 flex-1">
              <span class="block font-semibold">{{ p.product_name }}</span>
              <span class="block text-sm text-ink-soft">{{ p.rate_text }} · up to {{ p.max_tenure_months }} months</span>
              <span v-if="p.description" class="mt-1 block text-xs text-ink-soft">{{ p.description }}</span>
              <span v-if="p.guarantors_required" class="mt-1.5 inline-block rounded-md bg-sunk px-1.5 py-0.5 text-[11px] font-semibold text-ink-soft">{{ p.guarantors_required }} guarantor{{ p.guarantors_required > 1 ? 's' : '' }}</span>
            </span>
          </button>
        </div>

        <div class="card p-5">
          <p class="text-sm text-ink-soft">You can borrow up to</p>
          <p class="money text-[36px] leading-tight text-brand-text">{{ money(limit, currency) }}</p>
          <p class="mt-1 text-xs text-ink-soft">Never more than you’ve saved, less what you owe{{ info.pledged > 0 ? ' and what you’ve guaranteed for others' : '' }}.</p>
          <p v-if="info.pool_balance < limit" class="mt-3 flex gap-2 rounded-2xl bg-accent-soft p-3 text-xs text-accent-text">
            <Icon name="info" :size="16" class="shrink-0" /> The pool has {{ money(info.pool_balance, currency) }} right now, so bigger loans wait until more is saved.
          </p>
        </div>

        <template v-if="limit > 0">
          <AmountField v-model="amount" :currency="currency" :chips="chips" :invalid="value > limit + 0.005" label="How much do you need?" />
          <div>
            <span class="label">Pay back over</span>
            <div class="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1">
              <button v-for="m in months" :key="m" type="button" class="shrink-0 rounded-2xl border px-4 py-2.5 text-sm font-semibold transition"
                :class="tenure === m ? 'border-brand-text/40 bg-brand-soft text-brand-text' : 'border-line/12 bg-card text-ink-soft'"
                @click="tenure = m">{{ m }} month{{ m > 1 ? 's' : '' }}</button>
            </div>
          </div>

          <!-- What it costs -->
          <div v-if="value > 0 && quote" class="card-flat divide-soft px-4 text-sm" :class="quoting ? 'opacity-60' : ''">
            <div class="flex items-baseline justify-between py-3"><span class="font-semibold">Each month</span><span class="money text-xl">{{ money(quote.first_instalment, currency) }}<span class="font-sans text-xs text-ink-soft"> × {{ tenure }}</span></span></div>
            <div class="py-3">
              <div class="flex justify-between"><span class="text-ink-soft">Interest · {{ quote.rate_text }}</span><span class="num">{{ money(quote.total_interest, currency) }}</span></div>
              <p v-if="product?.interest_method === 'Flat' && quote.total_interest" class="mt-1 text-xs text-ink-faint">Flat: interest is worked out on the full amount for the whole term.</p>
              <p v-else-if="product?.interest_method === 'Reducing balance'" class="mt-1 text-xs text-ink-faint">Each month’s interest is on what you still owe, so it falls as you repay.</p>
            </div>
            <div class="flex justify-between py-3"><span class="text-ink-soft">Total to pay back</span><span class="num font-semibold">{{ money(quote.total_payable, currency) }}</span></div>
            <div v-if="quote.processing_fee" class="flex justify-between py-3"><span class="text-ink-soft">Processing fee (taken off what’s sent)</span><span class="num">− {{ money(quote.processing_fee, currency) }}</span></div>
            <div class="flex justify-between py-3"><span class="text-ink-soft">You receive</span><span class="num font-semibold">{{ money(quote.you_receive, currency) }}</span></div>
            <button type="button" class="flex w-full items-center justify-between py-3 text-left font-semibold text-brand-text" @click="showRows = !showRows">
              Repayment plan <Icon name="chevronDown" :size="16" :class="showRows ? 'rotate-180' : ''" />
            </button>
            <div v-if="showRows" class="pb-3">
              <div class="grid grid-cols-[auto_1fr_auto_auto] gap-x-3 gap-y-1.5 text-xs">
                <span class="text-ink-faint">#</span><span class="text-ink-faint">Due</span><span class="text-right text-ink-faint">Interest</span><span class="text-right text-ink-faint">Total</span>
                <template v-for="r in quote.rows" :key="r.number">
                  <span class="text-ink-soft">{{ r.number }}</span><span>{{ date(r.due_date, { day: 'numeric', month: 'short' }) }}</span>
                  <span class="num text-right text-ink-soft">{{ money(r.interest, currency) }}</span><span class="num text-right font-semibold">{{ money(r.principal + r.interest, currency) }}</span>
                </template>
              </div>
              <p class="mt-2 text-[11px] text-ink-faint">Dates start from the day you confirm the money arrived.</p>
            </div>
          </div>

          <!-- Guarantors -->
          <div v-if="needGuarantors" class="space-y-3">
            <div>
              <span class="label">Guarantors</span>
              <p class="text-xs text-ink-soft">{{ product.product_name }} needs {{ needGuarantors }} member{{ needGuarantors > 1 ? 's' : '' }} to guarantee at least {{ money(cover, currency) }}. They’re asked in the app, and what they promise is held from their own savings until you’ve repaid.</p>
            </div>
            <div v-for="(g, i) in guarantors" :key="i" class="card grid grid-cols-[1fr_auto] gap-2 p-3">
              <select v-model="g.member" class="input py-2.5 text-sm" required :aria-label="`Guarantor ${i + 1}`">
                <option value="" disabled>Choose a member</option>
                <option v-for="m in available(g)" :key="m.name" :value="m.name">{{ m.full_name }}</option>
              </select>
              <input v-model="g.amount" type="number" min="0" inputmode="decimal" class="input w-28 py-2.5 text-sm" placeholder="Amount" :aria-label="`Amount guarantor ${i + 1} covers`" />
            </div>
            <div class="flex items-center justify-between text-xs">
              <button type="button" class="font-semibold link" @click="addGuarantor"><Icon name="plus" :size="13" /> Another guarantor</button>
              <span :class="pledged + 0.005 >= cover ? 'text-pos' : 'text-ink-soft'">{{ money(pledged, currency) }} of {{ money(cover, currency) }} covered</span>
            </div>
          </div>

          <div>
            <label class="label" for="purpose">What’s it for? <span class="font-normal text-ink-faint">(helps the officers decide)</span></label>
            <input id="purpose" v-model="purpose" class="input" placeholder="e.g. School fees, shop stock" />
          </div>

          <!-- Eligibility -->
          <ul v-if="checks.length" class="space-y-1.5 rounded-3xl bg-sunk p-4 text-sm">
            <li v-for="c in checks" :key="c.key" class="flex items-start gap-2">
              <Icon :name="c.ok ? 'checkCircle' : 'alert'" :size="16" class="mt-0.5 shrink-0" :class="c.ok ? 'text-pos' : 'text-warn'" />
              <span :class="c.ok ? 'text-ink-soft' : 'font-semibold'">{{ c.label }}</span>
            </li>
          </ul>
          <RouterLink v-if="needsPayout" to="/profile/payout" class="flex items-center gap-3 rounded-3xl bg-brand-soft p-4 text-sm text-brand-text">
            <Icon name="bank" /><span class="flex-1"><b>Add the account to send your loan to.</b> You need it before you can ask.</span><Icon name="chevron" :size="18" />
          </RouterLink>
          <p v-if="hold" class="flex gap-2.5 rounded-3xl bg-warn-soft p-4 text-sm text-warn"><Icon name="shield" :size="18" class="mt-0.5" />
            Loans are paused after a password reset or phone change until {{ date(hold, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) }}.</p>

          <ErrorBox :message="error" />
          <button class="btn-primary btn-lg w-full" :disabled="busy || !canSubmit">{{ busy ? 'Sending…' : 'Send loan request' }}</button>
          <p class="-mt-3 text-center text-xs text-ink-faint">The officers approve it, then the treasurer sends the money. Repayments start when you confirm it arrived.</p>
        </template>
        <div v-else class="card p-6 text-center">
          <p class="font-semibold">Nothing to borrow just yet</p>
          <p class="mt-1 text-sm text-ink-soft">Your limit grows with every confirmed contribution{{ info.loan_outstanding > 0 ? ' and every repayment' : '' }}.</p>
          <RouterLink to="/save" class="btn-primary btn-sm mt-4">Save now</RouterLink>
        </div>
      </form>
    </div>
  </div>
</template>
