<script setup>
import { ref, computed, onMounted, onActivated } from 'vue'
import * as api from '../../api'
import { current, currency, isOwner, toast } from '../../store'
import { money, date, isoDate } from '../../format'
import Loader from '../../components/Loader.vue'
import ErrorBox from '../../components/ErrorBox.vue'
import Sheet from '../../components/Sheet.vue'
import Icon from '../../components/Icon.vue'

const s = ref(null)
const error = ref('')
const closing = ref(false)
const closeDate = ref('')
const busy = ref(false)
const yesterday = isoDate(new Date(Date.now() - 864e5))

async function load() {
  error.value = ''
  try { s.value = await api.get('accounts.summary', { cooperative: current.value.cooperative }) } catch (e) { error.value = e.message }
}
onMounted(load)
onActivated(() => s.value && load())

const reports = [
  { kind: 'balance-sheet', title: 'Balance sheet', sub: 'What the group owns and owes', icon: 'bank' },
  { kind: 'income', title: 'Income statement', sub: 'Interest and fees earned, costs paid', icon: 'activity' },
  { kind: 'cash-flow', title: 'Cash flow', sub: 'Where the money came from and went', icon: 'repeat' },
  { kind: 'trial-balance', title: 'Trial balance', sub: 'Every account, debits and credits', icon: 'file' },
]
const yearLabel = computed(() => s.value && `${date(s.value.year_start, { month: 'short', year: 'numeric' })} – ${date(s.value.year_end, { month: 'short', year: 'numeric' })}`)

async function closeBooks() {
  busy.value = true
  try {
    s.value = await api.post('accounts.close_books', { cooperative: current.value.cooperative, until: closeDate.value })
    closing.value = false
    toast(`Books closed up to ${date(closeDate.value)}`)
  } catch (e) { toast(e.message, 'error') } finally { busy.value = false }
}
</script>

<template>
  <div class="space-y-4">
    <ErrorBox :message="error" />
    <Loader v-if="!s && !error" />
    <template v-if="s">
      <!-- What the group holds -->
      <section class="relative overflow-hidden rounded-4xl bg-navy-800 p-5 text-white shadow-lift">
        <svg class="pointer-events-none absolute -right-14 -top-14 h-48 w-48 text-glow-400/[0.12]" viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="34" fill="none" stroke="currentColor" stroke-width="9" /></svg>
        <p class="relative text-sm text-navy-100/80">Money the group holds</p>
        <p class="money relative mt-1 text-[34px] leading-tight">{{ money(s.cash_total, currency) }}</p>
        <p class="relative mt-1 text-xs text-navy-100/70">
          Bank {{ money(s.bank, currency) }}<template v-if="s.paystack"> · Paystack {{ money(s.paystack, currency) }}</template><template v-if="s.cash"> · Cash {{ money(s.cash, currency) }}</template>
        </p>
        <div class="relative mt-4 grid grid-cols-2 gap-2 text-sm">
          <div class="rounded-2xl bg-white/[0.08] p-3"><p class="text-xs text-navy-100/70">Owed to members</p><p class="money">{{ money(s.members_savings, currency) }}</p></div>
          <div class="rounded-2xl bg-white/[0.08] p-3"><p class="text-xs text-navy-100/70">Out on loan</p><p class="money">{{ money(s.loans_out, currency) }}</p></div>
          <div v-if="s.reserve" class="rounded-2xl bg-white/[0.08] p-3"><p class="text-xs text-navy-100/70">Reserve fund</p><p class="money">{{ money(s.reserve, currency) }}</p></div>
          <div v-if="s.unallocated" class="rounded-2xl bg-warn/30 p-3"><p class="text-xs text-white/80">Not yet matched</p><p class="money">{{ money(s.unallocated, currency) }}</p></div>
        </div>
      </section>

      <!-- This year -->
      <section class="card p-5">
        <div class="flex items-baseline justify-between">
          <h2 class="font-semibold">This financial year</h2>
          <span class="text-xs text-ink-soft">{{ yearLabel }}</span>
        </div>
        <div class="mt-3 grid grid-cols-3 gap-2 text-center">
          <div><p class="text-xs text-ink-soft">Earned</p><p class="money text-lg">{{ money(s.income, currency, { compact: true }) }}</p></div>
          <div><p class="text-xs text-ink-soft">Costs</p><p class="money text-lg">{{ money(s.expenses, currency, { compact: true }) }}</p></div>
          <div><p class="text-xs text-ink-soft">{{ s.surplus < 0 ? 'Deficit' : 'Surplus' }}</p><p class="money text-lg" :class="s.surplus < 0 ? 'text-neg' : 'text-pos'">{{ money(Math.abs(s.surplus), currency, { compact: true }) }}</p></div>
        </div>
        <RouterLink to="/admin/books/share-out" class="mt-4 flex items-center gap-3 rounded-2xl bg-brand-soft/70 p-3 text-sm">
          <Icon name="users" :size="18" class="text-brand-text" />
          <span class="flex-1"><b class="block">{{ s.share_out_draft ? 'Share-out waiting for approval' : 'Year-end share-out' }}</b><span class="text-xs text-ink-soft">Share the surplus with members after the reserve</span></span>
          <Icon name="chevron" :size="18" class="text-ink-faint" />
        </RouterLink>
      </section>

      <!-- Reports -->
      <section>
        <h2 class="px-1 text-sm font-semibold">Reports</h2>
        <div class="card mt-3 divide-soft">
          <RouterLink v-for="r in reports" :key="r.kind" :to="`/admin/books/report/${r.kind}`" class="flex items-center gap-3.5 p-4">
            <span class="grid h-10 w-10 place-items-center rounded-2xl bg-sunk text-ink-soft"><Icon :name="r.icon" :size="18" /></span>
            <span class="flex-1"><span class="block text-[15px] font-semibold">{{ r.title }}</span><span class="block text-xs text-ink-soft">{{ r.sub }}</span></span>
            <Icon name="chevron" :size="18" class="text-ink-faint" />
          </RouterLink>
        </div>
      </section>

      <!-- Records -->
      <section>
        <h2 class="px-1 text-sm font-semibold">Records</h2>
        <div class="card mt-3 divide-soft">
          <RouterLink to="/admin/books/journals" class="flex items-center gap-3.5 p-4">
            <span class="grid h-10 w-10 place-items-center rounded-2xl bg-sunk text-ink-soft"><Icon name="history" :size="18" /></span>
            <span class="flex-1"><span class="block text-[15px] font-semibold">Journal entries</span><span class="block text-xs text-ink-soft">Every posting, with who did it</span></span>
            <span v-if="s.drafts" class="chip bg-accent text-white">{{ s.drafts }} to approve</span>
            <Icon name="chevron" :size="18" class="text-ink-faint" />
          </RouterLink>
          <RouterLink to="/admin/books/accounts" class="flex items-center gap-3.5 p-4">
            <span class="grid h-10 w-10 place-items-center rounded-2xl bg-sunk text-ink-soft"><Icon name="coins" :size="18" /></span>
            <span class="flex-1"><span class="block text-[15px] font-semibold">Chart of accounts</span><span class="block text-xs text-ink-soft">Balances and account history</span></span>
            <Icon name="chevron" :size="18" class="text-ink-faint" />
          </RouterLink>
          <RouterLink to="/admin/books/journal/new" class="flex items-center gap-3.5 p-4">
            <span class="grid h-10 w-10 place-items-center rounded-2xl bg-sunk text-ink-soft"><Icon name="plus" :size="18" /></span>
            <span class="flex-1"><span class="block text-[15px] font-semibold">Record an expense or adjustment</span><span class="block text-xs text-ink-soft">Another staff member approves it</span></span>
            <Icon name="chevron" :size="18" class="text-ink-faint" />
          </RouterLink>
        </div>
      </section>

      <section class="flex items-center gap-3 rounded-3xl bg-sunk p-4 text-sm">
        <Icon name="lock" :size="18" class="shrink-0 text-ink-soft" />
        <p class="flex-1 text-ink-soft">{{ s.books_closed_until ? `Books closed up to ${date(s.books_closed_until)}. Nothing can be posted on or before then.` : 'The books are open. Close them after the year is audited.' }}</p>
        <button v-if="isOwner" class="text-sm font-semibold link" @click="closing = true; closeDate = yesterday">Close</button>
      </section>
    </template>

    <Sheet :open="closing" title="Close the books" subtitle="After this date nothing can be posted, so the figures for that period can’t change. Only do this once the accounts are checked." @close="closing = false">
      <form class="space-y-4" @submit.prevent="closeBooks">
        <div><label class="label" for="close-date">Close up to and including</label><input id="close-date" v-model="closeDate" type="date" :max="yesterday" class="input" required /></div>
        <button class="btn-primary w-full" :disabled="busy">Close the books</button>
      </form>
    </Sheet>
  </div>
</template>
