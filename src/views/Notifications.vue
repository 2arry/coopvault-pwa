<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import * as api from '../api'
import { current, dashboard, toast } from '../store'
import { relative } from '../format'
import { pushSupported, needsInstallForPush, currentSubscription, enablePush } from '../push'
import PageHeader from '../components/PageHeader.vue'
import Loader from '../components/Loader.vue'
import ErrorBox from '../components/ErrorBox.vue'
import Icon from '../components/Icon.vue'

const router = useRouter()
const items = ref(null)
const unread = ref(0)
const error = ref('')
const pushOn = ref(true)
const enabling = ref(false)

const groups = computed(() => {
  const today = new Date().toDateString()
  const out = { Today: [], Earlier: [] }
  for (const n of items.value || []) out[new Date(String(n.creation).replace(' ', 'T')).toDateString() === today ? 'Today' : 'Earlier'].push(n)
  return Object.entries(out).filter(([, list]) => list.length)
})
const icons = { payment: 'checkCircle', 'loan-sent': 'bank', 'withdrawal-sent': 'bank', 'join-request': 'users', 'loan-request': 'loans',
  'withdrawal-request': 'arrowUp', autosave: 'repeat', 'due-reminder': 'clock', security: 'shield', 'payout-changed': 'shield',
  'bank-changed': 'bank', 'opening-balance': 'wallet', announcement: 'bell', plan: 'calendar', 'transfer-disputed': 'alert' }

async function load() {
  try {
    const res = await api.get('notifications.list_notifications', { limit: 50 })
    items.value = res.items
    unread.value = res.unread
  } catch (e) { error.value = e.message }
}

async function open(n) {
  if (!n.read) {
    n.read = 1
    api.post('notifications.mark_read', { names: [n.name] }).then((r) => syncUnread(r.unread)).catch(() => {})
  }
  if (n.link) router.push(n.link)
}
async function markAll() {
  try {
    syncUnread((await api.post('notifications.mark_read', { all: 1 })).unread)
    items.value.forEach((n) => (n.read = 1))
  } catch (e) { toast(e.message, 'error') }
}
function syncUnread(count) {
  unread.value = count
  if (dashboard.value) dashboard.value.unread_notifications = count
}
async function turnOnPush() {
  enabling.value = true
  try {
    await enablePush()
    pushOn.value = true
    toast('Notifications are on for this phone')
  } catch (e) { toast(e.message, 'error') } finally { enabling.value = false }
}

onMounted(async () => {
  load()
  pushOn.value = !pushSupported || !!(await currentSubscription().catch(() => null))
})
</script>

<template>
  <div>
    <PageHeader title="Notifications" :subtitle="current?.cooperative_name" back="/home">
      <template #actions>
        <button v-if="unread" class="btn-ghost btn-sm" @click="markAll">Mark all read</button>
      </template>
    </PageHeader>
    <div class="space-y-5 px-5 pb-12">
      <div v-if="!pushOn" class="flex items-start gap-3.5 rounded-3xl bg-brand-soft p-4">
        <span class="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-card text-brand-text"><Icon name="bell" /></span>
        <div class="flex-1 text-sm">
          <p class="font-semibold">Get these on your phone</p>
          <p v-if="needsInstallForPush" class="text-ink-soft">On iPhone, add Cooperative360 to your home screen first (Share → Add to Home Screen), then turn notifications on from there.</p>
          <template v-else>
            <p class="text-ink-soft">We’ll tell you when money arrives, a loan is sent or something needs you.</p>
            <button class="btn-primary btn-sm mt-3" :disabled="enabling" @click="turnOnPush">Turn on notifications</button>
          </template>
        </div>
      </div>

      <ErrorBox :message="error" />
      <Loader v-if="!items && !error" />
      <div v-else-if="items && !items.length" class="card p-8 text-center">
        <div class="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-sunk text-ink-soft"><Icon name="bell" :size="26" /></div>
        <p class="mt-4 font-semibold">You’re all caught up</p>
        <p class="mt-1 text-sm text-ink-soft">Payments, loan updates and reminders will show up here.</p>
      </div>
      <section v-for="[label, list] in groups" :key="label">
        <h2 class="px-1 text-sm font-semibold text-ink-soft">{{ label }}</h2>
        <div class="card mt-2 divide-soft">
          <button v-for="n in list" :key="n.name" class="flex w-full items-start gap-3 p-4 text-left transition hover:bg-line/[0.03]" @click="open(n)">
            <span class="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl" :class="n.read ? 'bg-sunk text-ink-faint' : 'bg-brand-soft text-brand-text'">
              <Icon :name="icons[n.kind] || 'bell'" :size="17" />
            </span>
            <span class="min-w-0 flex-1">
              <span class="block text-[15px]" :class="n.read ? 'text-ink-soft' : 'font-semibold'">{{ n.title }}</span>
              <span v-if="n.body" class="mt-0.5 block text-sm text-ink-soft">{{ n.body }}</span>
              <span class="mt-1 block text-xs text-ink-faint">{{ relative(n.creation) }}</span>
            </span>
            <span v-if="!n.read" class="mt-2 h-2.5 w-2.5 shrink-0 rounded-full bg-brand" aria-label="Unread" />
          </button>
        </div>
      </section>
    </div>
  </div>
</template>
