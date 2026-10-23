<script setup>
// Cooperative360's own console: review new groups, look after plans and subscriptions, pause a
// group if needed. It never shows a group's money.
import { ref, computed, watch, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import * as api from '../../api'
import { current, toast } from '../../store'
import { money, date, relative } from '../../format'
import Loader from '../../components/Loader.vue'
import ErrorBox from '../../components/ErrorBox.vue'
import Sheet from '../../components/Sheet.vue'
import Icon from '../../components/Icon.vue'

const route = useRoute()
const router = useRouter()
const tab = computed(() => route.query.tab || 'overview')
const ov = ref(null)
const groups = ref(null)
const plans = ref(null)
const error = ref('')
const q = ref('')
const status = ref('')
const editing = ref(null)
const busy = ref(false)

const STATUS_TONE = { 'Pending review': 'bg-warn-soft text-warn', Active: 'bg-pos-soft text-pos', Suspended: 'bg-neg-soft text-neg', Declined: 'bg-sunk text-ink-soft', Inactive: 'bg-sunk text-ink-soft' }
const SUB_LABEL = { trial: 'Trial', active: 'Paid', grace: 'Grace days', lapsed: 'Lapsed', free: 'Free', review: 'Not started' }
const SUB_TONE = { trial: 'bg-info-soft text-info', active: 'bg-pos-soft text-pos', grace: 'bg-warn-soft text-warn', lapsed: 'bg-neg-soft text-neg', free: 'bg-sunk text-ink-soft', review: 'bg-sunk text-ink-soft' }

async function loadOverview() { try { ov.value = await api.get('platform.overview') } catch (e) { error.value = e.message } }
async function loadGroups() {
  try { groups.value = await api.get('platform.list_groups', { status: status.value || undefined, q: q.value || undefined }) } catch (e) { error.value = e.message }
}
async function loadPlans() { try { plans.value = await api.get('platform.list_plans') } catch (e) { error.value = e.message } }
function load() {
  error.value = ''
  if (tab.value === 'overview') loadOverview()
  else if (tab.value === 'groups') loadGroups()
  else loadPlans()
}
onMounted(load)
watch(tab, load)
let timer
watch([q, status], () => { clearTimeout(timer); timer = setTimeout(loadGroups, 250) })

const blank = () => ({ plan_name: '', description: '', enabled: 1, is_default: 0, price_monthly: 0, trial_days: 30, max_members: 0,
  max_loan_products: 0, max_savings_products: 0, online_payments: 1, dedicated_accounts: 0, autosave: 0 })
async function savePlan() {
  busy.value = true
  try {
    plans.value = await api.post('platform.save_plan', { ...editing.value })
    editing.value = null
    toast('Plan saved')
  } catch (e) { toast(e.message, 'error') } finally { busy.value = false }
}
const limit = (n) => (n ? n : 'No limit')
const subCount = (k) => ov.value?.subscriptions?.[k] || 0
</script>

<template>
  <div>
    <header class="flex items-start justify-between gap-3 px-5 pt-safe">
      <div class="pt-6">
        <p class="text-sm text-ink-soft">Cooperative360</p>
        <h1 class="font-display text-[28px] font-semibold tracking-tight">Platform console</h1>
      </div>
      <RouterLink :to="current ? '/home' : '/profile'" class="mt-7 btn-secondary btn-sm">{{ current ? 'My groups' : 'Me' }}</RouterLink>
    </header>
    <div class="px-5 pb-16 pt-4">
      <nav class="seg grid-cols-3" aria-label="Console sections">
        <button v-for="t in [{ k: 'overview', l: 'Overview' }, { k: 'groups', l: 'Groups' }, { k: 'plans', l: 'Plans' }]" :key="t.k" type="button"
          :class="{ on: tab === t.k }" :aria-current="tab === t.k ? 'page' : undefined" @click="router.replace({ query: { tab: t.k } })">{{ t.l }}</button>
      </nav>
      <p class="mt-3 flex items-center gap-1.5 text-xs text-ink-faint"><Icon name="shield" :size="13" /> The console shows who groups are and how they’re subscribed, never their money.</p>
      <ErrorBox :message="error" class="mt-4" />

      <!-- Overview -->
      <template v-if="tab === 'overview'">
        <Loader v-if="!ov && !error" />
        <div v-if="ov" class="mt-4 space-y-5">
          <div class="grid grid-cols-2 gap-3">
            <div class="card p-4"><p class="text-xs text-ink-soft">Groups open</p><p class="money text-2xl">{{ ov.by_status.Active }}</p><p class="text-xs text-ink-faint">{{ ov.members }} members</p></div>
            <div class="card p-4"><p class="text-xs text-ink-soft">To review</p><p class="money text-2xl" :class="ov.by_status['Pending review'] ? 'text-warn' : ''">{{ ov.by_status['Pending review'] }}</p><p class="text-xs text-ink-faint">{{ ov.by_status.Suspended }} paused · {{ ov.by_status.Declined }} declined</p></div>
            <div class="card p-4"><p class="text-xs text-ink-soft">Subscriptions</p><p class="mt-1 text-sm"><b>{{ subCount('active') }}</b> paid · <b>{{ subCount('trial') }}</b> trial</p><p class="text-xs text-ink-faint">{{ subCount('grace') }} in grace · {{ subCount('lapsed') }} lapsed · {{ subCount('free') }} free</p></div>
            <div class="card p-4"><p class="text-xs text-ink-soft">Paid this month</p><p class="money text-2xl">{{ money(ov.revenue_this_month, 'NGN', { compact: true }) }}</p><p class="text-xs text-ink-faint">{{ ov.payments_this_month }} payment{{ ov.payments_this_month === 1 ? '' : 's' }}</p></div>
          </div>

          <section>
            <h2 class="section-title">Waiting for review</h2>
            <div v-if="ov.pending.length" class="mt-3 space-y-2">
              <RouterLink v-for="g in ov.pending" :key="g.name" :to="`/platform/groups/${g.name}`" class="card flex items-center gap-3 p-4">
                <span class="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-warn-soft text-warn"><Icon name="clock" :size="18" /></span>
                <span class="min-w-0 flex-1">
                  <span class="block truncate font-semibold">{{ g.cooperative_name }}</span>
                  <span class="block truncate text-xs text-ink-soft">{{ g.founder }}<template v-if="g.location"> · {{ g.location }}</template><template v-if="g.expected_members"> · about {{ g.expected_members }} members</template></span>
                  <span class="block text-xs text-ink-faint">Asked {{ relative(g.creation) }}</span>
                </span>
                <span class="btn-primary btn-sm">Review</span>
              </RouterLink>
            </div>
            <p v-else class="mt-2 text-sm text-ink-soft">Nothing to review.</p>
          </section>

          <section v-if="ov.attention.length">
            <h2 class="section-title">Subscriptions to follow up</h2>
            <div class="card mt-3 divide-soft">
              <RouterLink v-for="g in ov.attention" :key="g.name" :to="`/platform/groups/${g.name}`" class="flex items-center gap-3 p-4">
                <span class="min-w-0 flex-1"><span class="block truncate font-semibold">{{ g.cooperative_name }}</span><span class="block text-xs text-ink-soft">{{ g.plan }} · {{ g.ends_on ? `ends ${date(g.ends_on)}` : '' }}</span></span>
                <span class="chip" :class="SUB_TONE[g.subscription]">{{ SUB_LABEL[g.subscription] }}</span>
              </RouterLink>
            </div>
          </section>

          <section v-if="ov.recent.length">
            <h2 class="section-title">Recent decisions</h2>
            <div class="card mt-3 divide-soft">
              <RouterLink v-for="(a, i) in ov.recent" :key="i" :to="`/platform/groups/${a.cooperative}`" class="block p-4 text-sm">
                <p><b>{{ a.action }}</b> · {{ a.cooperative_name }}</p>
                <p v-if="a.note" class="truncate text-xs text-ink-soft">{{ a.note }}</p>
                <p class="text-xs text-ink-faint">{{ a.done_by_name }} · {{ relative(a.creation) }}</p>
              </RouterLink>
            </div>
          </section>
        </div>
      </template>

      <!-- Groups -->
      <template v-else-if="tab === 'groups'">
        <div class="relative mt-4">
          <Icon name="search" :size="18" class="absolute left-4 top-1/2 -translate-y-1/2 text-ink-faint" />
          <input v-model="q" class="input pl-11" placeholder="Search by name or town" type="search" aria-label="Search groups" />
        </div>
        <div class="no-scrollbar -mx-5 mt-3 flex gap-2 overflow-x-auto px-5">
          <button v-for="s in ['', 'Pending review', 'Active', 'Suspended', 'Declined']" :key="s" type="button" class="shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition"
            :class="status === s ? 'bg-navy-800 text-white' : 'border border-line/12 bg-card text-ink-soft'" @click="status = s">{{ s || 'All' }}</button>
        </div>
        <Loader v-if="!groups && !error" />
        <div v-if="groups" class="card mt-4 divide-soft">
          <RouterLink v-for="g in groups" :key="g.name" :to="`/platform/groups/${g.name}`" class="flex items-center gap-3 p-4">
            <span class="min-w-0 flex-1">
              <span class="block truncate font-semibold">{{ g.cooperative_name }}</span>
              <span class="block truncate text-xs text-ink-soft">{{ g.location || '—' }} · {{ g.members }} member{{ g.members === 1 ? '' : 's' }} · {{ g.plan || 'No plan' }}</span>
            </span>
            <span class="flex flex-col items-end gap-1">
              <span class="chip" :class="STATUS_TONE[g.status]">{{ g.status }}</span>
              <span v-if="g.status === 'Active'" class="chip" :class="SUB_TONE[g.subscription]">{{ SUB_LABEL[g.subscription] }}</span>
            </span>
          </RouterLink>
          <p v-if="!groups.length" class="p-6 text-center text-sm text-ink-soft">No groups match.</p>
        </div>
      </template>

      <!-- Plans -->
      <template v-else>
        <Loader v-if="!plans && !error" />
        <div v-if="plans" class="mt-4 space-y-3">
          <button type="button" class="flex w-full items-center gap-3 rounded-3xl border border-dashed border-brand-text/40 bg-brand-soft/60 p-4 text-left" @click="editing = blank()">
            <span class="grid h-10 w-10 place-items-center rounded-2xl bg-card text-brand-text"><Icon name="plus" :size="19" /></span><b class="flex-1">New plan</b>
          </button>
          <button v-for="p in plans" :key="p.name" type="button" class="card block w-full p-4 text-left" @click="editing = { ...p }">
            <span class="flex items-start justify-between gap-3">
              <span>
                <span class="flex items-center gap-2 text-[17px] font-semibold">{{ p.plan_name }}
                  <span v-if="p.is_default" class="chip bg-brand-soft text-brand-text">New groups</span>
                  <span v-if="!p.enabled" class="chip bg-sunk text-ink-soft">Off</span></span>
                <span class="block text-xs text-ink-soft">{{ p.groups }} group{{ p.groups === 1 ? '' : 's' }} · {{ p.trial_days ? `${p.trial_days}-day trial` : 'no trial' }}</span>
              </span>
              <span class="money text-lg">{{ p.price_monthly ? money(p.price_monthly, 'NGN') : 'Free' }}</span>
            </span>
            <span class="mt-2 block text-xs text-ink-soft">Members {{ limit(p.max_members) }} · Loan products {{ limit(p.max_loan_products) }} · Savings products {{ limit(p.max_savings_products) }}</span>
            <span class="block text-xs text-ink-faint">{{ [p.online_payments && 'Online payments', p.dedicated_accounts && 'Account numbers', p.autosave && 'Autosave'].filter(Boolean).join(' · ') || 'No online features' }}</span>
          </button>
        </div>
      </template>
    </div>

    <Sheet :open="!!editing" :title="editing?.name ? editing.plan_name : 'New plan'" subtitle="Limits apply to what a group adds from now on. 0 means no limit." @close="editing = null">
      <form v-if="editing" class="space-y-4" @submit.prevent="savePlan">
        <div><label class="label" for="pl-name">Name</label><input id="pl-name" v-model="editing.plan_name" class="input" required :disabled="!!editing.name" /></div>
        <div><label class="label" for="pl-desc">Description <span class="font-normal text-ink-faint">(admins see this)</span></label><input id="pl-desc" v-model="editing.description" class="input" /></div>
        <div class="grid grid-cols-2 gap-3">
          <div><label class="label" for="pl-price">Price a month (₦)</label><input id="pl-price" v-model.number="editing.price_monthly" type="number" min="0" class="input" /></div>
          <div><label class="label" for="pl-trial">Free trial (days)</label><input id="pl-trial" v-model.number="editing.trial_days" type="number" min="0" class="input" /></div>
          <div><label class="label" for="pl-mem">Most members</label><input id="pl-mem" v-model.number="editing.max_members" type="number" min="0" class="input" /></div>
          <div><label class="label" for="pl-lp">Loan products</label><input id="pl-lp" v-model.number="editing.max_loan_products" type="number" min="0" class="input" /></div>
          <div><label class="label" for="pl-sp">Savings products</label><input id="pl-sp" v-model.number="editing.max_savings_products" type="number" min="0" class="input" /></div>
        </div>
        <label class="flex items-center gap-3 text-sm"><input v-model="editing.online_payments" type="checkbox" :true-value="1" :false-value="0" class="h-5 w-5" /> Online payments (Paystack checkout)</label>
        <label class="flex items-center gap-3 text-sm"><input v-model="editing.dedicated_accounts" type="checkbox" :true-value="1" :false-value="0" class="h-5 w-5" /> Personal account numbers</label>
        <label class="flex items-center gap-3 text-sm"><input v-model="editing.autosave" type="checkbox" :true-value="1" :false-value="0" class="h-5 w-5" /> Autosave</label>
        <label class="flex items-center gap-3 text-sm"><input v-model="editing.is_default" type="checkbox" :true-value="1" :false-value="0" class="h-5 w-5" /> Given to new groups</label>
        <label class="flex items-center gap-3 text-sm"><input v-model="editing.enabled" type="checkbox" :true-value="1" :false-value="0" class="h-5 w-5" /> Offered to groups</label>
        <button class="btn-primary w-full" :disabled="busy">Save plan</button>
      </form>
    </Sheet>
  </div>
</template>
