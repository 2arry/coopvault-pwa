<script setup>
// Loan products (Admins): the loans members can choose from and their terms.
import { ref, onMounted } from 'vue'
import * as api from '../api'
import { current, currency, toast } from '../store'
import { money } from '../format'
import Sheet from './Sheet.vue'
import Icon from './Icon.vue'

const products = ref([])
const editing = ref(null)
const busy = ref(false)
const blank = () => ({ product_name: '', description: '', enabled: 1, interest_method: 'Flat', interest_rate: 2, rate_period: 'Per month',
  processing_fee_percent: 0, penalty_percent: 0, grace_days: 3, min_amount: 0, max_amount: 0, savings_multiplier: 1,
  min_tenure_months: 1, max_tenure_months: 6, max_active_loans: 1, min_membership_months: 0, require_up_to_date: 1,
  guarantors_required: 0, guarantee_percent: 100 })

async function load() {
  try { products.value = await api.get('finance.admin_loan_products', { cooperative: current.value.cooperative }) } catch (e) { toast(e.message, 'error') }
}
onMounted(load)

async function save() {
  busy.value = true
  try {
    products.value = await api.post('finance.save_loan_product', { cooperative: current.value.cooperative, ...editing.value })
    editing.value = null
    toast('Loan product saved. New requests use these terms.')
  } catch (e) { toast(e.message, 'error') } finally { busy.value = false }
}
const terms = (p) => [p.rate_text, `${p.min_tenure_months}–${p.max_tenure_months} months`,
  p.processing_fee_percent ? `${p.processing_fee_percent}% fee` : null,
  p.penalty_percent ? `${p.penalty_percent}% a month late fee` : null,
  p.guarantors_required ? `${p.guarantors_required} guarantor${p.guarantors_required > 1 ? 's' : ''}` : null].filter(Boolean).join(' · ')
</script>

<template>
  <section class="space-y-3">
    <div class="flex items-center justify-between">
      <h2 class="section-title">Loan products</h2>
      <button type="button" class="text-xs font-semibold link" @click="editing = blank()"><Icon name="plus" :size="13" /> New product</button>
    </div>
    <div class="card divide-soft">
      <button v-for="p in products" :key="p.name" type="button" class="flex w-full items-start gap-3 p-4 text-left" @click="editing = { ...p }">
        <span class="min-w-0 flex-1">
          <span class="flex items-center gap-2 font-semibold">{{ p.product_name }}<span v-if="!p.enabled" class="rounded-md bg-sunk px-1.5 py-0.5 text-[10px] font-bold text-ink-soft">Off</span></span>
          <span class="block text-xs text-ink-soft">{{ terms(p) }}</span>
        </span>
        <Icon name="edit" :size="15" class="mt-1 text-ink-faint" />
      </button>
    </div>

    <Sheet :open="!!editing" :title="editing?.name ? editing.product_name : 'New loan product'" subtitle="Changes apply to new requests. Loans already taken keep the terms they were agreed on." @close="editing = null">
      <form v-if="editing" class="space-y-4" @submit.prevent="save">
        <div><label class="label" for="lp-name">Name</label><input id="lp-name" v-model="editing.product_name" class="input" required placeholder="e.g. Emergency loan" /></div>
        <div><label class="label" for="lp-desc">What it’s for <span class="font-normal text-ink-faint">(members see this)</span></label><input id="lp-desc" v-model="editing.description" class="input" /></div>

        <div>
          <span class="label">Interest</span>
          <div class="seg grid-cols-3 text-[13px]">
            <button v-for="m in ['Flat', 'Reducing balance', 'Interest free']" :key="m" type="button" :class="{ on: editing.interest_method === m }" @click="editing.interest_method = m; if (m === 'Reducing balance' && editing.rate_period === 'Whole loan') editing.rate_period = 'Per month'">{{ m === 'Reducing balance' ? 'Reducing' : m }}</button>
          </div>
          <p class="hint">{{ editing.interest_method === 'Flat' ? 'Interest on the full amount for the whole term.' : editing.interest_method === 'Reducing balance' ? 'Interest each month on what’s still owed, so it falls as they repay.' : 'Members pay back exactly what they borrowed.' }}</p>
        </div>
        <div v-if="editing.interest_method !== 'Interest free'" class="grid grid-cols-2 gap-3">
          <div><label class="label" for="lp-rate">Rate (%)</label><input id="lp-rate" v-model.number="editing.interest_rate" type="number" min="0" max="100" step="0.1" class="input" /></div>
          <div>
            <label class="label" for="lp-period">Per</label>
            <select id="lp-period" v-model="editing.rate_period" class="input">
              <option value="Per month">Month</option><option value="Per year">Year</option>
              <option v-if="editing.interest_method === 'Flat'" value="Whole loan">Whole loan</option>
            </select>
          </div>
        </div>

        <div class="grid grid-cols-2 gap-3">
          <div><label class="label" for="lp-min-m">Shortest (months)</label><input id="lp-min-m" v-model.number="editing.min_tenure_months" type="number" min="1" class="input" /></div>
          <div><label class="label" for="lp-max-m">Longest (months)</label><input id="lp-max-m" v-model.number="editing.max_tenure_months" type="number" min="1" class="input" /></div>
          <div><label class="label" for="lp-min-a">Smallest amount</label><input id="lp-min-a" v-model.number="editing.min_amount" type="number" min="0" class="input" /></div>
          <div><label class="label" for="lp-max-a">Largest (0 = none)</label><input id="lp-max-a" v-model.number="editing.max_amount" type="number" min="0" class="input" /></div>
        </div>
        <div>
          <label class="label" for="lp-mult">How much of their savings can they borrow?</label>
          <select id="lp-mult" v-model.number="editing.savings_multiplier" class="input">
            <option :value="1">All of it (100%)</option><option :value="0.75">Three quarters (75%)</option><option :value="0.5">Half (50%)</option><option :value="0.25">A quarter (25%)</option>
          </select>
        </div>

        <div class="grid grid-cols-2 gap-3">
          <div><label class="label" for="lp-fee">Processing fee (%)</label><input id="lp-fee" v-model.number="editing.processing_fee_percent" type="number" min="0" max="100" step="0.1" class="input" /></div>
          <div><label class="label" for="lp-pen">Late fee (% a month)</label><input id="lp-pen" v-model.number="editing.penalty_percent" type="number" min="0" max="100" step="0.1" class="input" /></div>
          <div><label class="label" for="lp-grace">Grace before a late fee (days)</label><input id="lp-grace" v-model.number="editing.grace_days" type="number" min="0" class="input" /></div>
          <div><label class="label" for="lp-active">Open loans at once</label><input id="lp-active" v-model.number="editing.max_active_loans" type="number" min="1" class="input" /></div>
        </div>
        <p class="hint !-mt-2">The processing fee is kept back from what’s sent. The late fee is on the overdue part of an instalment.</p>

        <div class="grid grid-cols-2 gap-3">
          <div><label class="label" for="lp-months">Months as a member first</label><input id="lp-months" v-model.number="editing.min_membership_months" type="number" min="0" class="input" /></div>
          <div><label class="label" for="lp-g">Guarantors needed</label><input id="lp-g" v-model.number="editing.guarantors_required" type="number" min="0" max="5" class="input" /></div>
        </div>
        <div v-if="editing.guarantors_required"><label class="label" for="lp-gp">Guarantors must cover (% of the loan)</label><input id="lp-gp" v-model.number="editing.guarantee_percent" type="number" min="0" max="100" class="input" /></div>
        <label class="flex items-center gap-3 text-sm"><input v-model="editing.require_up_to_date" type="checkbox" :true-value="1" :false-value="0" class="h-5 w-5" /> Contributions must be up to date</label>
        <label class="flex items-center gap-3 text-sm"><input v-model="editing.enabled" type="checkbox" :true-value="1" :false-value="0" class="h-5 w-5" /> Members can choose it</label>
        <button class="btn-primary w-full" :disabled="busy">Save loan product</button>
      </form>
    </Sheet>
  </section>
</template>
