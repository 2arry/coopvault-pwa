<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { currency, dashboard, loadDashboard } from '../store'
import { money, shortDate, periodName, paidThroughLabel, periodWord } from '../format'
import PageHeader from '../components/PageHeader.vue'
import PayPanel from '../components/PayPanel.vue'
import Loader from '../components/Loader.vue'
import ErrorBox from '../components/ErrorBox.vue'
import Icon from '../components/Icon.vue'

const route = useRoute()
const error = ref('')
const ready = ref(!!dashboard.value)
const s = computed(() => dashboard.value?.standing)
const cap = (x) => x.charAt(0).toUpperCase() + x.slice(1)

const chips = computed(() => {
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
const initial = computed(() => Number(route.query.amount) || (s.value?.due_now > 0 ? s.value.due_now : s.value?.amount) || '')

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
        <PayPanel :key="initial" purpose="Contribution" :initial="initial" :chips="chips" />
      </template>
    </div>
  </div>
</template>
