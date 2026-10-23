<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import * as api from '../api'
import { current, currency, toast, loadDashboard } from '../store'
import { money, date } from '../format'
import PageHeader from '../components/PageHeader.vue'
import AmountField from '../components/AmountField.vue'
import Loader from '../components/Loader.vue'
import ErrorBox from '../components/ErrorBox.vue'
import Icon from '../components/Icon.vue'

const router = useRouter()
const info = ref(null)
const amount = ref('')
const reason = ref('')
const busy = ref(false)
const error = ref('')

const value = computed(() => Number(amount.value) || 0)
// Savings by product: choose which one to take from, or take everything out to leave
const products = computed(() => (info.value?.products || []).filter((p) => p.balance > 0.005))
const productId = ref('')
const leaving = ref(false)
const product = computed(() => products.value.find((p) => p.product === productId.value) || products.value.find((p) => !p.locked && p.withdrawable > 0) || products.value[0])
const several = computed(() => products.value.length > 1)
const available = computed(() => (leaving.value ? info.value?.leaving_amount || 0 : several.value ? product.value?.withdrawable || 0 : info.value?.withdrawable || 0))
const lockedTotal = computed(() => products.value.filter((p) => p.locked).reduce((t, p) => t + p.balance, 0))
function chooseLeaving(on) {
  leaving.value = on
  amount.value = on ? info.value.leaving_amount : ''
}
const over = computed(() => value.value > available.value + 0.005)
const payout = computed(() => info.value?.payout_account)
const hold = computed(() => {
  const h = info.value?.payout_account?.security_hold_until
  return h && new Date(String(h).replace(' ', 'T')) > new Date() ? h : null
})
const chips = computed(() => {
  const a = Math.floor(available.value)
  if (a <= 0) return []
  const half = Math.floor(a / 2000) * 1000
  return [...(half >= 1000 ? [{ label: money(half, currency.value), value: half }] : []), { label: `All · ${money(a, currency.value)}`, value: a }]
})

onMounted(async () => {
  try { info.value = await api.get('finance.withdrawal_eligibility', { cooperative: current.value.cooperative }) } catch (e) { error.value = e.message }
})

async function submit() {
  error.value = ''
  if (!(value.value > 0)) return (error.value = 'Enter an amount')
  busy.value = true
  try {
    const w = await api.post('finance.request_withdrawal', { cooperative: current.value.cooperative, amount: value.value, reason: reason.value,
      savings_product: leaving.value ? null : product.value?.product, leaving: leaving.value ? 1 : 0 })
    toast('Request sent to the treasurer')
    loadDashboard().catch(() => {})
    router.replace(`/withdrawals/${w.name}`)
  } catch (e) { error.value = e.message } finally { busy.value = false }
}
</script>

<template>
  <div>
    <PageHeader title="Take out savings" back="/home" />
    <div class="px-5 pb-12 pt-1">
      <Loader v-if="!info && !error" />
      <ErrorBox v-if="!info" :message="error" />
      <template v-else>
        <div v-if="info.pending" class="card p-6 text-center">
          <p class="font-semibold">You already have a withdrawal in progress</p>
          <p class="mt-1 text-sm text-ink-soft">You can ask for another one when it’s done.</p>
          <RouterLink to="/activity" class="btn-secondary btn-sm mt-4">See activity</RouterLink>
        </div>
        <form v-else class="space-y-6" @submit.prevent="submit">
          <fieldset v-if="several && !leaving">
            <legend class="label">Take out from</legend>
            <div class="space-y-2">
              <label v-for="p in products" :key="p.product" class="flex cursor-pointer items-center gap-3 rounded-3xl border p-4 transition"
                :class="[product?.product === p.product ? 'border-brand-text/50 bg-brand-soft/50' : 'border-line/12 bg-card', p.locked ? 'opacity-70' : '']">
                <input v-model="productId" type="radio" :value="p.product" :disabled="p.locked" class="h-5 w-5 accent-[rgb(var(--brand))]" @change="amount = ''" />
                <span class="min-w-0 flex-1">
                  <span class="block font-semibold">{{ p.product_name }}</span>
                  <span class="block text-xs text-ink-soft">{{ p.locked ? 'Only when you leave the group' : `Up to ${money(p.withdrawable, currency)}` }}</span>
                </span>
                <span class="num text-sm">{{ money(p.balance, currency) }}</span>
              </label>
            </div>
          </fieldset>

          <div class="card p-5">
            <p class="text-sm text-ink-soft">{{ leaving ? 'To leave, you take out everything' : 'You can take out up to' }}</p>
            <p class="money text-[36px] leading-tight text-brand-text">{{ money(available, currency) }}</p>
            <div class="mt-3 space-y-1.5 border-t border-line/[0.07] pt-3 text-sm">
              <div class="flex justify-between"><span class="text-ink-soft">{{ several && !leaving ? `In ${product?.product_name}` : 'Your savings' }}</span><span class="num">{{ money(several && !leaving ? product?.balance : info.savings, currency) }}</span></div>
              <div v-if="info.exposure > 0 && !leaving" class="flex justify-between"><span class="text-ink-soft">Backing your loan</span><span class="num">− {{ money(info.exposure, currency) }}</span></div>
              <div v-if="info.pledged > 0 && !leaving" class="flex justify-between"><span class="text-ink-soft">Guaranteeing others</span><span class="num">− {{ money(info.pledged, currency) }}</span></div>
            </div>
            <p v-if="info.exposure > 0 && !leaving" class="mt-3 text-xs text-ink-soft">Savings that back a loan stay in the pool until the loan is repaid.</p>
            <p v-if="leaving" class="mt-3 text-xs text-ink-soft">Every product is paid out{{ lockedTotal ? `, including ${money(lockedTotal, currency)} that can only come out when you leave` : '' }}. When it arrives you can leave the group from Me.</p>
          </div>

          <p v-if="hold" class="flex gap-2.5 rounded-3xl bg-warn-soft p-4 text-sm text-warn"><Icon name="shield" :size="18" class="mt-0.5" />
            Withdrawals are paused after a password reset until {{ date(hold, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) }}.</p>

          <template v-if="available > 0 && !hold">
            <AmountField v-if="!leaving" v-model="amount" :currency="currency" :chips="chips" :invalid="over" label="How much do you want to take out?" />
            <p v-if="over" class="-mt-4 text-sm text-neg">That’s more than you can take out right now.</p>
            <div>
              <label class="label" for="reason">What’s it for? <span class="font-normal text-ink-faint">(optional)</span></label>
              <input id="reason" v-model="reason" class="input" placeholder="e.g. Rent, leaving the group" />
            </div>
            <div class="card-flat p-4">
              <p class="text-xs font-semibold text-ink-soft">The treasurer sends it to</p>
              <template v-if="payout?.payout_account_number">
                <p class="mt-1 font-semibold">{{ payout.payout_account_name }}</p>
                <p class="text-sm text-ink-soft">{{ payout.payout_bank_name }} · {{ payout.payout_account_number }}</p>
              </template>
              <RouterLink v-else to="/profile/payout" class="mt-1 flex items-center gap-2 text-sm link"><Icon name="plus" :size="16" /> Add your bank account first</RouterLink>
            </div>
            <ErrorBox :message="error" />
            <button class="btn-primary btn-lg w-full" :disabled="busy || !value || over || !payout?.payout_account_number">{{ busy ? 'Sending…' : leaving ? `Take out all ${money(available, currency)}` : 'Ask for my money' }}</button>
            <p class="-mt-3 text-center text-xs text-ink-faint">The treasurer transfers it and you confirm when it arrives.</p>
          </template>
          <div v-else-if="!hold" class="card p-6 text-center">
            <p class="font-semibold">Nothing to take out just yet</p>
            <p class="mt-1 text-sm text-ink-soft">{{ leaving ? 'Repay your loans (and be released from any guarantees) before taking everything out.' : product?.locked ? `${product.product_name} can only be taken out when you leave.` : info.savings > 0 ? 'Your savings are backing your loan. Repay it to free them up.' : 'Your savings will show here once you’ve contributed.' }}</p>
          </div>
          <div v-if="!hold && info.savings > 0" class="text-center text-sm">
            <button v-if="!leaving" type="button" class="link" @click="chooseLeaving(true)">Leaving the group?</button>
            <button v-else type="button" class="link" @click="chooseLeaving(false)">Not leaving: take out part of it</button>
            <p v-if="!leaving && lockedTotal" class="mt-1 text-xs text-ink-faint">{{ money(lockedTotal, currency) }} can only come out when you leave.</p>
          </div>
        </form>
      </template>
    </div>
  </div>
</template>
