<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import * as api from '../api'
import { current, currency, dashboard, loadDashboard, toast } from '../store'
import { money, date, shortDate, periodWord, today } from '../format'
import { payWithPaystack, receiptPath } from '../payments'
import PageHeader from '../components/PageHeader.vue'
import AmountField from '../components/AmountField.vue'
import Loader from '../components/Loader.vue'
import ErrorBox from '../components/ErrorBox.vue'
import Sheet from '../components/Sheet.vue'
import Icon from '../components/Icon.vue'

const MANDATE_KEY = 'coopvault.mandateRef'
const route = useRoute()
const router = useRouter()
const info = ref(null)
const error = ref('')
const busy = ref(false)
const editing = ref(false)
const confirmOff = ref(false)
const amount = ref('')
const method = ref('new-card')
const startDate = ref('')

const d = computed(() => dashboard.value)
const s = computed(() => d.value?.standing)
const freq = computed(() => s.value?.frequency || 'Monthly')
const auto = computed(() => info.value?.autosave)
const showForm = computed(() => editing.value || !auto.value?.enabled)
const methods = computed(() => info.value?.methods || [])
const directDebit = computed(() => !!d.value?.payments?.direct_debit)

async function load() {
  const [a] = await Promise.all([api.get('payments.get_autosave', { cooperative: current.value.cooperative }), loadDashboard()])
  info.value = a
  amount.value = a.autosave.amount || s.value?.amount || ''
  method.value = a.autosave.method?.name || methods.value[0]?.name || 'new-card'
  startDate.value = ''
}

onMounted(async () => {
  try {
    if (route.query.mandate) await finishMandate()
    await load()
  } catch (e) { error.value = e.message }
})

async function finishMandate() {
  let ref_ = ''
  try { ref_ = sessionStorage.getItem(MANDATE_KEY) || '' } catch {}
  if (!ref_) return
  const m = await api.post('payments.check_mandate', { reference: ref_ })
  if (m.status === 'Active') {
    try { sessionStorage.removeItem(MANDATE_KEY) } catch {}
    toast('Bank account authorised for direct debit')
    method.value = m.name
  } else {
    toast('Your bank is still confirming the mandate. This can take a few minutes.', 'error')
  }
}

async function save() {
  error.value = ''
  const value = Number(amount.value)
  if (!(value >= 100)) return (error.value = `Choose at least ${money(100, currency.value)}`)
  busy.value = true
  try {
    if (method.value === 'new-card') {
      const tx = await payWithPaystack({ cooperative: current.value.cooperative, purpose: 'Contribution', amount: value, setup_autosave: 1 })
      if (tx?.status === 'Success') {
        toast('Autosave is on')
        return router.replace(receiptPath(tx))
      }
      if (tx) throw new Error(tx.message || 'The payment did not complete, so Autosave was not turned on.')
      return
    }
    if (method.value === 'direct-debit') {
      const res = await api.post('payments.start_mandate', { cooperative: current.value.cooperative })
      try { sessionStorage.setItem(MANDATE_KEY, res.reference) } catch {}
      window.location.href = res.redirect_url
      return
    }
    info.value.autosave = await api.post('payments.setup_autosave', {
      cooperative: current.value.cooperative, amount: value, authorization: method.value, start_date: startDate.value || undefined,
    })
    editing.value = false
    toast('Autosave is on')
    loadDashboard().catch(() => {})
  } catch (e) {
    error.value = e.message
  } finally {
    busy.value = false
  }
}

async function turnOff() {
  busy.value = true
  try {
    info.value.autosave = await api.post('payments.cancel_autosave', { cooperative: current.value.cooperative })
    confirmOff.value = false
    toast('Autosave turned off')
    loadDashboard().catch(() => {})
  } catch (e) { toast(e.message, 'error') } finally { busy.value = false }
}
</script>

<template>
  <div>
    <PageHeader title="Autosave" back="/home" />
    <div class="space-y-5 px-5 pb-12 pt-1">
      <ErrorBox v-if="!info" :message="error" />
      <Loader v-if="!info && !error" />
      <template v-if="info">
        <!-- On -->
        <section v-if="auto.enabled && !editing" class="overflow-hidden rounded-4xl bg-gradient-to-br from-forest-800 to-forest-700 p-6 text-white shadow-lift">
          <div class="flex items-center gap-2 text-sm text-forest-100/80"><Icon name="repeat" :size="18" class="text-coin-400" /> Autosave is on</div>
          <p class="money mt-3 text-[40px] leading-none">{{ money(auto.amount, currency) }}</p>
          <p class="mt-1 text-forest-100/80">every {{ periodWord(freq) }}</p>
          <div class="mt-5 grid grid-cols-2 gap-2 text-sm">
            <div class="rounded-2xl bg-white/[0.08] p-3"><p class="text-xs text-forest-100/70">Next payment</p><p class="font-semibold">{{ date(auto.next_date) }}</p></div>
            <div class="rounded-2xl bg-white/[0.08] p-3"><p class="text-xs text-forest-100/70">Paid with</p><p class="truncate font-semibold">{{ auto.method?.label }}</p></div>
          </div>
          <div class="mt-5 grid grid-cols-2 gap-2">
            <button class="btn btn-sm bg-white/10 text-white hover:bg-white/15" @click="editing = true">Change</button>
            <button class="btn btn-sm bg-white/10 text-white hover:bg-white/15" @click="confirmOff = true">Turn off</button>
          </div>
        </section>

        <section v-if="auto.enabled && !editing" class="card p-5 text-sm">
          <h2 class="font-semibold">How it works</h2>
          <ul class="mt-3 space-y-2.5 text-ink-soft">
            <li class="flex gap-2.5"><Icon name="calendar" :size="18" class="text-brand-text" /> We charge {{ auto.method?.label }} at 9am on the day your contribution is due.</li>
            <li class="flex gap-2.5"><Icon name="receipt" :size="18" class="text-brand-text" /> It’s confirmed instantly and you get a receipt in Activity.</li>
            <li class="flex gap-2.5"><Icon name="alert" :size="18" class="text-brand-text" /> If a charge fails we try again the next day, and stop after three tries.</li>
          </ul>
        </section>

        <!-- Off: pitch -->
        <section v-if="!auto.enabled" class="card p-5">
          <div class="flex items-start gap-3.5">
            <span class="grid h-12 w-12 place-items-center rounded-2xl bg-brand-soft text-brand-text"><Icon name="repeat" :size="24" /></span>
            <div>
              <h2 class="font-display text-xl font-semibold">Save without thinking about it</h2>
              <p class="mt-1 text-sm text-ink-soft">Your contribution is paid automatically each {{ periodWord(freq) }}, so you’re never behind. You get a receipt every time, and you can stop whenever you like.</p>
            </div>
          </div>
          <p v-if="auto.last_error" class="mt-4 rounded-2xl bg-neg-soft p-3 text-sm text-neg">Last attempt: {{ auto.last_error }}</p>
        </section>

        <!-- Setup / edit -->
        <form v-if="showForm" class="space-y-6" @submit.prevent="save">
          <AmountField v-model="amount" :currency="currency" :label="`Amount each ${periodWord(freq)}`"
            :chips="s?.amount ? [1, 2].map((n) => ({ label: money(s.amount * n, currency), value: s.amount * n })) : []" />

          <fieldset class="space-y-2.5">
            <legend class="label">Pay with</legend>
            <label v-for="m in methods" :key="m.name" class="flex cursor-pointer items-center gap-3.5 rounded-3xl border p-4"
              :class="method === m.name ? 'border-brand-text/50 bg-brand-soft/60' : 'border-line/12 bg-card'">
              <input v-model="method" type="radio" :value="m.name" class="sr-only" />
              <span class="grid h-10 w-10 place-items-center rounded-2xl bg-card shadow-sm text-brand-text"><Icon :name="m.channel === 'card' ? 'card' : 'bank'" /></span>
              <span class="flex-1"><b class="block text-[15px]">{{ m.label }}</b><span v-if="m.exp_month" class="text-xs text-ink-soft">Expires {{ String(m.exp_month).padStart(2, '0') }}/{{ String(m.exp_year).slice(-2) }}</span></span>
              <Icon v-if="method === m.name" name="checkCircle" class="text-brand-text" />
            </label>
            <label class="flex cursor-pointer items-center gap-3.5 rounded-3xl border p-4"
              :class="method === 'new-card' ? 'border-brand-text/50 bg-brand-soft/60' : 'border-line/12 bg-card'">
              <input v-model="method" type="radio" value="new-card" class="sr-only" />
              <span class="grid h-10 w-10 place-items-center rounded-2xl bg-card shadow-sm text-brand-text"><Icon name="plus" /></span>
              <span class="flex-1"><b class="block text-[15px]">A new debit card</b><span class="text-xs text-ink-soft">Pay this {{ periodWord(freq) }}’s contribution now to save the card</span></span>
              <Icon v-if="method === 'new-card'" name="checkCircle" class="text-brand-text" />
            </label>
            <label v-if="directDebit" class="flex cursor-pointer items-center gap-3.5 rounded-3xl border p-4"
              :class="method === 'direct-debit' ? 'border-brand-text/50 bg-brand-soft/60' : 'border-line/12 bg-card'">
              <input v-model="method" type="radio" value="direct-debit" class="sr-only" />
              <span class="grid h-10 w-10 place-items-center rounded-2xl bg-card shadow-sm text-brand-text"><Icon name="bank" /></span>
              <span class="flex-1"><b class="block text-[15px]">Straight from my bank account</b><span class="text-xs text-ink-soft">Authorise a direct debit with your bank (no card needed)</span></span>
              <Icon v-if="method === 'direct-debit'" name="checkCircle" class="text-brand-text" />
            </label>
          </fieldset>

          <div v-if="method !== 'new-card' && method !== 'direct-debit'">
            <label class="label" for="start">First payment</label>
            <input id="start" v-model="startDate" type="date" :min="today()" class="input" />
            <p class="hint">Leave empty to start when your next contribution is due{{ s?.state === 'up_to_date' ? ` (${shortDate(s.next_due_date)})` : ' (today)' }}.</p>
          </div>

          <ErrorBox :message="error" />
          <button class="btn-primary btn-lg w-full" :disabled="busy">
            <template v-if="busy">Please wait…</template>
            <template v-else-if="method === 'new-card'"><Icon name="lock" :size="18" /> Pay {{ amount ? money(amount, currency) : '' }} and turn on</template>
            <template v-else-if="method === 'direct-debit'">Continue to my bank</template>
            <template v-else>{{ auto.enabled ? 'Save changes' : 'Turn on Autosave' }}</template>
          </button>
          <button v-if="editing" type="button" class="btn-ghost w-full" @click="editing = false">Cancel</button>
        </form>
      </template>
    </div>

    <Sheet :open="confirmOff" title="Turn off Autosave?" subtitle="You’ll need to pay each contribution yourself. You can turn it back on any time." @close="confirmOff = false">
      <div class="grid grid-cols-2 gap-3">
        <button class="btn-secondary" @click="confirmOff = false">Keep it on</button>
        <button class="btn-danger" :disabled="busy" @click="turnOff">Turn off</button>
      </div>
    </Sheet>
  </div>
</template>
