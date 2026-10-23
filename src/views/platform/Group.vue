<script setup>
// One group in the platform console: who it is, who runs it, its plan and subscription, and the
// decisions (review, pause, plan, extension). No money: the console can't see the group's books.
import { ref, computed, onMounted } from 'vue'
import * as api from '../../api'
import { toast } from '../../store'
import { money, date, relative, whatsappLink } from '../../format'
import PageHeader from '../../components/PageHeader.vue'
import Loader from '../../components/Loader.vue'
import ErrorBox from '../../components/ErrorBox.vue'
import Sheet from '../../components/Sheet.vue'
import Icon from '../../components/Icon.vue'

const props = defineProps({ name: String })
const g = ref(null)
const error = ref('')
const busy = ref(false)
const act = ref(null) // { kind, title, subtitle, note, plan, days, needsNote }

const STATUS_TONE = { 'Pending review': 'bg-warn-soft text-warn', Active: 'bg-pos-soft text-pos', Suspended: 'bg-neg-soft text-neg', Declined: 'bg-sunk text-ink-soft', Inactive: 'bg-sunk text-ink-soft' }
const SUB = { trial: 'Free trial', active: 'Paid', grace: 'In grace days', lapsed: 'Lapsed: new loans and members paused', free: 'Free plan', review: 'Starts when approved' }

async function load() {
  try { g.value = await api.get('platform.get_group', { name: props.name }) } catch (e) { error.value = e.message }
}
onMounted(load)

const sub = computed(() => g.value?.subscription)
const plan = computed(() => sub.value?.plan)
const usage = computed(() => (g.value && plan.value ? [
  { label: 'Members', used: g.value.usage.members, max: plan.value.max_members },
  { label: 'Loan products', used: g.value.usage.loan_products, max: plan.value.max_loan_products },
  { label: 'Savings products', used: g.value.usage.savings_products, max: plan.value.max_savings_products },
] : []))

const ACTIONS = {
  approve: { title: 'Approve this group?', subtitle: 'Members can join and pay. Their free trial starts today.', method: 'review_group', args: { approve: 1 } },
  decline: { title: 'Decline this group?', subtitle: 'Say why. The founder sees this, and nobody can join.', method: 'review_group', args: { approve: 0 }, needsNote: true },
  suspend: { title: 'Pause this group?', subtitle: 'Everyone can still sign in and see their records, but nothing can change. Money that arrives is still recorded. Members are told why.', method: 'suspend_group', needsNote: true, danger: true },
  reinstate: { title: 'Open this group again?', subtitle: 'Members are told it’s open again.', method: 'reinstate_group' },
  plan: { title: 'Change the plan', subtitle: 'Limits apply to what the group adds from now on. The admins are told.', method: 'change_plan' },
  extend: { title: 'Give more time', subtitle: 'For a goodwill extension or a payment made another way. Say which.', method: 'extend_subscription', needsNote: true },
}
function open(kind) {
  act.value = { kind, ...ACTIONS[kind], note: '', plan: g.value.plan, days: 30 }
}
async function run() {
  const a = act.value
  busy.value = true
  try {
    const args = { name: props.name, ...(a.args || {}) }
    if (a.kind === 'suspend') args.reason = a.note
    else args.note = a.note
    if (a.kind === 'plan') args.plan = a.plan
    if (a.kind === 'extend') args.days = a.days
    g.value = await api.post(`platform.${a.method}`, args)
    toast('Done. The group has been told.')
    act.value = null
  } catch (e) { toast(e.message, 'error') } finally { busy.value = false }
}
const contactLink = (phone, name) => whatsappLink(phone, `Hello ${name.split(' ')[0]}, this is Cooperative360 about ${g.value.cooperative_name}.`)
</script>

<template>
  <div>
    <PageHeader :title="g?.cooperative_name || 'Group'" :subtitle="g ? `${g.name} · started ${date(g.creation)}` : ''" back="/platform?tab=groups" />
    <div class="space-y-4 px-5 pb-12 pt-1">
      <ErrorBox :message="error" />
      <Loader v-if="!g && !error" />
      <template v-if="g">
        <section class="card p-5">
          <div class="flex items-center justify-between gap-3">
            <span class="chip" :class="STATUS_TONE[g.status]">{{ g.status }}</span>
            <span class="text-xs text-ink-soft">{{ g.last_active ? `Last used ${relative(g.last_active)}` : 'Not used yet' }}</span>
          </div>
          <p v-if="g.status_reason" class="mt-3 rounded-2xl bg-sunk p-3 text-sm">{{ g.status_reason }}</p>
          <dl class="mt-3 divide-soft text-sm">
            <div class="flex justify-between gap-3 py-2.5"><dt class="text-ink-soft">Town and state</dt><dd class="text-right">{{ g.location || '—' }}</dd></div>
            <div class="flex justify-between gap-3 py-2.5"><dt class="text-ink-soft">Registration no.</dt><dd class="num text-right">{{ g.registration_number || 'Not given' }}</dd></div>
            <div class="flex justify-between gap-3 py-2.5"><dt class="text-ink-soft">Members</dt><dd class="text-right">{{ g.members }}<span v-if="g.expected_members" class="text-ink-faint"> (expects about {{ g.expected_members }})</span></dd></div>
            <div v-if="g.approved_on" class="flex justify-between gap-3 py-2.5"><dt class="text-ink-soft">Approved</dt><dd>{{ date(g.approved_on) }}</dd></div>
          </dl>
          <p v-if="g.description" class="mt-2 text-sm text-ink-soft">{{ g.description }}</p>

          <div class="mt-4 flex flex-wrap gap-2">
            <template v-if="g.status === 'Pending review'">
              <button class="btn-primary btn-sm" @click="open('approve')"><Icon name="check" :size="15" /> Approve</button>
              <button class="btn-secondary btn-sm" @click="open('decline')">Decline</button>
            </template>
            <button v-if="g.status === 'Active'" class="btn-secondary btn-sm text-neg" @click="open('suspend')">Pause group</button>
            <button v-if="g.status === 'Suspended'" class="btn-primary btn-sm" @click="open('reinstate')">Open again</button>
            <button v-if="g.status === 'Declined'" class="btn-secondary btn-sm" @click="open('reinstate')">Approve after all</button>
          </div>
        </section>

        <section class="card p-4">
          <h2 class="text-sm font-semibold">Who runs it</h2>
          <div class="mt-2 divide-soft">
            <div v-for="o in g.officers" :key="o.full_name + o.role" class="flex items-center gap-3 py-3">
              <span class="min-w-0 flex-1"><span class="block font-semibold">{{ o.full_name }}</span><span class="block truncate text-xs text-ink-soft">{{ o.role }}<template v-if="o.phone"> · {{ o.phone }}</template><template v-if="o.email"> · {{ o.email }}</template></span></span>
              <a v-if="o.phone" :href="contactLink(o.phone, o.full_name)" target="_blank" rel="noopener" class="btn-secondary btn-sm" :aria-label="`WhatsApp ${o.full_name}`"><Icon name="chat" :size="15" /></a>
            </div>
          </div>
        </section>

        <section class="card p-4">
          <div class="flex items-center justify-between">
            <h2 class="text-sm font-semibold">Plan</h2>
            <div v-if="['Active', 'Suspended'].includes(g.status)" class="flex gap-3">
              <button class="text-xs font-semibold link" @click="open('plan')">Change</button>
              <button class="text-xs font-semibold link" @click="open('extend')">Give more time</button>
            </div>
          </div>
          <p class="mt-1 text-lg font-semibold">{{ plan?.plan_name || 'None' }}<span v-if="plan?.price_monthly" class="text-sm font-normal text-ink-soft"> · {{ money(plan.price_monthly, 'NGN') }} a month</span></p>
          <p class="text-sm" :class="['grace', 'lapsed'].includes(sub.state) ? 'text-neg' : 'text-ink-soft'">{{ SUB[sub.state] }}<template v-if="sub.ends_on"> · {{ sub.state === 'trial' || sub.state === 'active' ? 'until' : 'ended' }} {{ date(sub.ends_on) }}</template></p>
          <div class="mt-3 space-y-2.5">
            <div v-for="u in usage" :key="u.label">
              <div class="flex justify-between text-xs"><span class="text-ink-soft">{{ u.label }}</span><span class="num">{{ u.used }}{{ u.max ? ` of ${u.max}` : ' · no limit' }}</span></div>
              <div v-if="u.max" class="mt-1 h-1.5 overflow-hidden rounded-full bg-line/[0.07]"><div class="h-full rounded-full" :class="u.used > u.max ? 'bg-neg' : 'bg-brand'" :style="{ width: `${Math.min(100, (u.used / u.max) * 100)}%` }" /></div>
            </div>
          </div>
          <p v-for="x in g.plan_problems" :key="x" class="mt-2 flex gap-1.5 text-xs text-warn"><Icon name="alert" :size="14" class="mt-px shrink-0" /> {{ x }}</p>
          <div v-if="g.payments.length" class="mt-4 border-t border-line/[0.07] pt-3">
            <p class="text-xs font-semibold text-ink-soft">Subscription payments</p>
            <div v-for="p in g.payments" :key="p.reference" class="mt-2 flex justify-between gap-3 text-sm">
              <span><span class="block">{{ p.plan }} · {{ p.months }} month{{ p.months === 1 ? '' : 's' }}</span><span class="block text-xs text-ink-soft">{{ p.status === 'Success' ? `${date(p.period_from)} to ${date(p.period_to)} · ${p.paid_by_name || ''}` : p.status }}</span></span>
              <span class="num">{{ money(p.amount, 'NGN') }}</span>
            </div>
          </div>
        </section>

        <section>
          <h2 class="px-1 text-sm font-semibold">History</h2>
          <div class="card mt-3 divide-soft">
            <div v-for="(a, i) in g.actions" :key="i" class="p-4 text-sm">
              <p><b>{{ a.action }}</b><template v-if="a.plan"> · {{ a.plan }}</template><template v-if="a.paid_until"> · until {{ date(a.paid_until) }}</template></p>
              <p v-if="a.note" class="text-ink-soft">{{ a.note }}</p>
              <p class="text-xs text-ink-faint">{{ a.done_by_name }} · {{ date(a.creation, { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' }) }}</p>
            </div>
            <p v-if="!g.actions.length" class="p-4 text-sm text-ink-soft">Nothing yet.</p>
          </div>
        </section>
      </template>
    </div>

    <Sheet :open="!!act" :title="act?.title" :subtitle="act?.subtitle" @close="act = null">
      <form v-if="act" class="space-y-4" @submit.prevent="run">
        <div v-if="act.kind === 'plan'">
          <label class="label" for="ga-plan">Plan</label>
          <select id="ga-plan" v-model="act.plan" class="input"><option v-for="p in g.plans" :key="p" :value="p">{{ p }}</option></select>
        </div>
        <div v-if="act.kind === 'extend'">
          <label class="label" for="ga-days">Days</label>
          <div class="grid grid-cols-4 gap-2">
            <button v-for="d in [7, 30, 90, 365]" :key="d" type="button" class="rounded-2xl border py-2.5 text-sm font-semibold" :class="act.days === d ? 'border-brand-text/50 bg-brand-soft text-brand-text' : 'border-line/12'" @click="act.days = d">{{ d }}</button>
          </div>
        </div>
        <div>
          <label class="label" for="ga-note">{{ act.needsNote ? 'Reason' : 'Note' }} <span v-if="!act.needsNote" class="font-normal text-ink-faint">(optional)</span></label>
          <textarea id="ga-note" v-model="act.note" rows="3" class="input" :required="act.needsNote" :placeholder="act.kind === 'suspend' ? 'e.g. Members reported payouts that never arrived. We’re looking into it.' : ''" />
          <p v-if="act.needsNote" class="hint">The group’s admins see this{{ act.kind === 'suspend' ? ', and so do its members' : '' }}.</p>
        </div>
        <button class="w-full" :class="act.danger ? 'btn-danger' : 'btn-primary'" :disabled="busy || (act.needsNote && act.note.trim().length < 5)">Confirm</button>
      </form>
    </Sheet>
  </div>
</template>
