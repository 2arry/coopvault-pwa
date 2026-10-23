<script setup>
import { ref, computed, onMounted, onActivated } from 'vue'
import * as api from '../../api'
import { current, currency } from '../../store'
import { money, initials } from '../../format'
import Loader from '../../components/Loader.vue'
import ErrorBox from '../../components/ErrorBox.vue'
import StatusPill from '../../components/StatusPill.vue'
import Icon from '../../components/Icon.vue'

const members = ref(null)
const standings = ref({})
const error = ref('')
const q = ref('')
const filter = ref('all')

const owing = (m) => ['due', 'behind'].includes(standings.value[m.name]?.state)
const shown = computed(() => (members.value || []).filter((m) => {
  if (filter.value === 'owing' && !owing(m)) return false
  if (filter.value === 'loans' && !(m.loan_outstanding > 0)) return false
  return !q.value || `${m.full_name} ${m.user} ${m.phone || ''} ${m.member_number || ''}`.toLowerCase().includes(q.value.toLowerCase())
}))
const totals = computed(() => (members.value || []).reduce((t, m) => ({
  saved: t.saved + (m.total_contributed || 0), owed: t.owed + (m.loan_outstanding || 0),
}), { saved: 0, owed: 0 }))

function stateLine(m) {
  const s = standings.value[m.name]
  if (!s?.tracked) return null
  if (s.state === 'behind') return { text: `Owes ${money(s.due_now, currency.value)}`, cls: 'bg-neg-soft text-neg' }
  if (s.state === 'due') return { text: `Due ${money(s.due_now, currency.value)}`, cls: 'bg-warn-soft text-warn' }
  return { text: 'Paid up', cls: 'bg-pos-soft text-pos' }
}

async function load() {
  try {
    const coop = current.value.cooperative
    const [list, tracker] = await Promise.all([
      api.get('coop.list_members', { cooperative: coop }),
      api.get('coop.contribution_tracker', { cooperative: coop }),
    ])
    members.value = list
    standings.value = Object.fromEntries(tracker.members.map((m) => [m.name, m.standing]))
  } catch (e) { error.value = e.message }
}
onMounted(load)
onActivated(() => members.value && load())
</script>

<template>
  <div class="space-y-4">
    <ErrorBox :message="error" />
    <Loader v-if="!members && !error" />
    <template v-if="members">
      <div class="grid grid-cols-2 gap-3">
        <div class="card p-4"><p class="text-xs text-ink-soft">Saved by members</p><p class="money text-xl">{{ money(totals.saved, currency) }}</p></div>
        <div class="card p-4"><p class="text-xs text-ink-soft">Owed to the pool</p><p class="money text-xl">{{ money(totals.owed, currency) }}</p></div>
      </div>
      <div class="relative">
        <Icon name="search" :size="18" class="absolute left-4 top-1/2 -translate-y-1/2 text-ink-faint" />
        <input v-model="q" class="input pl-11" placeholder="Search by name, phone or member no." type="search" />
      </div>
      <div class="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5">
        <button v-for="f in [{ k: 'all', l: `Everyone (${members.length})` }, { k: 'owing', l: 'Still to pay' }, { k: 'loans', l: 'Has a loan' }]" :key="f.k"
          class="shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition"
          :class="filter === f.k ? 'bg-navy-800 text-white' : 'border border-line/12 bg-card text-ink-soft'" @click="filter = f.k">{{ f.l }}</button>
      </div>
      <div class="card divide-soft">
        <RouterLink v-for="m in shown" :key="m.name" :to="`/admin/members/${m.name}`" class="flex items-center gap-3 p-4">
          <span class="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand-soft text-sm font-bold text-brand-text">{{ initials(m.full_name) }}</span>
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-1.5">
              <p class="truncate text-[15px] font-semibold">{{ m.full_name }}</p>
              <span v-if="m.role !== 'Member'" class="rounded-md bg-sunk px-1.5 py-0.5 text-[10px] font-bold text-ink-soft">{{ m.role }}</span>
            </div>
            <p class="num truncate text-xs text-ink-soft">
              <span v-if="m.member_number" class="text-ink-faint">{{ m.member_number }} · </span>Savings {{ money(m.total_contributed, currency) }}<span v-if="m.loan_outstanding"> · owes {{ money(m.loan_outstanding, currency) }}</span>
            </p>
          </div>
          <StatusPill v-if="m.status !== 'Active'" :status="m.status" />
          <span v-else-if="stateLine(m)" class="chip whitespace-nowrap" :class="stateLine(m).cls">{{ stateLine(m).text }}</span>
        </RouterLink>
        <p v-if="!shown.length" class="p-6 text-center text-sm text-ink-soft">No members match.</p>
      </div>
    </template>
  </div>
</template>
