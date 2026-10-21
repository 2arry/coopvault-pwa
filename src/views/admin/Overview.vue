<script setup>
import { ref, computed, onMounted, onActivated } from 'vue'
import * as api from '../../api'
import { current, currency, dashboard, loadDashboard, shareText } from '../../store'
import { money, shortDate, periodName, paidThroughLabel, periodWord, initials, whatsappLink } from '../../format'
import { memberReminder, groupUpdate } from '../../reminders'
import Loader from '../../components/Loader.vue'
import ErrorBox from '../../components/ErrorBox.vue'
import Icon from '../../components/Icon.vue'

const emit = defineEmits(['goto'])
const tracker = ref(null)
const error = ref('')
const showPaid = ref(false)
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1)

const p = computed(() => tracker.value?.period)
const owing = computed(() => (tracker.value?.members || []).filter((m) => ['due', 'behind'].includes(m.standing.state)))
const upToDate = computed(() => (tracker.value?.members || []).filter((m) => !['due', 'behind'].includes(m.standing.state)))
const pending = computed(() => dashboard.value?.pending || {})
const pendingTotal = computed(() => Object.values(pending.value).reduce((a, b) => a + b, 0))
const coopName = computed(() => current.value?.cooperative_name)

async function load() {
  error.value = ''
  try {
    const [t] = await Promise.all([api.get('coop.contribution_tracker', { cooperative: current.value.cooperative }), loadDashboard()])
    tracker.value = t
  } catch (e) { error.value = e.message }
}
onMounted(load)
onActivated(() => tracker.value && load())

const remindLink = (m) => whatsappLink(m.phone, memberReminder(m, coopName.value, currency.value))
const shareGroup = () => shareText(groupUpdate(tracker.value, coopName.value, currency.value), 'Contribution update')
</script>

<template>
  <div class="space-y-4">
    <ErrorBox :message="error" />
    <Loader v-if="!tracker && !error" />
    <template v-if="tracker">
      <!-- Reviews waiting -->
      <button v-if="pendingTotal" class="flex w-full items-center gap-3.5 rounded-3xl bg-accent-soft p-4 text-left text-accent-text" @click="emit('goto', 'reviews')">
        <span class="grid h-10 w-10 place-items-center rounded-2xl bg-card"><Icon name="receipt" :size="18" /></span>
        <span class="flex-1 text-sm">
          <b class="block">{{ pendingTotal }} waiting for you</b>
          <span>{{ [pending.disputes && `${pending.disputes} transfer${pending.disputes > 1 ? 's' : ''} not received`, pending.members && `${pending.members} join request${pending.members > 1 ? 's' : ''}`, pending.loans && `${pending.loans} loan${pending.loans > 1 ? 's' : ''}`, pending.withdrawals && `${pending.withdrawals} withdrawal${pending.withdrawals > 1 ? 's' : ''}`].filter(Boolean).join(' · ') }}</span>
        </span>
        <Icon name="chevron" :size="18" />
      </button>

      <!-- Period progress -->
      <section v-if="p" class="card p-5">
        <div class="flex items-baseline justify-between">
          <h2 class="font-display text-2xl font-semibold">{{ cap(periodName(p.start, p.frequency)) }}</h2>
          <span class="text-xs text-ink-soft">ends {{ shortDate(p.end) }}</span>
        </div>
        <p class="mt-3 text-sm text-ink-soft"><b class="money text-2xl text-ink">{{ p.members - owing.length }} of {{ p.members }}</b> members paid up</p>
        <div class="mt-3 h-2.5 overflow-hidden rounded-full bg-line/[0.07]">
          <div class="h-full rounded-full bg-brand transition-all" :style="{ width: `${p.members ? ((p.members - owing.length) / p.members) * 100 : 0}%` }" />
        </div>
        <p class="mt-2 text-xs text-ink-soft">{{ money(p.collected, currency) }} received so far this {{ periodWord(p.frequency) }}, including catch-up payments</p>
        <div class="mt-4 grid grid-cols-3 gap-2 text-center">
          <div class="rounded-2xl bg-pos-soft py-2.5 text-pos"><p class="money text-xl">{{ p.up_to_date + p.not_started }}</p><p class="text-[11px] font-semibold">paid up</p></div>
          <div class="rounded-2xl bg-warn-soft py-2.5 text-warn"><p class="money text-xl">{{ p.due }}</p><p class="text-[11px] font-semibold">due now</p></div>
          <div class="rounded-2xl bg-neg-soft py-2.5 text-neg"><p class="money text-xl">{{ p.behind }}</p><p class="text-[11px] font-semibold">behind</p></div>
        </div>
        <button class="btn-secondary mt-4 w-full" @click="shareGroup"><Icon name="share" :size="18" /> Share update with the group</button>
      </section>
      <section v-else class="card p-5 text-sm text-ink-soft">
        <p class="font-semibold text-ink">Contribution tracking is off</p>
        <p class="mt-1">Contributions are set to flexible, so there’s no “due” amount to track. Set a regular amount in Settings to see who has paid each period.</p>
        <button class="btn-secondary btn-sm mt-3" @click="emit('goto', 'settings')">Open settings</button>
      </section>

      <!-- Who still owes -->
      <section v-if="p && owing.length">
        <h2 class="px-1 text-sm font-semibold">Still to pay</h2>
        <div class="card mt-3 divide-soft">
          <div v-for="m in owing" :key="m.name" class="flex items-center gap-3 p-4">
            <RouterLink :to="`/admin/members/${m.name}`" class="flex min-w-0 flex-1 items-center gap-3">
              <span class="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-sunk text-sm font-bold">{{ initials(m.full_name) }}</span>
              <span class="min-w-0">
                <span class="block truncate text-[15px] font-semibold">{{ m.full_name }}</span>
                <span class="block text-xs" :class="m.standing.state === 'behind' ? 'text-neg' : 'text-warn'">
                  {{ money(m.standing.due_now, currency) }} · {{ m.standing.state === 'behind' ? `${m.standing.periods_behind} ${periodWord(m.standing.frequency, m.standing.periods_behind)} behind` : 'due this ' + periodWord(m.standing.frequency) }}
                </span>
              </span>
            </RouterLink>
            <a v-if="m.phone" :href="remindLink(m)" target="_blank" rel="noopener" class="chip bg-pos-soft py-1.5 text-pos"><Icon name="chat" :size="14" /> Remind</a>
            <button v-else class="chip bg-sunk py-1.5 text-ink-soft" @click="shareText(memberReminder(m, coopName, currency))"><Icon name="share" :size="14" /> Remind</button>
          </div>
        </div>
      </section>

      <section v-if="p && upToDate.length">
        <button class="flex w-full items-center justify-between px-1 text-sm font-semibold" @click="showPaid = !showPaid">
          Up to date ({{ upToDate.length }}) <Icon name="chevronDown" :size="18" class="text-ink-faint transition" :class="showPaid ? 'rotate-180' : ''" />
        </button>
        <div v-show="showPaid" class="card mt-3 divide-soft">
          <RouterLink v-for="m in upToDate" :key="m.name" :to="`/admin/members/${m.name}`" class="flex items-center gap-3 p-4">
            <span class="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-pos-soft text-sm font-bold text-pos">{{ initials(m.full_name) }}</span>
            <span class="min-w-0 flex-1">
              <span class="block truncate text-[15px] font-semibold">{{ m.full_name }}</span>
              <span class="block text-xs text-ink-soft">{{ m.standing.paid_through ? paidThroughLabel(m.standing.paid_through, m.standing.frequency) : 'Starts next period' }}</span>
            </span>
            <Icon name="chevron" :size="18" class="text-ink-faint" />
          </RouterLink>
        </div>
      </section>

      <!-- Pool -->
      <section v-if="dashboard" class="card grid grid-cols-2 gap-4 p-5">
        <div><p class="text-xs text-ink-soft">Pool available</p><p class="money text-xl">{{ money(dashboard.pool.pool_balance, currency) }}</p></div>
        <div><p class="text-xs text-ink-soft">Out on loan</p><p class="money text-xl">{{ money(dashboard.pool.loans_outstanding, currency) }}</p></div>
        <div><p class="text-xs text-ink-soft">Saved, all time</p><p class="money text-xl">{{ money(dashboard.pool.total_contributions, currency) }}</p></div>
        <div><p class="text-xs text-ink-soft">Active members</p><p class="money text-xl">{{ dashboard.pool.member_count }}</p></div>
      </section>
    </template>
  </div>
</template>
