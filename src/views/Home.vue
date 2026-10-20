<script setup>
import { ref, computed, onMounted } from 'vue'
import * as api from '../api'
import { state, current, currency, isAdmin } from '../store'
import { money, date, relative } from '../format'
import CoopSwitcher from '../components/CoopSwitcher.vue'
import ActivityRow from '../components/ActivityRow.vue'
import InstallPrompt from '../components/InstallPrompt.vue'
import ErrorBox from '../components/ErrorBox.vue'
import Loader from '../components/Loader.vue'
import Icon from '../components/Icon.vue'

const data = ref(null)
const error = ref('')
const pendingMember = computed(() => current.value?.status !== 'Active')
const pendingTotal = computed(() => Object.values(data.value?.pending || {}).reduce((a, b) => a + b, 0))

async function load() {
  error.value = ''
  if (pendingMember.value) return
  try {
    data.value = await api.get('coop.get_dashboard', { cooperative: current.value.cooperative })
  } catch (e) {
    error.value = e.message
  }
}
onMounted(load)
</script>

<template>
  <div>
    <header class="flex items-center justify-between gap-3 px-5 pt-safe">
      <div class="min-w-0 pt-5">
        <p class="text-sm text-ink-soft">Hello, {{ state.user?.first_name }}</p>
        <CoopSwitcher />
      </div>
      <RouterLink to="/announcements" class="relative mt-5 rounded-full bg-white p-2.5 shadow-sm" aria-label="Announcements">
        <Icon name="bell" />
        <span v-if="data?.announcements?.length" class="absolute right-2 top-2 h-2 w-2 rounded-full bg-amber-500" />
      </RouterLink>
    </header>

    <div v-if="pendingMember" class="p-5">
      <div class="card p-6 text-center">
        <div class="mx-auto w-fit rounded-full bg-amber-50 p-3 text-amber-700"><Icon name="clock" :size="28" /></div>
        <h2 class="mt-3 text-lg font-bold">Membership {{ current.status.toLowerCase() }}</h2>
        <p class="mt-1 text-sm text-ink-soft" v-if="current.status === 'Pending'">An admin of {{ current.cooperative_name }} needs to approve your request. Check back soon.</p>
        <p class="mt-1 text-sm text-ink-soft" v-else>Contact your cooperative admin for help.</p>
      </div>
    </div>

    <div v-else-if="error" class="p-5"><ErrorBox :message="error" /><button class="btn-secondary mt-3 w-full" @click="load">Try again</button></div>
    <Loader v-else-if="!data" />

    <div v-else class="space-y-5 px-5 pt-4">
      <!-- Balance card -->
      <section class="relative overflow-hidden rounded-3xl bg-brand-800 p-5 text-white shadow-lg shadow-brand-900/10">
        <div class="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/5" />
        <div class="absolute -bottom-16 right-10 h-40 w-40 rounded-full bg-amber-300/10" />
        <p class="text-sm text-brand-100">My total savings</p>
        <p class="num mt-1 text-[34px] font-extrabold leading-tight tracking-tight">{{ money(data.balances.total_contributed, currency) }}</p>
        <div class="mt-5 grid grid-cols-2 gap-3 text-sm">
          <div class="rounded-2xl bg-white/10 p-3">
            <p class="text-brand-100">To pay back</p>
            <p class="num mt-0.5 font-bold">{{ money(data.balances.loan_outstanding, currency) }}</p>
          </div>
          <div class="rounded-2xl bg-white/10 p-3">
            <p class="text-brand-100">Can borrow</p>
            <p class="num mt-0.5 font-bold">{{ money(Math.min(data.balances.borrow_limit, data.pool.pool_balance), currency) }}</p>
          </div>
        </div>
      </section>

      <!-- Actions -->
      <section class="grid grid-cols-3 gap-3">
        <RouterLink to="/contribute" class="card flex flex-col items-center gap-2 py-4 text-sm font-semibold">
          <span class="rounded-full bg-brand-50 p-2.5 text-brand-700"><Icon name="arrowDown" /></span>Contribute
        </RouterLink>
        <RouterLink to="/loans/new" class="card flex flex-col items-center gap-2 py-4 text-sm font-semibold">
          <span class="rounded-full bg-amber-50 p-2.5 text-amber-700"><Icon name="arrowUp" /></span>Borrow
        </RouterLink>
        <RouterLink :to="data.active_loans.find(l => l.status === 'Active') ? `/loans/${data.active_loans.find(l => l.status === 'Active').name}/repay` : '/loans'"
          class="card flex flex-col items-center gap-2 py-4 text-sm font-semibold">
          <span class="rounded-full bg-sky-50 p-2.5 text-sky-700"><Icon name="check" /></span>Repay
        </RouterLink>
      </section>

      <RouterLink v-if="isAdmin && pendingTotal" to="/admin" class="flex items-center gap-3 rounded-2xl bg-amber-50 p-4 text-amber-900">
        <Icon name="alert" />
        <span class="flex-1 text-sm font-semibold">{{ pendingTotal }} item{{ pendingTotal > 1 ? 's' : '' }} waiting for your review</span>
        <Icon name="chevron" />
      </RouterLink>

      <InstallPrompt />

      <!-- Loans -->
      <section v-if="data.active_loans.length" class="space-y-3">
        <h2 class="section-title">My loans</h2>
        <RouterLink v-for="l in data.active_loans" :key="l.name" :to="`/loans/${l.name}`" class="card block p-4">
          <div class="flex items-center justify-between">
            <p class="font-semibold">{{ money(l.principal, currency) }} loan</p>
            <span v-if="l.status === 'Pending'" class="text-xs font-bold text-amber-700">Awaiting approval</span>
            <span v-else class="text-xs text-ink-soft">Due {{ date(l.due_date) }}</span>
          </div>
          <template v-if="l.status === 'Active'">
            <div class="mt-3 h-2 overflow-hidden rounded-full bg-black/5">
              <div class="h-full rounded-full bg-brand-600" :style="{ width: `${Math.min(100, (l.amount_repaid / l.total_payable) * 100)}%` }" />
            </div>
            <div class="mt-2 flex justify-between text-xs text-ink-soft">
              <span>Paid {{ money(l.amount_repaid, currency) }}</span>
              <span class="font-semibold text-ink">Left {{ money(l.balance, currency) }}</span>
            </div>
          </template>
        </RouterLink>
      </section>

      <!-- Pool -->
      <section class="card p-4">
        <div class="flex items-center justify-between">
          <h2 class="section-title">Cooperative pool</h2>
          <span class="text-xs text-ink-soft">{{ data.pool.member_count }} members</span>
        </div>
        <p class="num mt-2 text-2xl font-extrabold">{{ money(data.pool.pool_balance, currency) }}</p>
        <p class="text-xs text-ink-soft">Available in the pool now</p>
        <dl class="mt-4 grid grid-cols-2 gap-3 text-sm">
          <div><dt class="text-ink-soft">Total saved</dt><dd class="num font-semibold">{{ money(data.pool.total_contributions, currency, { compact: true }) }}</dd></div>
          <div><dt class="text-ink-soft">Out on loan</dt><dd class="num font-semibold">{{ money(data.pool.loans_outstanding, currency, { compact: true }) }}</dd></div>
        </dl>
      </section>

      <!-- Announcements -->
      <section v-if="data.announcements.length" class="space-y-3">
        <div class="flex items-center justify-between">
          <h2 class="section-title">Announcements</h2>
          <RouterLink to="/announcements" class="text-xs font-semibold text-brand-700">See all</RouterLink>
        </div>
        <div class="card p-4">
          <div class="flex items-center gap-2">
            <Icon v-if="data.announcements[0].pinned" name="pin" :size="14" class="text-amber-600" />
            <p class="font-semibold">{{ data.announcements[0].title }}</p>
          </div>
          <p class="mt-1 line-clamp-3 whitespace-pre-line text-sm text-ink-soft">{{ data.announcements[0].message }}</p>
          <p class="mt-2 text-xs text-ink-faint">{{ relative(data.announcements[0].creation) }}</p>
        </div>
      </section>

      <!-- Activity -->
      <section>
        <div class="flex items-center justify-between">
          <h2 class="section-title">Recent activity</h2>
          <RouterLink to="/history" class="text-xs font-semibold text-brand-700">See all</RouterLink>
        </div>
        <div v-if="data.recent.length" class="card mt-3 divide-y divide-black/5 px-4">
          <ActivityRow v-for="e in data.recent" :key="e.doctype + e.name" :entry="e" :currency="currency" />
        </div>
        <div v-else class="card mt-3 p-6 text-center text-sm text-ink-soft">
          No activity yet. Make your first contribution to start saving.
        </div>
      </section>
    </div>
  </div>
</template>
