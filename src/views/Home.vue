<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import * as api from '../api'
import { state, current, currency, isAdmin, dashboard, loadDashboard, copyText, lastSeenAnnouncement, toast } from '../store'
import { money, date, shortDate, dueIn, relative, firstName, periodName, paidThroughLabel, periodWord } from '../format'
import CoopSwitcher from '../components/CoopSwitcher.vue'
import ActivityRow from '../components/ActivityRow.vue'
import InstallPrompt from '../components/InstallPrompt.vue'
import ErrorBox from '../components/ErrorBox.vue'
import Loader from '../components/Loader.vue'
import Icon from '../components/Icon.vue'

const error = ref('')
const data = dashboard
const pendingMember = computed(() => current.value?.status !== 'Active')
const pendingTotal = computed(() => Object.values(data.value?.pending || {}).reduce((a, b) => a + b, 0))
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1)

const canBorrow = computed(() => Math.max(0, Math.min(data.value?.balances?.borrow_limit || 0, data.value?.pool?.pool_balance || 0)))
const activeLoans = computed(() => (data.value?.active_loans || []).filter((l) => l.status === 'Active'))
const pendingLoans = computed(() => (data.value?.active_loans || []).filter((l) => ['Pending', 'Approved'].includes(l.status)))
const sentLoans = computed(() => (data.value?.active_loans || []).filter((l) => l.status === 'Sent'))
const sentWithdrawals = computed(() => (data.value?.withdrawals || []).filter((w) => w.status === 'Sent'))
const pendingWithdrawals = computed(() => (data.value?.withdrawals || []).filter((w) => ['Pending', 'Approved'].includes(w.status)))
const openingBalances = computed(() => data.value?.opening_balances || [])
const guaranteeRequests = computed(() => data.value?.guarantee_requests || [])
// Dues and loan instalments due now: paid together on /pay
const due = computed(() => data.value?.due || [])
const dueTotal = computed(() => due.value.reduce((t, d) => t + d.amount, 0))
const payPath = computed(() => (due.value.length > 1 ? '/pay' : { path: '/save', query: { amount: standing.value?.pay } }))
// Savings split by product, shown when there's more than the regular contributions
const productBalances = computed(() => (data.value?.balances?.products || []).filter((p) => p.balance > 0.005))
const meeting = computed(() => data.value?.next_meeting)
const meetingWhen = (m) => date(m.starts_at, { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })
const unread = computed(() => data.value?.unread_notifications || 0)
const holdUntil = computed(() => {
  const h = data.value?.security_hold_until
  return h && new Date(String(h).replace(' ', 'T')) > new Date() ? h : null
})
const busy = ref('')

async function respondOpening(row, accept) {
  busy.value = row.name
  try {
    await api.post('finance.respond_opening_balance', { name: row.name, accept: accept ? 1 : 0 })
    toast(accept ? 'Opening balance added to your savings' : 'Opening balance declined')
    await loadDashboard()
  } catch (e) { toast(e.message, 'error') } finally { busy.value = '' }
}

const standing = computed(() => {
  const s = data.value?.standing
  if (!s?.tracked) return null
  const f = s.frequency
  if (s.state === 'up_to_date') {
    return { tone: 'ok', title: paidThroughLabel(s.paid_through, f), sub: `Next ${money(s.next_amount ?? s.amount, currency.value)} due ${dueIn(s.next_due_date)}` }
  }
  if (s.state === 'due') {
    return { tone: 'due', title: `${cap(periodName(s.current_period_start, f))}’s ${money(s.due_now, currency.value)} is due`, sub: `Pay by ${shortDate(s.current_period_end)}`, pay: s.due_now }
  }
  if (s.state === 'behind') {
    return { tone: 'behind', title: `${s.periods_behind} ${periodWord(f, s.periods_behind)} behind`, sub: `${money(s.due_now, currency.value)} brings you up to date`, pay: s.due_now }
  }
  return { tone: 'ok', title: 'Contributions haven’t started yet', sub: `First one due ${dueIn(s.next_due_date)}` }
})

const latestNews = computed(() => data.value?.announcements?.[0])
const unreadNews = computed(() => latestNews.value && latestNews.value.creation > lastSeenAnnouncement(current.value?.cooperative))
const period = computed(() => data.value?.period)

async function load() {
  error.value = ''
  if (pendingMember.value) return
  try { await loadDashboard() } catch (e) { if (!data.value) error.value = e.message }
}
const onVisible = () => document.visibilityState === 'visible' && load()
onMounted(() => {
  load()
  document.addEventListener('visibilitychange', onVisible)
})
onBeforeUnmount(() => document.removeEventListener('visibilitychange', onVisible))
</script>

<template>
  <div>
    <header class="flex items-start justify-between gap-3 px-5 pt-safe">
      <div class="min-w-0 pt-6">
        <p class="text-sm text-ink-soft">Hello, {{ firstName(state.user?.full_name) }}</p>
        <CoopSwitcher />
      </div>
      <RouterLink to="/notifications" class="relative mt-6 grid h-11 w-11 place-items-center rounded-full border border-line/[0.07] bg-card shadow-soft"
        :aria-label="unread ? `Notifications, ${unread} unread` : 'Notifications'">
        <Icon name="bell" />
        <span v-if="unread" class="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-brand px-1 text-[11px] font-bold text-white ring-2 ring-paper">{{ unread > 9 ? '9+' : unread }}</span>
      </RouterLink>
    </header>

    <!-- Awaiting approval -->
    <div v-if="pendingMember" class="px-5 pt-6">
      <div class="card p-7 text-center">
        <div class="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-warn-soft text-warn"><Icon name="clock" :size="28" /></div>
        <h2 class="mt-4 font-display text-2xl font-semibold">{{ current.status === 'Pending' ? 'Almost there' : current.status === 'Left' ? 'You left this group' : `Membership ${current.status.toLowerCase()}` }}</h2>
        <p v-if="current.status === 'Pending'" class="mt-2 text-ink-soft">An admin of <b>{{ current.cooperative_name }}</b> needs to approve your request. They’ve been notified, and you’ll get a notification as soon as they do.</p>
        <template v-else-if="current.status === 'Left' && current.savings > 0">
          <p class="mt-2 text-ink-soft"><b class="money text-ink">{{ money(current.savings, currency) }}</b> reached {{ current.cooperative_name }} after you left. It’s still yours.</p>
          <RouterLink to="/withdraw" class="btn-primary mt-5 w-full">Withdraw it</RouterLink>
        </template>
        <p v-else-if="current.status === 'Suspended' && current.savings > 0" class="mt-2 text-ink-soft">Your <b class="money text-ink">{{ money(current.savings, currency) }}</b> in savings is safe. Contact your cooperative admin for help.</p>
        <p v-else class="mt-2 text-ink-soft">Contact your cooperative admin for help.</p>
      </div>
      <div class="mt-4"><InstallPrompt /></div>
    </div>

    <div v-else-if="error" class="px-5 pt-6"><ErrorBox :message="error" /><button class="btn-secondary mt-3 w-full" @click="load">Try again</button></div>
    <Loader v-else-if="!data" />

    <div v-else class="space-y-4 px-5 pt-5">
      <!-- Savings hero -->
      <section class="relative overflow-hidden rounded-4xl bg-gradient-to-br from-navy-800 via-navy-800 to-navy-700 p-5 pb-4 text-white shadow-lift">
        <svg class="pointer-events-none absolute -right-16 -top-20 h-64 w-64 text-glow-400/[0.13]" viewBox="0 0 100 100" aria-hidden="true">
          <circle cx="50" cy="50" r="34" fill="none" stroke="currentColor" stroke-width="9" /><circle cx="50" cy="50" r="18" fill="none" stroke="currentColor" stroke-width="3" />
        </svg>
        <p class="relative text-sm text-navy-100/75">Your savings</p>
        <p class="money relative mt-0.5 text-[44px] leading-[1.05]">{{ money(data.balances.savings, currency) }}</p>
        <p v-if="productBalances.length > 1" class="relative mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-navy-100/75">
          <span v-for="p in productBalances" :key="p.product">{{ p.product_name }} <b class="num font-semibold text-white">{{ money(p.balance, currency, { compact: true }) }}</b><Icon v-if="p.locked" name="lock" :size="11" class="ml-0.5 inline align-[-1px]" /></span>
        </p>

        <div v-if="standing" class="relative mt-3 flex items-center gap-2.5 rounded-2xl px-3 py-2.5"
          :class="standing.tone === 'behind' ? 'bg-[#f87171]/20' : 'bg-white/10'">
          <Icon :name="standing.tone === 'ok' ? 'checkCircle' : standing.tone === 'due' ? 'clock' : 'alert'" :size="18"
            :class="standing.tone === 'behind' ? 'text-[#fecaca]' : 'text-glow-300'" />
          <div class="min-w-0 flex-1 leading-tight">
            <p class="truncate text-sm font-semibold">{{ standing.title }}</p>
            <p class="truncate text-xs text-navy-100/70">{{ standing.sub }}</p>
          </div>
          <RouterLink v-if="standing.pay" :to="payPath" class="btn-light btn-sm shrink-0 px-3 py-1.5">Pay</RouterLink>
        </div>

        <div class="relative mt-3 grid grid-cols-2 gap-2">
          <RouterLink to="/loans/new" class="rounded-2xl bg-white/[0.08] p-3 transition hover:bg-white/[0.12]">
            <p class="text-xs text-navy-100/70">You can borrow</p>
            <p class="money mt-0.5 text-xl">{{ money(canBorrow, currency) }}</p>
          </RouterLink>
          <RouterLink to="/loans" class="rounded-2xl bg-white/[0.08] p-3 transition hover:bg-white/[0.12]">
            <p class="text-xs text-navy-100/70">You owe</p>
            <p class="money mt-0.5 text-xl">{{ money(data.balances.loan_outstanding, currency) }}</p>
          </RouterLink>
        </div>
      </section>

      <!-- Actions -->
      <section class="grid grid-cols-4 gap-2.5">
        <RouterLink v-for="a in [
          { to: '/save', label: 'Save', icon: 'arrowDown', tone: 'bg-pos-soft text-pos' },
          { to: '/loans/new', label: 'Borrow', icon: 'loans', tone: 'bg-brand-soft text-brand-text' },
          { to: activeLoans[0] ? `/loans/${activeLoans[0].name}/repay` : '/loans', label: 'Repay', icon: 'check', tone: 'bg-info-soft text-info' },
          { to: '/withdraw', label: 'Withdraw', icon: 'arrowUp', tone: 'bg-accent-soft text-accent-text' },
        ]" :key="a.label" :to="a.to" class="card flex flex-col items-center gap-2 py-3.5 text-[13px] font-semibold transition hover:-translate-y-0.5">
          <span class="grid h-10 w-10 place-items-center rounded-2xl" :class="a.tone"><Icon :name="a.icon" :size="19" /></span>{{ a.label }}
        </RouterLink>
      </section>

      <!-- Things waiting on the member -->
      <RouterLink v-if="due.length > 1" to="/pay" class="card flex items-center gap-3.5 border-brand-text/30 p-4">
        <span class="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-brand-soft text-brand-text"><Icon name="layers" /></span>
        <div class="min-w-0 flex-1">
          <p class="text-[15px] font-semibold">{{ money(dueTotal, currency) }} due now</p>
          <p class="truncate text-xs text-ink-soft">{{ due.map((d) => `${d.label} ${money(d.amount, currency)}`).join(' · ') }}</p>
        </div>
        <span class="btn-primary btn-sm">Pay all</span>
      </RouterLink>
      <section v-if="holdUntil" class="flex gap-3 rounded-3xl bg-warn-soft p-4 text-sm text-warn">
        <Icon name="shield" :size="18" class="mt-0.5" />
        <p>Your password was reset, so payout changes, loans and withdrawals are paused until <b>{{ date(holdUntil, { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }) }}</b>.</p>
      </section>
      <RouterLink v-for="g in guaranteeRequests" :key="g.loan" :to="`/loans/${g.loan}`" class="card flex items-center gap-3.5 border-brand-text/30 p-4">
        <span class="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-brand-soft text-brand-text"><Icon name="shield" /></span>
        <div class="min-w-0 flex-1">
          <p class="text-[15px] font-semibold">{{ g.borrower }} asked you to be a guarantor</p>
          <p class="truncate text-xs text-ink-soft">{{ money(g.amount, currency) }} of their {{ money(g.principal, currency) }} loan</p>
        </div>
        <span class="btn-primary btn-sm">Answer</span>
      </RouterLink>
      <div v-for="ob in openingBalances" :key="ob.name" class="card border-brand-text/30 p-4">
        <p class="text-xs font-semibold text-brand-text">Please confirm</p>
        <p class="mt-1 text-[15px]">Your opening balance of <b class="money">{{ money(ob.amount, currency) }}</b>, what you’d saved before Cooperative360{{ ob.contribution_date ? ` (as of ${date(ob.contribution_date)})` : '' }}.</p>
        <p v-if="ob.notes" class="mt-1 text-sm text-ink-soft">“{{ ob.notes }}”</p>
        <div class="mt-3 grid grid-cols-2 gap-2">
          <button class="btn-secondary btn-sm" :disabled="busy === ob.name" @click="respondOpening(ob, false)">That’s not right</button>
          <button class="btn-primary btn-sm" :disabled="busy === ob.name" @click="respondOpening(ob, true)">Yes, that’s right</button>
        </div>
      </div>
      <RouterLink v-for="l in sentLoans" :key="l.name" :to="`/loans/${l.name}`" class="card flex items-center gap-3.5 border-brand-text/30 p-4">
        <span class="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-brand-soft text-brand-text"><Icon name="bank" /></span>
        <div class="min-w-0 flex-1">
          <p class="text-[15px] font-semibold">{{ l.receipt_disputed ? 'We’re looking into your loan transfer' : 'Did your loan arrive?' }}</p>
          <p class="truncate text-xs text-ink-soft">{{ money(l.principal, currency) }} sent to {{ l.payout_bank_name }} ••{{ String(l.payout_account_number || '').slice(-4) }}</p>
        </div>
        <span v-if="!l.receipt_disputed" class="btn-primary btn-sm">Confirm</span>
      </RouterLink>
      <RouterLink v-for="w in sentWithdrawals" :key="w.name" :to="`/withdrawals/${w.name}`" class="card flex items-center gap-3.5 border-brand-text/30 p-4">
        <span class="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-brand-soft text-brand-text"><Icon name="bank" /></span>
        <div class="min-w-0 flex-1">
          <p class="text-[15px] font-semibold">{{ w.receipt_disputed ? 'We’re looking into your withdrawal' : 'Did your withdrawal arrive?' }}</p>
          <p class="truncate text-xs text-ink-soft">{{ money(w.amount, currency) }} sent to {{ w.payout_bank_name }} ••{{ String(w.payout_account_number || '').slice(-4) }}</p>
        </div>
        <span v-if="!w.receipt_disputed" class="btn-primary btn-sm">Confirm</span>
      </RouterLink>
      <RouterLink v-for="w in pendingWithdrawals" :key="w.name" :to="`/withdrawals/${w.name}`" class="card flex items-center gap-3 p-4">
        <span class="grid h-10 w-10 place-items-center rounded-2xl bg-warn-soft text-warn"><Icon name="clock" :size="18" /></span>
        <div class="flex-1"><p class="text-sm font-semibold">Withdrawal of {{ money(w.amount, currency) }}</p><p class="text-xs text-ink-soft">{{ w.status === 'Approved' ? 'Approved. The treasurer will send it soon.' : 'Waiting for approval' }}</p></div>
        <Icon name="chevron" :size="18" class="text-ink-faint" />
      </RouterLink>

      <!-- Admin: collection progress + reviews -->
      <RouterLink v-if="isAdmin && period" to="/admin" class="card block p-4">
        <div class="flex items-center justify-between gap-3">
          <p class="text-sm font-semibold">{{ cap(periodName(period.start, period.frequency)) }} collection</p>
          <span v-if="pendingTotal" class="chip bg-accent-soft text-accent-text">{{ pendingTotal }} to review</span>
          <Icon v-else name="chevron" :size="18" class="text-ink-faint" />
        </div>
        <div class="mt-3 h-2 overflow-hidden rounded-full bg-line/[0.07]">
          <div class="h-full rounded-full bg-brand" :style="{ width: `${period.members ? ((period.members - period.due - period.behind) / period.members) * 100 : 0}%` }" />
        </div>
        <p class="mt-2 text-xs text-ink-soft">
          <template v-if="period.due + period.behind"><b class="text-ink">{{ period.members - period.due - period.behind }} of {{ period.members }}</b> members paid up · {{ period.due + period.behind }} still to pay</template>
          <template v-else><b class="text-ink">Everyone is paid up</b> 🎉</template>
          · {{ money(period.collected, currency) }} received
        </p>
      </RouterLink>
      <RouterLink v-else-if="isAdmin && pendingTotal" to="/admin" class="flex items-center gap-3 rounded-3xl bg-accent-soft p-4 text-accent-text">
        <Icon name="alert" />
        <span class="flex-1 text-sm font-semibold">{{ pendingTotal }} item{{ pendingTotal > 1 ? 's' : '' }} waiting for your review</span>
        <Icon name="chevron" />
      </RouterLink>

      <!-- Loans: what's due next -->
      <RouterLink v-for="l in activeLoans" :key="l.name" :to="`/loans/${l.name}`" class="card block p-4">
        <div class="flex items-start justify-between gap-3">
          <div>
            <p class="text-xs font-semibold" :class="l.schedule?.is_overdue ? 'text-neg' : 'text-ink-soft'">
              {{ l.schedule?.is_overdue ? 'Loan payment overdue' : 'Next loan payment' }}
            </p>
            <p class="money mt-0.5 text-2xl">{{ money(l.schedule?.is_overdue ? l.schedule.overdue_amount : l.schedule?.next_amount || l.balance, currency) }}</p>
            <p class="text-xs text-ink-soft">{{ l.schedule?.next_due_date ? `Due ${dueIn(l.schedule.next_due_date)}` : '' }} · {{ money(l.balance, currency) }} left of {{ money(l.total_payable, currency) }}</p>
          </div>
          <span class="btn-secondary btn-sm">Repay</span>
        </div>
        <div class="mt-3 h-1.5 overflow-hidden rounded-full bg-line/[0.07]">
          <div class="h-full rounded-full" :class="l.schedule?.is_overdue ? 'bg-neg' : 'bg-info'" :style="{ width: `${Math.min(100, (l.amount_repaid / l.total_payable) * 100)}%` }" />
        </div>
      </RouterLink>
      <RouterLink v-for="l in pendingLoans" :key="l.name" :to="`/loans/${l.name}`" class="card flex items-center gap-3 p-4">
        <span class="grid h-10 w-10 place-items-center rounded-2xl bg-warn-soft text-warn"><Icon name="clock" :size="18" /></span>
        <div class="flex-1">
          <p class="text-sm font-semibold">Loan request for {{ money(l.principal, currency) }}</p>
          <p class="text-xs text-ink-soft">{{ l.status === 'Approved' ? 'Approved. The treasurer will send it soon.' : 'Waiting for approval' }}</p>
        </div>
        <Icon name="chevron" :size="18" class="text-ink-faint" />
      </RouterLink>

      <!-- Dedicated account -->
      <section v-if="data.dedicated_account?.status === 'Assigned'" class="card p-4">
        <div class="flex items-center gap-2 text-xs font-semibold text-ink-soft"><Icon name="bank" :size="16" /> Your savings account number</div>
        <div class="mt-2 flex items-center justify-between gap-3">
          <div>
            <p class="money text-[26px] tracking-wider">{{ data.dedicated_account.account_number }}</p>
            <p class="text-xs text-ink-soft">{{ data.dedicated_account.bank_name }} · {{ data.dedicated_account.account_name }}</p>
          </div>
          <button class="btn-secondary btn-sm" @click="copyText(data.dedicated_account.account_number, 'Account number copied')"><Icon name="copy" :size="16" /> Copy</button>
        </div>
        <p class="mt-2 text-xs text-ink-soft">Any transfer to this account is recorded automatically: it pays contributions due first, then loan instalments due, and the rest is saved.</p>
      </section>

      <!-- Autosave -->
      <RouterLink v-if="data.autosave?.enabled" to="/autosave" class="card flex items-center gap-3.5 p-4">
        <span class="grid h-11 w-11 place-items-center rounded-2xl bg-brand-soft text-brand-text"><Icon name="repeat" /></span>
        <div class="min-w-0 flex-1">
          <p class="text-sm font-semibold">Autosave is on</p>
          <p class="truncate text-xs text-ink-soft">{{ money(data.autosave.amount, currency) }} on {{ shortDate(data.autosave.next_date) }} · {{ data.autosave.method?.label }}</p>
        </div>
        <Icon name="chevron" :size="18" class="text-ink-faint" />
      </RouterLink>
      <RouterLink v-else-if="data.payments?.autosave && data.payments?.online && standing" to="/autosave" class="flex items-center gap-3.5 rounded-3xl border border-dashed border-brand-text/30 bg-brand-soft/60 p-4">
        <span class="grid h-11 w-11 place-items-center rounded-2xl bg-card text-brand-text"><Icon name="repeat" /></span>
        <div class="flex-1">
          <p class="text-sm font-semibold">Never miss a contribution</p>
          <p class="text-xs text-ink-soft">Turn on Autosave and it’s paid for you each {{ periodWord(data.standing.frequency) }}.</p>
        </div>
        <Icon name="chevron" :size="18" class="text-ink-faint" />
      </RouterLink>
      <p v-if="data.autosave?.last_error && !data.autosave?.enabled" class="rounded-2xl bg-neg-soft px-4 py-3 text-sm text-neg">Autosave stopped: {{ data.autosave.last_error }}</p>

      <InstallPrompt />

      <!-- Next meeting -->
      <RouterLink v-if="meeting" :to="`/meetings/${meeting.name}`" class="card flex items-center gap-3.5 p-4">
        <span class="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-info-soft text-info"><Icon name="calendar" /></span>
        <div class="min-w-0 flex-1">
          <p class="truncate text-[15px] font-semibold">{{ meeting.title }}</p>
          <p class="truncate text-xs text-ink-soft">{{ meetingWhen(meeting) }}<span v-if="meeting.venue"> · {{ meeting.venue }}</span></p>
        </div>
        <span v-if="meeting.my_response" class="chip" :class="meeting.my_response === 'Coming' ? 'bg-pos-soft text-pos' : 'bg-sunk text-ink-soft'">{{ meeting.my_response === 'Coming' ? 'Coming' : 'Apology sent' }}</span>
        <span v-else class="btn-secondary btn-sm">Reply</span>
      </RouterLink>

      <!-- Announcement -->
      <RouterLink v-if="latestNews" to="/announcements" class="card block p-4">
        <div class="flex items-center gap-2 text-xs font-semibold text-ink-soft">
          <Icon :name="latestNews.pinned ? 'pin' : 'bell'" :size="14" :class="latestNews.pinned ? 'text-accent' : ''" />
          Announcement · {{ relative(latestNews.creation) }}
          <span v-if="unreadNews" class="chip ml-auto bg-accent-soft px-2 py-0.5 text-[10px] text-accent-text">New</span>
        </div>
        <p class="mt-2 font-semibold">{{ latestNews.title }}</p>
        <p class="mt-1 line-clamp-2 whitespace-pre-line text-sm text-ink-soft">{{ latestNews.message }}</p>
      </RouterLink>

      <!-- Pool -->
      <section class="card p-4">
        <div class="flex items-center justify-between">
          <h2 class="text-sm font-semibold">The pool</h2>
          <span class="flex items-center gap-1 text-xs text-ink-soft"><Icon name="users" :size="14" /> {{ data.pool.member_count }} members</span>
        </div>
        <p class="money mt-1 text-[28px]">{{ money(data.pool.pool_balance, currency) }}</p>
        <p class="text-xs text-ink-soft">available to lend right now</p>
        <div class="mt-4 grid grid-cols-2 gap-3 border-t border-line/[0.07] pt-3 text-sm">
          <div><p class="text-xs text-ink-soft">Saved by everyone</p><p class="num font-semibold">{{ money(data.pool.total_contributions, currency, { compact: true }) }}</p></div>
          <div><p class="text-xs text-ink-soft">Out on loan</p><p class="num font-semibold">{{ money(data.pool.loans_outstanding, currency, { compact: true }) }}</p></div>
        </div>
      </section>

      <!-- Activity -->
      <section class="pb-2">
        <div class="flex items-center justify-between px-1">
          <h2 class="text-sm font-semibold">Recent activity</h2>
          <RouterLink to="/activity" class="text-xs link">See all</RouterLink>
        </div>
        <div v-if="data.recent.length" class="card mt-3 px-4 py-1">
          <ActivityRow v-for="e in data.recent" :key="e.doctype + e.name" :entry="e" :currency="currency" />
        </div>
        <div v-else class="card mt-3 p-6 text-center">
          <p class="font-semibold">Nothing here yet</p>
          <p class="mt-1 text-sm text-ink-soft">Your first contribution will show up here.</p>
          <RouterLink to="/save" class="btn-primary btn-sm mt-4">Make your first contribution</RouterLink>
        </div>
      </section>
    </div>
  </div>
</template>
