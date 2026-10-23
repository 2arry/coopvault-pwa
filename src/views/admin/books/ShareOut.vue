<script setup>
// Year-end share-out: preview, send for approval, and (for another Admin) approve and post.
import { ref, computed, watch, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import * as api from '../../../api'
import { current, currency, toast } from '../../../store'
import { money, date, isoDate } from '../../../format'
import PageHeader from '../../../components/PageHeader.vue'
import Loader from '../../../components/Loader.vue'
import ErrorBox from '../../../components/ErrorBox.vue'
import Sheet from '../../../components/Sheet.vue'
import StatusPill from '../../../components/StatusPill.vue'
import Icon from '../../../components/Icon.vue'
import ApprovalSteps from '../../../components/ApprovalSteps.vue'

const props = defineProps({ name: String })
const router = useRouter()
const BASES = [
  { key: 'Average savings', label: 'Average savings', hint: 'Fairest for groups where people join and save at different times: someone who saved all year gets more than someone who saved the same amount in December.' },
  { key: 'Savings at year end', label: 'Savings at year end', hint: 'Simple to explain: what each member had saved on the last day.' },
  { key: 'Interest paid', label: 'Interest paid', hint: 'A patronage refund: members who paid interest on loans get it back in proportion.' },
]
const yesterday = isoDate(new Date(Date.now() - 864e5))
const opts = ref({ period_end: yesterday, reserve_percent: null, member_percent: 100, basis: 'Average savings' })
const preview = ref(null)
const doc = ref(null)
const existing = ref(null)
const error = ref('')
const busy = ref(false)
const confirming = ref(false)
const from = ref(null) // the day after the books were last closed, or the first record
const closedBefore = ref(false)

async function load() {
  error.value = ''
  try {
    if (props.name) { doc.value = await api.get('accounts.get_share_out', { name: props.name }); return }
    const s = await api.get('accounts.summary', { cooperative: current.value.cooperative })
    if (s.share_out_draft) return router.replace(`/admin/books/share-out/${s.share_out_draft}`)
    opts.value.period_end = String(s.suggested_share_out_end).slice(0, 10)
    opts.value.reserve_percent = s.reserve_percent
    from.value = s.share_out_from ? String(s.share_out_from).slice(0, 10) : null
    closedBefore.value = !!s.books_closed_until
    existing.value = await api.get('accounts.share_outs', { cooperative: current.value.cooperative })
    await refresh()
  } catch (e) { error.value = e.message }
}
async function refresh() {
  error.value = ''
  try {
    preview.value = await api.get('accounts.preview_share_out', { cooperative: current.value.cooperative, ...opts.value,
      reserve_percent: opts.value.reserve_percent ?? undefined })
    if (opts.value.reserve_percent == null) opts.value.reserve_percent = preview.value.reserve_percent
  } catch (e) { preview.value = null; error.value = e.message }
}
let timer
watch(() => ({ ...opts.value }), () => { if (props.name) return; clearTimeout(timer); timer = setTimeout(refresh, 350) }, { deep: true })
watch(() => props.name, load)
onMounted(load)

const shown = computed(() => doc.value || preview.value)
const basisHint = computed(() => BASES.find((b) => b.key === (shown.value?.basis || opts.value.basis))?.hint)

async function submit() {
  busy.value = true
  try {
    const d = await api.post('accounts.create_share_out', { cooperative: current.value.cooperative, ...opts.value })
    toast('Sent to the other admins to approve')
    router.replace(`/admin/books/share-out/${d.name}`)
  } catch (e) { toast(e.message, 'error') } finally { busy.value = false }
}
async function approve() {
  busy.value = true
  try {
    doc.value = await api.post('accounts.approve_share_out', { name: props.name })
    confirming.value = false
    toast('Posted. Members have been credited and told.')
  } catch (e) { toast(e.message, 'error') } finally { busy.value = false }
}
async function cancel() {
  busy.value = true
  try {
    await api.post('accounts.cancel_share_out', { name: props.name })
    toast('Share-out cancelled')
    router.replace('/admin/books/share-out')
  } catch (e) { toast(e.message, 'error') } finally { busy.value = false }
}
</script>

<template>
  <div>
    <PageHeader title="Year-end share-out" :subtitle="current?.cooperative_name" back="/admin?tab=books" />
    <div class="space-y-4 px-5 pb-12 pt-1">
      <ErrorBox :message="error" />

      <!-- Settings (new share-out only) -->
      <section v-if="!props.name" class="card space-y-4 p-5">
        <div><label class="label" for="so-end">Share out the surplus up to</label><input id="so-end" v-model="opts.period_end" type="date" :min="from" :max="yesterday" class="input" />
          <p v-if="from" class="hint">{{ closedBefore ? `Starts ${date(from)}, the day after the books were last closed.` : `Starts ${date(from)}, the group’s first record.` }}</p></div>
        <div class="grid grid-cols-2 gap-3">
          <div><label class="label" for="so-reserve">To the reserve fund</label><div class="relative"><input id="so-reserve" v-model.number="opts.reserve_percent" type="number" min="0" max="100" class="input pr-9" /><span class="absolute right-4 top-1/2 -translate-y-1/2 text-ink-soft">%</span></div></div>
          <div><label class="label" for="so-members">Of the rest, to members</label><div class="relative"><input id="so-members" v-model.number="opts.member_percent" type="number" min="0" max="100" class="input pr-9" /><span class="absolute right-4 top-1/2 -translate-y-1/2 text-ink-soft">%</span></div></div>
        </div>
        <div>
          <span class="label">Share it in proportion to</span>
          <div class="space-y-2">
            <label v-for="b in BASES" :key="b.key" class="flex cursor-pointer items-center gap-3 rounded-2xl border p-3 text-sm" :class="opts.basis === b.key ? 'border-brand-text/40 bg-brand-soft/50' : 'border-line/10'">
              <input v-model="opts.basis" type="radio" :value="b.key" class="h-4 w-4 accent-[rgb(var(--brand))]" /> <span class="font-semibold">{{ b.label }}</span>
            </label>
          </div>
          <p class="hint">{{ basisHint }}</p>
        </div>
      </section>

      <Loader v-if="!shown && !error" />
      <template v-if="shown">
        <section class="card p-5">
          <div class="flex items-center justify-between">
            <p class="text-sm text-ink-soft">{{ date(shown.period_start) }} – {{ date(shown.period_end) }}</p>
            <StatusPill v-if="doc" :status="doc.status" :label="doc.status === 'Draft' ? 'Waiting for approval' : undefined" />
          </div>
          <div class="mt-3 divide-soft text-sm">
            <div class="flex justify-between py-2"><span class="text-ink-soft">Earned (interest, fees…)</span><span class="num">{{ money(shown.income, currency) }}</span></div>
            <div class="flex justify-between py-2"><span class="text-ink-soft">Costs</span><span class="num">{{ shown.expenses > 0 ? '− ' : '' }}{{ money(shown.expenses, currency) }}</span></div>
            <div class="flex justify-between py-2 font-semibold"><span>{{ shown.surplus < 0 ? 'Deficit' : 'Surplus' }}</span><span class="num" :class="shown.surplus < 0 ? 'text-neg' : ''">{{ money(shown.surplus, currency) }}</span></div>
            <div class="flex justify-between py-2"><span class="text-ink-soft">Reserve fund ({{ shown.reserve_percent }}%)</span><span class="num">{{ money(shown.reserve_amount, currency) }}</span></div>
            <div class="flex justify-between py-2"><span class="text-ink-soft">Kept for the group</span><span class="num">{{ money(shown.retained, currency) }}</span></div>
            <div class="flex justify-between py-2 text-base font-bold"><span>Shared with members</span><span class="money">{{ money(shown.to_members, currency) }}</span></div>
          </div>
          <p v-if="shown.surplus <= 0" class="mt-3 rounded-2xl bg-warn-soft p-3 text-sm text-warn">There’s no surplus to share for this period. Approving still closes the year: the result moves to retained surplus and the books are closed up to {{ date(shown.period_end) }}.</p>
        </section>

        <section v-if="shown.lines?.length">
          <h2 class="px-1 text-sm font-semibold">{{ doc && !doc.can_approve && doc.lines.length === 1 && doc.status !== 'Draft' ? 'Your share' : `Members (${shown.lines.length})` }}</h2>
          <div class="card mt-2 divide-soft">
            <div v-for="l in shown.lines" :key="l.member" class="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
              <div class="min-w-0"><p class="truncate font-semibold">{{ l.member_name }}</p><p class="text-xs text-ink-soft">{{ shown.basis === 'Interest paid' ? 'Paid' : 'Savings' }} {{ money(l.basis_value, currency) }}</p></div>
              <p class="money">{{ money(l.share_amount, currency) }}</p>
            </div>
          </div>
        </section>

        <template v-if="!props.name">
          <button class="btn-primary btn-lg w-full" :disabled="busy || !preview" @click="submit">Send for approval</button>
          <p class="flex gap-2 text-xs text-ink-soft"><Icon name="shield" :size="14" class="mt-0.5 shrink-0" /> Another admin approves it. Then each member’s share is added to their savings and the books are closed up to {{ date(opts.period_end) }}.</p>
          <div v-if="existing?.length" class="pt-2">
            <h2 class="px-1 text-sm font-semibold">Earlier share-outs</h2>
            <div class="card mt-2 divide-soft">
              <RouterLink v-for="e in existing" :key="e.name" :to="`/admin/books/share-out/${e.name}`" class="flex items-center justify-between px-4 py-3 text-sm">
                <span>{{ date(e.period_start) }} – {{ date(e.period_end) }}</span><span class="money">{{ money(e.to_members, currency) }}</span>
              </RouterLink>
            </div>
          </div>
        </template>
        <template v-else-if="doc?.status === 'Draft'">
          <p class="text-sm text-ink-soft">Prepared by {{ doc.prepared_by_name }}.</p>
          <div class="grid grid-cols-2 gap-2">
            <button class="btn-secondary" :disabled="busy" @click="cancel">Cancel it</button>
            <button class="btn-primary" :disabled="busy || !doc.can_approve" @click="confirming = true">Approve</button>
          </div>
          <p v-if="!doc.can_approve && doc.approval?.why_not" class="flex gap-2 text-xs text-ink-soft"><Icon name="info" :size="14" class="mt-0.5 shrink-0" /> {{ doc.approval.why_not }}</p>
          <section v-if="doc.approval" class="card p-5"><ApprovalSteps :approval="doc.approval" /></section>
        </template>
        <p v-else-if="doc?.status === 'Posted'" class="flex gap-2 rounded-2xl bg-pos-soft p-3 text-sm text-pos"><Icon name="checkCircle" :size="16" class="mt-0.5" /> Posted {{ date(doc.posted_on) }} by {{ doc.approved_by_name }}. <RouterLink v-if="doc.journal_entry" :to="`/admin/books/journal/${doc.journal_entry}`" class="link ml-auto">Entry</RouterLink></p>
      </template>
    </div>

    <Sheet :open="confirming" title="Approve the share-out?" :subtitle="doc ? `${money(doc.to_members, currency)} goes into members’ savings and the books close up to ${date(doc.period_end)}. This can’t be undone.` : ''" @close="confirming = false">
      <div class="grid grid-cols-2 gap-3">
        <button class="btn-secondary" @click="confirming = false">Not yet</button>
        <button class="btn-primary" :disabled="busy" @click="approve">Approve</button>
      </div>
    </Sheet>
  </div>
</template>
