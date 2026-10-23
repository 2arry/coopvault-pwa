<script setup>
// The group's Cooperative360 plan: what it allows, how much is used, and paying for months ahead.
import { ref, computed, onMounted } from 'vue'
import * as api from '../../api'
import { state, current, toast, loadDashboard } from '../../store'
import { money, date } from '../../format'
import { payWithPaystack, SUBSCRIPTION } from '../../payments'
import PageHeader from '../../components/PageHeader.vue'
import Loader from '../../components/Loader.vue'
import ErrorBox from '../../components/ErrorBox.vue'
import Sheet from '../../components/Sheet.vue'
import Icon from '../../components/Icon.vue'

const data = ref(null)
const error = ref('')
const choosing = ref(null)
const months = ref(3)
const busy = ref(false)

async function load() {
  try { data.value = await api.get('subscription.get_subscription', { cooperative: current.value.cooperative }) } catch (e) { error.value = e.message }
}
onMounted(load)

const sub = computed(() => data.value?.subscription)
const plan = computed(() => sub.value?.plan)
const headline = computed(() => {
  const s = sub.value
  if (!s) return ''
  if (s.state === 'free') return 'Free plan'
  if (s.state === 'trial') return `Free trial · ${s.days_left} day${s.days_left === 1 ? '' : 's'} left`
  if (s.state === 'active') return `Paid until ${date(s.ends_on)}`
  if (s.state === 'grace') return `Ended ${date(s.ends_on)} · ${s.days_left} day${s.days_left === 1 ? '' : 's'} of grace left`
  if (s.state === 'lapsed') return `Ended ${date(s.ends_on)}`
  return 'Starts when Cooperative360 approves the group'
})
const limits = computed(() => {
  const p = plan.value
  const u = data.value?.usage
  if (!p || !u) return []
  return [
    { label: 'Members', used: u.members, max: p.max_members },
    { label: 'Loan products', used: u.loan_products, max: p.max_loan_products },
    { label: 'Savings products', used: u.savings_products, max: p.max_savings_products },
  ]
})
const features = (p) => [
  { label: 'Online payments', on: !!p.online_payments },
  { label: 'Account numbers', on: !!p.dedicated_accounts },
  { label: 'Autosave', on: !!p.autosave },
]
const limitText = (n, word) => (n ? `${n} ${n === 1 ? word.replace(/s$/, '') : word}` : `Unlimited ${word}`)
const total = computed(() => (choosing.value ? choosing.value.price_monthly * months.value : 0))

async function payNow() {
  busy.value = true
  try {
    const res = await payWithPaystack({ cooperative: current.value.cooperative, plan: choosing.value.name, months: months.value },
      { endpoints: SUBSCRIPTION })
    if (!res) return
    if (res.status === 'Success') {
      toast(`Thank you. ${res.plan} is paid until ${date(res.period_to)}.`)
      choosing.value = null
      await load()
      loadDashboard().catch(() => {})
    } else toast(res.message || 'The payment didn’t go through. You haven’t been charged.', 'error')
  } catch (e) { toast(e.message, 'error') } finally { busy.value = false }
}
async function chooseFree() {
  busy.value = true
  try {
    data.value = await api.post('subscription.choose_free_plan', { cooperative: current.value.cooperative, plan: choosing.value.name })
    toast(`You’re on ${choosing.value.plan_name} now`)
    choosing.value = null
    loadDashboard().catch(() => {})
  } catch (e) { toast(e.message, 'error') } finally { busy.value = false }
}
</script>

<template>
  <div>
    <PageHeader title="Plan and billing" :subtitle="current?.cooperative_name" back="/admin?tab=settings" />
    <div class="space-y-5 px-5 pb-12 pt-1">
      <ErrorBox :message="error" />
      <Loader v-if="!data && !error" />
      <template v-if="data">
        <section class="relative overflow-hidden rounded-4xl bg-navy-800 p-5 text-white shadow-lift">
          <p class="text-sm text-navy-100/80">Cooperative360 plan</p>
          <p class="mt-1 font-display text-[30px] font-semibold leading-tight">{{ plan?.plan_name }}</p>
          <p class="mt-1 text-sm" :class="['grace', 'lapsed'].includes(sub.state) ? 'text-[#fecaca]' : 'text-glow-300'">{{ headline }}</p>
          <p v-if="sub.state === 'lapsed'" class="mt-3 rounded-2xl bg-white/10 p-3 text-xs text-navy-100/85">New loans and new members are paused until you renew. Payments, repayments and withdrawals carry on as normal.</p>
          <div class="mt-4 space-y-3">
            <div v-for="l in limits" :key="l.label">
              <div class="flex justify-between text-xs text-navy-100/80"><span>{{ l.label }}</span><span class="num">{{ l.used }}{{ l.max ? ` of ${l.max}` : ' · no limit' }}</span></div>
              <div v-if="l.max" class="mt-1 h-1.5 overflow-hidden rounded-full bg-white/10"><div class="h-full rounded-full bg-glow-300" :style="{ width: `${Math.min(100, (l.used / l.max) * 100)}%` }" /></div>
            </div>
          </div>
        </section>

        <section>
          <h2 class="section-title">Plans</h2>
          <div class="mt-3 space-y-3">
            <div v-for="p in data.plans" :key="p.name" class="card p-4" :class="p.current ? 'ring-2 ring-brand-text/40' : ''">
              <div class="flex items-start justify-between gap-3">
                <div>
                  <p class="flex items-center gap-2 text-[17px] font-semibold">{{ p.plan_name }}<span v-if="p.current" class="chip bg-brand-soft text-brand-text">Current</span></p>
                  <p class="text-sm text-ink-soft">{{ p.description }}</p>
                </div>
                <p class="shrink-0 text-right"><span class="money text-xl">{{ p.price_monthly ? money(p.price_monthly, 'NGN') : 'Free' }}</span><span v-if="p.price_monthly" class="block text-xs text-ink-soft">a month</span></p>
              </div>
              <p class="mt-3 text-xs text-ink-soft">{{ limitText(p.max_members, 'members') }} · {{ limitText(p.max_loan_products, 'loan products') }} · {{ limitText(p.max_savings_products, 'savings products') }}</p>
              <div class="mt-2 flex flex-wrap gap-1.5">
                <span v-for="f in features(p)" :key="f.label" class="chip" :class="f.on ? 'bg-pos-soft text-pos' : 'bg-sunk text-ink-faint line-through'"><Icon :name="f.on ? 'check' : 'x'" :size="12" /> {{ f.label }}</span>
              </div>
              <p v-for="x in p.problems" :key="x" class="mt-2 flex gap-1.5 text-xs text-warn"><Icon name="alert" :size="14" class="mt-px shrink-0" /> {{ x }}</p>
              <button v-if="data.can_pay && !p.problems.length && (p.price_monthly || !p.current)" class="mt-3 w-full btn-sm" :class="p.current ? 'btn-primary' : 'btn-secondary'"
                @click="choosing = p; months = 3">{{ p.price_monthly ? (p.current ? 'Pay for more months' : `Move to ${p.plan_name}`) : `Switch to ${p.plan_name}` }}</button>
            </div>
          </div>
          <p v-if="!data.can_pay" class="hint">Only the group’s admins can change the plan or pay for it.</p>
        </section>

        <section v-if="data.payments.length">
          <h2 class="section-title">Payments</h2>
          <div class="card mt-3 divide-soft">
            <div v-for="p in data.payments" :key="p.reference" class="flex items-center justify-between gap-3 p-4 text-sm">
              <div><p class="font-semibold">{{ p.plan }} · {{ p.months }} month{{ p.months === 1 ? '' : 's' }}</p><p class="text-xs text-ink-soft">{{ date(p.period_from) }} to {{ date(p.period_to) }} · paid {{ date(p.paid_at) }}</p></div>
              <span class="num font-semibold">{{ money(p.amount, 'NGN') }}</span>
            </div>
          </div>
        </section>
        <p class="flex gap-2 rounded-2xl bg-sunk p-3 text-xs text-ink-soft"><Icon name="info" :size="14" class="mt-0.5 shrink-0" /> Paid to Cooperative360 by card or transfer, not from the pool. If the group covers it, the treasurer can record it in Books as a running cost.</p>
      </template>
    </div>

    <Sheet :open="!!choosing" :title="choosing?.price_monthly ? `${choosing.plan_name}: pay ahead` : `Switch to ${choosing?.plan_name}?`"
      :subtitle="choosing?.price_monthly ? 'Paid months start when your current trial or paid time ends, so nothing is lost.' : 'It’s free. Features not in this plan switch off.'" @close="choosing = null">
      <template v-if="choosing?.price_monthly">
        <div class="grid grid-cols-4 gap-2">
          <button v-for="m in data.months" :key="m" type="button" class="rounded-2xl border py-3 text-center text-sm font-semibold"
            :class="months === m ? 'border-brand-text/50 bg-brand-soft text-brand-text' : 'border-line/12'" :aria-pressed="months === m" @click="months = m">{{ m }}<span class="block text-xs font-normal">month{{ m === 1 ? '' : 's' }}</span></button>
        </div>
        <div class="mt-4 flex items-center justify-between rounded-2xl bg-sunk p-4"><span class="text-sm text-ink-soft">Total</span><span class="money text-2xl">{{ money(total, 'NGN') }}</span></div>
        <button class="btn-primary btn-lg mt-4 w-full" :disabled="busy" @click="payNow"><Icon name="lock" :size="18" /> {{ busy ? 'Opening checkout…' : `Pay ${money(total, 'NGN')}` }}</button>
        <p v-if="state.paystack.test_mode" class="mt-3 text-center text-xs text-info">Demo mode: choose Success in the Paystack window. No real money moves.</p>
      </template>
      <div v-else class="grid grid-cols-2 gap-3">
        <button class="btn-secondary" @click="choosing = null">Cancel</button>
        <button class="btn-primary" :disabled="busy" @click="chooseFree">Switch</button>
      </div>
    </Sheet>
  </div>
</template>
