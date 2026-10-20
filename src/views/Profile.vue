<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import * as api from '../api'
import { state, logout, toast } from '../store'
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
const profile = ref({ full_name: state.user?.full_name, phone: state.user?.mobile_no || '' })
const pw = ref({ old_password: '', new_password: '' })
const error = ref('')
const busy = ref(false)

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
async function leave(m) {
  try {
    await api.post('coop.leave_cooperative', { cooperative: m.cooperative })
    state.memberships = state.memberships.filter((x) => x.name !== m.name)
    toast(`You left ${m.cooperative_name}`)
  } catch (e) { toast(e.message, 'error') }
}
function signOut() {
  logout()
  router.replace('/login')
}
</script>

<template>
  <div>
    <PageHeader title="Me" />
    <div class="space-y-5 px-5 pb-8">
      <section class="card flex items-center gap-4 p-4">
        <div class="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-800 text-lg font-bold text-white">{{ initials(state.user?.full_name) }}</div>
        <div class="min-w-0 flex-1">
          <p class="truncate font-bold">{{ state.user?.full_name }}</p>
          <p class="truncate text-sm text-ink-soft">{{ state.user?.email }}</p>
          <p v-if="state.user?.mobile_no" class="text-sm text-ink-soft">{{ state.user.mobile_no }}</p>
        </div>
        <button class="btn-secondary btn-sm" @click="editing = true; error = ''">Edit</button>
      </section>

      <InstallPrompt />

      <section>
        <h2 class="section-title">Cooperatives</h2>
        <div class="card mt-3 divide-y divide-black/5">
          <div v-for="m in state.memberships" :key="m.name" class="flex items-center gap-3 p-4">
            <div class="min-w-0 flex-1">
              <p class="truncate font-semibold">{{ m.cooperative_name }}</p>
              <p class="text-xs text-ink-soft">{{ m.role }}</p>
            </div>
            <StatusPill :status="m.status" />
            <button class="text-xs font-semibold text-red-700" @click="leave(m)">Leave</button>
          </div>
          <RouterLink to="/welcome" class="flex items-center gap-2 p-4 text-sm font-semibold text-brand-700"><Icon name="plus" :size="18" /> Join or create a cooperative</RouterLink>
        </div>
      </section>

      <section class="card divide-y divide-black/5">
        <button class="flex w-full items-center gap-3 p-4 text-left" @click="changingPw = true; error = ''"><Icon name="settings" class="text-ink-soft" /><span class="flex-1 font-semibold">Change password</span><Icon name="chevron" class="text-ink-faint" /></button>
        <button class="flex w-full items-center gap-3 p-4 text-left text-red-700" @click="signOut"><Icon name="logout" /><span class="flex-1 font-semibold">Log out</span></button>
      </section>
      <p class="text-center text-xs text-ink-faint">CoopVault v0.1</p>
    </div>

    <Sheet :open="editing" title="Edit profile" @close="editing = false">
      <form class="space-y-4" @submit.prevent="saveProfile">
        <ErrorBox :message="error" />
        <div><label class="label">Full name</label><input v-model="profile.full_name" class="input" required /></div>
        <div><label class="label">Phone</label><input v-model="profile.phone" type="tel" class="input" /></div>
        <button class="btn-primary w-full" :disabled="busy">Save</button>
      </form>
    </Sheet>
    <Sheet :open="changingPw" title="Change password" @close="changingPw = false">
      <form class="space-y-4" @submit.prevent="changePassword">
        <ErrorBox :message="error" />
        <div><label class="label">Current password</label><input v-model="pw.old_password" type="password" class="input" autocomplete="current-password" required /></div>
        <div><label class="label">New password</label><input v-model="pw.new_password" type="password" minlength="8" class="input" autocomplete="new-password" required /></div>
        <button class="btn-primary w-full" :disabled="busy">Change password</button>
      </form>
    </Sheet>
  </div>
</template>
