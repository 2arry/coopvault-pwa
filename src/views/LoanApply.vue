<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import * as api from '../api'
import { current, currency, toast } from '../store'
import { money } from '../format'
import PageHeader from '../components/PageHeader.vue'
import ErrorBox from '../components/ErrorBox.vue'
import Loader from '../components/Loader.vue'

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
const interest = computed(() => value.value * (info.value?.interest_rate || 0) / 100)
const total = computed(() => value.value + interest.value)
const overLimit = computed(() => info.value && value.value > info.value.borrow_limit + 0.005)
const overPool = computed(() => info.value && !overLimit.value && value.value > info.value.pool_balance + 0.005)

async function submit() {
  busy.value = true
  error.value = ''
  try {
    const loan = await api.post('finance.apply_loan', {
      cooperative: current.value.cooperative, amount: value.value, tenure_months: tenure.value, purpose: purpose.value,
    })
    toast('Loan request sent for approval')
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
    <PageHeader title="Request a loan" back="/loans" />
    <div class="px-5 pb-10 pt-2">
      <Loader v-if="!info && !error" />
      <ErrorBox v-if="!info" :message="error" />
      <form v-else class="space-y-5" @submit.prevent="submit">
        <div class="card p-4">
          <p class="text-sm text-ink-soft">You can borrow up to</p>
          <p class="num text-3xl font-extrabold text-brand-800">{{ money(info.borrow_limit, currency) }}</p>
          <div class="mt-3 space-y-1 text-xs text-ink-soft">
            <p>Based on {{ money(info.total_contributed, currency) }} contributed<span v-if="info.multiplier !== 1"> × {{ info.multiplier }}</span><span v-if="info.exposure > 0">, less {{ money(info.exposure, currency) }} you already owe or requested</span>.</p>
            <p v-if="info.pool_balance < info.borrow_limit">The pool currently has {{ money(info.pool_balance, currency) }} available, so larger loans may wait until more is saved.</p>
          </div>
        </div>

        <div>
          <label class="label" for="amount">Amount ({{ currency }})</label>
          <input id="amount" v-model="amount" type="number" inputmode="decimal" min="1" step="0.01" class="input num text-2xl font-bold"
            :class="overLimit ? 'border-red-400 focus:border-red-500 focus:ring-red-100' : ''" required />
          <input v-if="info.borrow_limit > 0" :value="value" type="range" @input="amount = $event.target.value" min="0" :max="Math.floor(info.borrow_limit)" step="500" class="mt-3 w-full accent-brand-700" aria-label="Amount slider" />
          <p v-if="overLimit" class="hint text-red-700">That's more than you can borrow. You can't owe more than you've contributed.</p>
          <p v-else-if="overPool" class="hint text-amber-700">The pool doesn't have this much right now. An admin can approve it once funds are available.</p>
        </div>

        <div>
          <label class="label" for="tenure">Pay back within</label>
          <select id="tenure" v-model.number="tenure" class="input">
            <option v-for="m in info.max_loan_tenure_months" :key="m" :value="m">{{ m }} month{{ m > 1 ? 's' : '' }}</option>
          </select>
        </div>

        <div>
          <label class="label" for="purpose">What is it for? <span class="font-normal text-ink-faint">(optional)</span></label>
          <textarea id="purpose" v-model="purpose" rows="2" class="input" placeholder="e.g. School fees" />
        </div>

        <div v-if="value > 0" class="card divide-y divide-black/5 px-4 text-sm">
          <div class="flex justify-between py-3"><span class="text-ink-soft">You receive</span><span class="num font-semibold">{{ money(value, currency) }}</span></div>
          <div class="flex justify-between py-3"><span class="text-ink-soft">Interest ({{ info.interest_rate }}% flat)</span><span class="num font-semibold">{{ money(interest, currency) }}</span></div>
          <div class="flex justify-between py-3"><span class="font-semibold">Total to pay back</span><span class="num font-extrabold">{{ money(total, currency) }}</span></div>
        </div>

        <ErrorBox :message="error" />
        <button class="btn-primary w-full" :disabled="busy || !value || overLimit">{{ busy ? 'Sending…' : 'Send loan request' }}</button>
      </form>
    </div>
  </div>
</template>
