<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { currency, dashboard, loadDashboard } from '../store'
import { money, shortDate, periodName, paidThroughLabel, periodWord } from '../format'
import PageHeader from '../components/PageHeader.vue'
import PayPanel from '../components/PayPanel.vue'
import Loader from '../components/Loader.vue'
import ErrorBox from '../components/ErrorBox.vue'
import Icon from '../components/Icon.vue'

const route = useRoute()
const router = useRouter()
const error = ref('')
const ready = ref(!!dashboard.value)
const s = computed(() => dashboard.value?.standing)
const cap = (x) => x.charAt(0).toUpperCase() + x.slice(1)

// Regular contributions plus any voluntary savings the group offers
const products = computed(() => dashboard.value?.savings_products || [])
const regular = computed(() => products.value.find((p) => p.kind === 'Regular contributions'))
const chosen = ref(route.query.product || '')
const product = computed(() => products.value.find((p) => p.name === chosen.value) || regular.value)
const isRegular = computed(() => !product.value || product.value.kind === 'Regular contributions')
const held = computed(() => (dashboard.value?.balances?.products || []).find((p) => p.product === product.value?.name)?.balance || 0)
watch(chosen, (p) => router.replace({ query: { ...route.query, product: p || undefined, amount: undefined } }))

const chips = computed(() => {
  if (!isRegular.value) return [5000, 10000, 20000].map((v) => ({ label: money(v, currency.value), value: v }))
  const st = s.value
  if (!st?.tracked) return []
  const out = []
  if (st.due_now > 0) out.push({ label: `${money(st.due_now, currency.value)} due`, value: st.due_now })
  for (const n of [1, 2, 3]) {
    const v = st.amount * n
    if (!out.some((c) => c.value === v)) out.push({ label: `${n} ${periodWord(st.frequency, n)} · ${money(v, currency.value)}`, value: v })
  }
  return out
})
const initial = computed(() => Number(route.query.amount) || (isRegular.value ? (s.value?.due_now > 0 ? s.value.due_now : s.value?.amount) : '') || '')
// Dues and a loan instalment both due: one payment can cover them
const severalDue = computed(() => (dashboard.value?.due || []).length > 1)

onMounted(async () => {
  try { await loadDashboard() } catch (e) { if (!dashboard.value) error.value = e.message }
  ready.value = true
})
</script>

<template>
  <div>
    <PageHeader title="Save" :subtitle="dashboard?.cooperative?.cooperative_name" back="/home" />
    <div class="px-5 pb-12 pt-1">
      <ErrorBox :message="error" />
      <Loader v-if="!ready" />
      <template v-else-if="dashboard">
        <fieldset v-if="products.length > 1" class="mb-5">
          <legend class="label">Save into</legend>
          <div class="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5">
            <button v-for="p in products" :key="p.name" type="button" class="shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition"
              :class="product?.name === p.name ? 'bg-navy-800 text-white' : 'border border-line/12 bg-card text-ink-soft'"
              :aria-pressed="product?.name === p.name" @click="chosen = p.name">{{ p.product_name }}</button>
          </div>
        </fieldset>

        <template v-if="isRegular">
          <RouterLink v-if="severalDue" to="/pay" class="mb-4 flex items-center gap-3 rounded-3xl bg-brand-soft p-4 text-brand-text">
            <Icon name="layers" :size="20" />
            <span class="flex-1 text-sm"><b>Dues and a loan instalment are due.</b> Pay them together in one go.</span>
            <Icon name="chevron" :size="18" />
          </RouterLink>
          <div v-if="s?.tracked" class="mb-6 flex items-center gap-3 rounded-3xl p-4"
            :class="s.state === 'behind' ? 'bg-neg-soft text-neg' : s.state === 'due' ? 'bg-accent-soft text-accent-text' : 'bg-pos-soft text-pos'">
            <Icon :name="s.state === 'behind' ? 'alert' : s.state === 'due' ? 'clock' : 'checkCircle'" />
            <p class="text-sm">
              <template v-if="s.state === 'up_to_date'"><b>{{ paidThroughLabel(s.paid_through, s.frequency) }}.</b> Anything extra counts towards {{ periodName(s.next_due_date, s.frequency) }}.</template>
              <template v-else-if="s.state === 'due'"><b>{{ cap(periodName(s.current_period_start, s.frequency)) }}’s {{ money(s.due_now, currency) }}</b> is due by {{ shortDate(s.current_period_end) }}.</template>
              <template v-else-if="s.state === 'behind'"><b>{{ money(s.due_now, currency) }}</b> brings you up to date ({{ s.periods_behind }} {{ periodWord(s.frequency, s.periods_behind) }} behind, plus this one).</template>
              <template v-else>Contributions start {{ shortDate(s.next_due_date) }}.</template>
            </p>
          </div>
        </template>
        <div v-else class="mb-6 rounded-3xl bg-sunk p-4 text-sm">
          <p><b>{{ product.product_name }}</b><span v-if="held"> · you have <b class="money">{{ money(held, currency) }}</b> in it</span></p>
          <p v-if="product.description" class="mt-0.5 text-ink-soft">{{ product.description }}</p>
          <p class="mt-2 flex gap-1.5 text-xs text-ink-soft"><Icon name="info" :size="14" class="mt-px shrink-0" />
            {{ product.withdrawal_rule === 'Only when leaving' ? 'Stays saved until you leave the group.' : 'You can take it out any time.' }}
            {{ product.counts_for_borrowing ? 'It counts towards what you can borrow.' : 'It doesn’t count towards what you can borrow.' }}
            It isn’t part of your regular contributions.</p>
        </div>
        <PayPanel :key="`${product?.name}-${initial}`" purpose="Contribution" :savings-product="product?.name" :product-name="product?.product_name"
          :initial="initial" :chips="chips" />
      </template>
    </div>
  </div>
</template>
