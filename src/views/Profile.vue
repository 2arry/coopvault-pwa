<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import * as api from '../api'
import { state, current, dashboard, loadDashboard, logout, signOut as endSession, toast, setTheme, copyText } from '../store'
import { pushSupported, needsInstallForPush, currentSubscription, enablePush, disablePush } from '../push'
import { initials } from '../format'
import PageHeader from '../components/PageHeader.vue'
import InstallPrompt from '../components/InstallPrompt.vue'
import Sheet from '../components/Sheet.vue'
import ErrorBox from '../components/ErrorBox.vue'
import Icon from '../components/Icon.vue'
import StatusPill from '../components/StatusPill.vue'

const router = useRouter()
const editing = ref(false)
const changingPw = ref(false)
const showMethods = ref(false)
const leaving = ref(null)
const profile = ref({ full_name: state.user?.full_name, phone: state.user?.mobile_no || '' })
const pw = ref({ old_password: '', new_password: '' })
const methods = ref([])
const error = ref('')
const busy = ref(false)

const payout = computed(() => state.user?.payout_account)
const pushOn = ref(false)
async function togglePush() {
  busy.value = true
  try {
    if (pushOn.value) { await disablePush(); pushOn.value = false; toast('Notifications turned off on this phone') }
    else { await enablePush(); pushOn.value = true; toast('Notifications are on for this phone') }
  } catch (e) { toast(e.message, 'error') } finally { busy.value = false }
}
const d = computed(() => (current.value?.status === 'Active' ? dashboard.value : null))
const dva = computed(() => d.value?.dedicated_account)
const dvaAvailable = computed(() => !!d.value?.payments?.dedicated_accounts)

onMounted(async () => {
  pushOn.value = !!(await currentSubscription().catch(() => null))
  if (current.value?.status === 'Active') loadDashboard().catch(() => {})
  if (state.paystack.enabled) methods.value = await api.get('payments.list_methods').catch(() => [])
})

async function saveProfile() {
  busy.value = true
  error.value = ''
  try {
    state.user = await api.post('auth.update_profile', profile.value)
    editing.value = false
    toast('Profile updated')
  } catch (e) { error.value = e.message } finally { busy.value = false }
}
async function changePassword() {
  busy.value = true
  error.value = ''
  try {
    await api.post('auth.change_password', pw.value)
    changingPw.value = false
    pw.value = { old_password: '', new_password: '' }
    toast('Password changed')
  } catch (e) { error.value = e.message } finally { busy.value = false }
}
async function removeMethod(m) {
  try {
    await api.post('payments.remove_method', { name: m.name })
    methods.value = methods.value.filter((x) => x.name !== m.name)
    toast('Payment method removed')
  } catch (e) { toast(e.message, 'error') }
}
async function requestDva() {
  busy.value = true
  try {
    const res = await api.post('payments.request_dedicated_account', { cooperative: current.value.cooperative })
    state.dashboards[current.value.cooperative].dedicated_account = res
    toast(res.status === 'Assigned' ? 'Your account number is ready' : 'Setting up your account number…')
  } catch (e) { toast(e.message, 'error') } finally { busy.value = false }
}
async function leave() {
  const m = leaving.value
  busy.value = true
  try {
    await api.post('coop.leave_cooperative', { cooperative: m.cooperative })
    state.memberships = state.memberships.filter((x) => x.name !== m.name)
    leaving.value = null
    toast(`You left ${m.cooperative_name}`)
  } catch (e) { toast(e.message, 'error') } finally { busy.value = false }
}
async function logoutEverywhere() {
  busy.value = true
  try {
    await api.post('auth.logout_all_devices')
    logout()
    router.replace('/login')
  } catch (e) {
    // Don't pretend it worked: other devices stay signed in until this succeeds
    toast(`Couldn’t log out other devices: ${e.message}`, 'error')
  } finally { busy.value = false }
}
async function signOut() {
  await endSession()
  router.replace('/login')
}
</script>

<template>
  <div>
    <PageHeader title="Me" />
    <div class="space-y-5 px-5 pb-8">
      <section class="card flex items-center gap-4 p-4">
        <div class="grid h-14 w-14 place-items-center rounded-2xl bg-navy-800 font-display text-xl font-semibold text-glow-300">{{ initials(state.user?.full_name) }}</div>
        <div class="min-w-0 flex-1">
          <p class="truncate font-semibold">{{ state.user?.full_name }}</p>
          <p class="truncate text-sm text-ink-soft">{{ state.user?.mobile_no || state.user?.email }}</p>
        </div>
        <button class="btn-secondary btn-sm" @click="editing = true; error = ''"><Icon name="edit" :size="16" /> Edit</button>
      </section>

      <!-- Money -->
      <section>
        <h2 class="px-1 text-sm font-semibold">Money</h2>
        <div class="card mt-3 divide-soft">
          <RouterLink to="/profile/payout" class="flex items-center gap-3.5 p-4">
            <span class="grid h-10 w-10 place-items-center rounded-2xl bg-accent-soft text-accent-text"><Icon name="bank" :size="18" /></span>
            <span class="min-w-0 flex-1">
              <span class="block text-[15px] font-semibold">Where to send my money</span>
              <span class="block truncate text-xs text-ink-soft">{{ payout?.payout_account_number ? `${payout.payout_bank_name} · ${payout.payout_account_number}` : 'Add your bank account' }}</span>
            </span>
            <Icon name="chevron" :size="18" class="text-ink-faint" />
          </RouterLink>
          <RouterLink v-if="d?.payments?.autosave" to="/autosave" class="flex items-center gap-3.5 p-4">
            <span class="grid h-10 w-10 place-items-center rounded-2xl bg-brand-soft text-brand-text"><Icon name="repeat" :size="18" /></span>
            <span class="flex-1"><span class="block text-[15px] font-semibold">Autosave</span><span class="block text-xs text-ink-soft">{{ d.autosave?.enabled ? 'On' : 'Off' }}</span></span>
            <Icon name="chevron" :size="18" class="text-ink-faint" />
          </RouterLink>
          <button v-if="state.paystack.enabled" class="flex w-full items-center gap-3.5 p-4 text-left" @click="showMethods = true">
            <span class="grid h-10 w-10 place-items-center rounded-2xl bg-info-soft text-info"><Icon name="card" :size="18" /></span>
            <span class="flex-1"><span class="block text-[15px] font-semibold">Saved payment methods</span><span class="block text-xs text-ink-soft">{{ methods.length ? `${methods.length} saved` : 'None yet' }}</span></span>
            <Icon name="chevron" :size="18" class="text-ink-faint" />
          </button>
          <div v-if="dvaAvailable" class="p-4">
            <div class="flex items-center gap-3.5">
              <span class="grid h-10 w-10 place-items-center rounded-2xl bg-pos-soft text-pos"><Icon name="wallet" :size="18" /></span>
              <span class="flex-1">
                <span class="block text-[15px] font-semibold">My savings account number</span>
                <span class="block text-xs text-ink-soft">Transfers into it are saved automatically</span>
              </span>
              <StatusPill v-if="dva?.status && dva.status !== 'Assigned'" :status="dva.status" :label="dva.status === 'Requested' ? 'Setting up' : undefined" />
            </div>
            <div v-if="dva?.status === 'Assigned'" class="mt-3 flex items-center justify-between rounded-2xl bg-sunk p-3">
              <div><p class="money text-xl tracking-wider">{{ dva.account_number }}</p><p class="text-xs text-ink-soft">{{ dva.bank_name }}</p></div>
              <button class="btn-secondary btn-sm" @click="copyText(dva.account_number)"><Icon name="copy" :size="16" /></button>
            </div>
            <p v-else-if="dva?.status === 'Failed'" class="mt-3 text-sm text-neg">{{ dva.error }}</p>
            <button v-if="!dva?.status || dva.status === 'Failed'" class="btn-secondary btn-sm mt-3 w-full" :disabled="busy" @click="requestDva">Get my account number</button>
          </div>
        </div>
      </section>

      <!-- Cooperatives -->
      <section>
        <h2 class="px-1 text-sm font-semibold">Cooperatives</h2>
        <div class="card mt-3 divide-soft">
          <div v-for="m in state.memberships" :key="m.name" class="flex items-center gap-3 p-4">
            <div class="grid h-10 w-10 place-items-center rounded-2xl bg-navy-800 font-display font-semibold text-glow-300">{{ m.cooperative_name[0] }}</div>
            <div class="min-w-0 flex-1">
              <p class="truncate text-[15px] font-semibold">{{ m.cooperative_name }}</p>
              <p class="text-xs text-ink-soft">{{ m.role }}</p>
            </div>
            <StatusPill v-if="m.status !== 'Active'" :status="m.status" />
            <button class="text-xs font-semibold text-ink-faint hover:text-neg" @click="leaving = m">Leave</button>
          </div>
          <RouterLink to="/welcome" class="flex items-center gap-2 p-4 text-sm link"><Icon name="plus" :size="18" /> Join or start a cooperative</RouterLink>
        </div>
      </section>

      <!-- Notifications -->
      <section v-if="pushSupported || needsInstallForPush">
        <h2 class="px-1 text-sm font-semibold">Notifications</h2>
        <div class="card mt-3 flex items-center gap-3.5 p-4">
          <span class="grid h-10 w-10 place-items-center rounded-2xl bg-brand-soft text-brand-text"><Icon name="bell" :size="18" /></span>
          <span class="flex-1">
            <span class="block text-[15px] font-semibold">Notifications on this phone</span>
            <span class="block text-xs text-ink-soft">{{ needsInstallForPush ? 'Add CoopVault to your home screen first' : pushOn ? 'On: payments, loans and reminders' : 'Off' }}</span>
          </span>
          <button v-if="!needsInstallForPush" class="btn-sm" :class="pushOn ? 'btn-secondary' : 'btn-primary'" :disabled="busy" @click="togglePush">{{ pushOn ? 'Turn off' : 'Turn on' }}</button>
        </div>
      </section>

      <!-- Appearance -->
      <section>
        <h2 class="px-1 text-sm font-semibold">Appearance</h2>
        <div class="seg mt-3 grid-cols-3">
          <button v-for="t in [{ k: 'system', l: 'Auto', i: 'monitor' }, { k: 'light', l: 'Light', i: 'sun' }, { k: 'dark', l: 'Dark', i: 'moon' }]" :key="t.k"
            class="flex items-center justify-center gap-1.5" :class="{ on: state.theme === t.k }" @click="setTheme(t.k)">
            <Icon :name="t.i" :size="16" /> {{ t.l }}
          </button>
        </div>
      </section>

      <InstallPrompt persistent />

      <section class="card divide-soft">
        <button class="flex w-full items-center gap-3.5 p-4 text-left" @click="changingPw = true; error = ''">
          <Icon name="lock" class="text-ink-soft" /><span class="flex-1 font-semibold">Change password</span><Icon name="chevron" :size="18" class="text-ink-faint" />
        </button>
        <button class="flex w-full items-center gap-3.5 p-4 text-left" @click="logoutEverywhere">
          <Icon name="shield" class="text-ink-soft" /><span class="flex-1"><span class="block font-semibold">Log out on all devices</span><span class="block text-xs text-ink-soft">If you lost a phone or shared your password</span></span>
        </button>
        <button class="flex w-full items-center gap-3.5 p-4 text-left text-neg" @click="signOut"><Icon name="logout" /><span class="flex-1 font-semibold">Log out</span></button>
      </section>
      <p class="text-center text-xs text-ink-faint">CoopVault · payments secured by Paystack</p>
    </div>

    <Sheet :open="editing" title="Edit profile" @close="editing = false">
      <form class="space-y-4" @submit.prevent="saveProfile">
        <ErrorBox :message="error" />
        <div><label class="label" for="pname">Full name</label><input id="pname" v-model="profile.full_name" class="input" required /></div>
        <div><label class="label" for="pphone">Phone number</label><input id="pphone" v-model="profile.phone" type="tel" class="input" placeholder="0801 234 5678" /></div>
        <button class="btn-primary w-full" :disabled="busy">Save</button>
      </form>
    </Sheet>
    <Sheet :open="changingPw" title="Change password" @close="changingPw = false">
      <form class="space-y-4" @submit.prevent="changePassword">
        <ErrorBox :message="error" />
        <div><label class="label" for="oldpw">Current password</label><input id="oldpw" v-model="pw.old_password" type="password" class="input" autocomplete="current-password" required /></div>
        <div><label class="label" for="newpw">New password</label><input id="newpw" v-model="pw.new_password" type="password" minlength="8" class="input" autocomplete="new-password" required /></div>
        <button class="btn-primary w-full" :disabled="busy">Change password</button>
      </form>
    </Sheet>
    <Sheet :open="showMethods" title="Saved payment methods" subtitle="Stored securely by Paystack. CoopVault never sees your card number." @close="showMethods = false">
      <div v-if="methods.length" class="divide-soft">
        <div v-for="m in methods" :key="m.name" class="flex items-center gap-3 py-3">
          <span class="grid h-10 w-10 place-items-center rounded-2xl bg-sunk"><Icon :name="m.channel === 'card' ? 'card' : 'bank'" :size="18" /></span>
          <div class="flex-1"><p class="font-semibold">{{ m.label }}</p><p v-if="m.exp_month" class="text-xs text-ink-soft">Expires {{ String(m.exp_month).padStart(2, '0') }}/{{ String(m.exp_year).slice(-2) }}</p></div>
          <button class="btn-ghost btn-sm text-neg" @click="removeMethod(m)">Remove</button>
        </div>
      </div>
      <p v-else class="text-sm text-ink-soft">You haven’t saved any. Turn on Autosave when you pay to save a card.</p>
    </Sheet>
    <Sheet :open="!!leaving" :title="`Leave ${leaving?.cooperative_name}?`" subtitle="You need a zero balance first: repay any loan and take out your savings with a withdrawal. Your records stay with the cooperative, and you can ask to join again later." @close="leaving = null">
      <div class="grid grid-cols-2 gap-3">
        <button class="btn-secondary" @click="leaving = null">Stay</button>
        <button class="btn-danger" :disabled="busy" @click="leave">Leave</button>
      </div>
    </Sheet>
  </div>
</template>
