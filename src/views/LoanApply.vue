<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import * as api from '../api'
import { current, currency, toast, loadDashboard } from '../store'
import { money } from '../format'
import PageHeader from '../components/PageHeader.vue'
import AmountField from '../components/AmountField.vue'
import ErrorBox from '../components/ErrorBox.vue'
import Loader from '../components/Loader.vue'
import Icon from '../components/Icon.vue'

const router = useRouter()
const info = ref(null)
const amount = ref('')
const tenure = ref(1)
const purpose = ref('')
const busy = ref(false)
const error = ref('')

onMounted(async () => {
  try {
    info.value = await api.get('finance.loan_eligibility', { cooperative: current.value.cooperative })
    tenure.value = Math.min(3, info.value.max_loan_tenure_months || 1)
  } catch (e) { error.value = e.message }
})

const value = computed(() => Number(amount.value) || 0)
const limit = computed(() => info.value?.borrow_limit || 0)
const maxNow = computed(() => Math.max(0, Math.min(limit.value, info.value?.pool_balance || 0)))
const interest = computed(() => (value.value * (info.value?.interest_rate || 0)) / 100)
const total = computed(() => value.value + interest.value)
const monthly = computed(() => total.value / (tenure.value || 1))
const overLimit = computed(() => info.value && value.value > limit.value + 0.005)
const overPool = computed(() => info.value && !overLimit.value && value.value > info.value.pool_balance + 0.005)
const chips = computed(() => {
  const m = maxNow.value
  if (m <= 0) return []
  const round = (x) => Math.max(1000, Math.floor(x / 1000) * 1000)
  const set = [...new Set([round(m * 0.25), round(m * 0.5), Math.floor(m)])].filter((x) => x <= m)
  return set.map((x) => ({ label: x === Math.floor(m) ? `Max · ${money(x, currency.value)}` : money(x, currency.value), value: x }))
})
const needsPayout = computed(() => !info.value?.has_payout_account)
const hold = computed(() => {
  const h = info.value?.security_hold_until
  return h && new Date(String(h).replace(' ', 'T')) > new Date() ? h : null
})

async function submit() {
  busy.value = true
  error.value = ''
  try {
    const loan = await api.post('finance.apply_loan', {
      cooperative: current.value.cooperative, amount: value.value, tenure_months: tenure.value, purpose: purpose.value,
    })
    toast('Loan request sent to the treasurer')
    loadDashboard().catch(() => {})
    router.replace(`/loans/${loan.name}`)
  } catch (e) {
    error.value = e.message
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div>
    <PageHeader title="Borrow" back="/loans" />
    <div class="px-5 pb-12 pt-1">
      <Loader v-if="!info && !error" />
      <ErrorBox v-if="!info" :message="error" />
      <form v-else class="space-y-6" @submit.prevent="submit">
        <div class="card p-5">
          <p class="text-sm text-ink-soft">You can borrow up to</p>
          <p class="money text-[36px] leading-tight text-brand-text">{{ money(limit, currency) }}</p>
          <div class="mt-3 space-y-1.5 border-t border-line/[0.07] pt-3 text-sm">
            <div class="flex justify-between"><span class="text-ink-soft">Your savings{{ info.multiplier !== 1 ? ` × ${info.multiplier}` : '' }}</span><span class="num">{{ money(info.savings * info.multiplier, currency) }}</span></div>
            <div v-if="info.exposure > 0" class="flex justify-between"><span class="text-ink-soft">Owed or already requested</span><span class="num">− {{ money(info.exposure, currency) }}</span></div>
          </div>
          <p v-if="info.pool_balance < limit" class="mt-3 flex gap-2 rounded-2xl bg-accent-soft p-3 text-xs text-accent-text">
            <Icon name="info" :size="16" class="shrink-0" /> The pool has {{ money(info.pool_balance, currency) }} right now, so bigger loans wait until more is saved.
          </p>
        </div>

        <template v-if="limit > 0">
          <AmountField v-model="amount" :currency="currency" :chips="chips" :invalid="overLimit" label="How much do you need?" />
          <p v-if="overLimit" class="-mt-4 text-sm text-neg">That’s more than your limit. You can’t borrow more than you’ve saved.</p>
          <p v-else-if="overPool" class="-mt-4 text-sm text-warn">The pool doesn’t have this much yet. You can still ask; the treasurer can approve it once there’s enough.</p>

          <div>
            <span class="label">Pay back over</span>
            <div class="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1">
              <button v-for="m in info.max_loan_tenure_months" :key="m" type="button"
                class="shrink-0 rounded-2xl border px-4 py-2.5 text-sm font-semibold transition"
                :class="tenure === m ? 'border-brand-text/40 bg-brand-soft text-brand-text' : 'border-line/12 bg-card text-ink-soft'"
                @click="tenure = m">{{ m }} month{{ m > 1 ? 's' : '' }}</button>
            </div>
          </div>

          <div>
            <label class="label" for="purpose">What’s it for? <span class="font-normal text-ink-faint">(optional, helps the treasurer)</span></label>
            <input id="purpose" v-model="purpose" class="input" placeholder="e.g. School fees, shop stock" />
          </div>

          <div v-if="value > 0" class="card-flat divide-soft px-4 text-sm">
            <div class="flex justify-between py-3"><span class="text-ink-soft">You receive</span><span class="num font-semibold">{{ money(value, currency) }}</span></div>
            <div class="py-3">
              <div class="flex justify-between"><span class="text-ink-soft">Interest ({{ info.interest_rate }}% flat)</span><span class="num">{{ money(interest, currency) }}</span></div>
              <p v-if="info.interest_rate > 0" class="mt-1 text-xs text-ink-faint">Flat means it’s the same {{ info.interest_rate }}% whether you repay in 1 month or {{ info.max_loan_tenure_months }}.</p>
            </div>
            <div class="flex justify-between py-3"><span class="text-ink-soft">Total to pay back</span><span class="num font-semibold">{{ money(total, currency) }}</span></div>
            <div class="flex items-baseline justify-between py-3"><span class="font-semibold">Each month</span><span class="money text-xl">{{ money(monthly, currency) }} <span class="font-sans text-xs text-ink-soft">× {{ tenure }}</span></span></div>
          </div>

          <RouterLink v-if="needsPayout" to="/profile/payout" class="flex items-center gap-3 rounded-3xl bg-brand-soft p-4 text-sm text-brand-text">
            <Icon name="bank" /><span class="flex-1"><b>Add the account to send your loan to.</b> You need it before you can ask.</span><Icon name="chevron" :size="18" />
          </RouterLink>
          <p v-if="hold" class="flex gap-2.5 rounded-3xl bg-warn-soft p-4 text-sm text-warn"><Icon name="shield" :size="18" class="mt-0.5" />
            Loans are paused after a password reset until {{ new Date(String(hold).replace(' ', 'T')).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) }}.</p>

          <ErrorBox :message="error" />
          <button class="btn-primary btn-lg w-full" :disabled="busy || !value || overLimit || needsPayout || !!hold">{{ busy ? 'Sending…' : 'Send loan request' }}</button>
          <p class="-mt-3 text-center text-xs text-ink-faint">The treasurer sends the money to your account. Repayments start when you confirm it arrived.</p>
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
