<script setup>
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import * as api from '../api'
import { startSession, loadSession, state } from '../store'
import { pendingJoinCode } from '../router'
import AuthLayout from '../components/AuthLayout.vue'
import InviteBanner from '../components/InviteBanner.vue'
import ErrorBox from '../components/ErrorBox.vue'
import Icon from '../components/Icon.vue'

const route = useRoute()
const router = useRouter()
const code = pendingJoinCode()
const login = ref('')
const password = ref('')
const show = ref(false)
const busy = ref(false)
const error = ref(route.query.expired ? 'Your session ended. Please log in again.' : '')

async function submit() {
  busy.value = true
  error.value = ''
  try {
    startSession(await api.post('auth.login', { email: login.value.trim(), password: password.value }))
    state.loaded = false
    await loadSession()
    router.replace(code ? '/welcome' : route.query.next || '/home')
  } catch (e) {
    error.value = e.message
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <AuthLayout title="Welcome back" subtitle="Log in to see your savings, loans and what’s due.">
    <template #banner><InviteBanner v-if="code" :code="code" /></template>
    <form class="space-y-4" @submit.prevent="submit">
      <ErrorBox :message="error" />
      <div>
        <label class="label" for="login">Email or phone number</label>
        <input id="login" v-model="login" class="input" autocomplete="username" required placeholder="you@example.com or 0801…" />
      </div>
      <div>
        <div class="flex items-baseline justify-between">
          <label class="label" for="password">Password</label>
          <RouterLink to="/forgot" class="text-sm link">Forgot it?</RouterLink>
        </div>
        <div class="relative">
          <input id="password" v-model="password" :type="show ? 'text' : 'password'" class="input pr-12" autocomplete="current-password" required />
          <button type="button" class="absolute right-2 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-xl text-ink-faint hover:text-ink" :aria-label="show ? 'Hide password' : 'Show password'" @click="show = !show"><Icon name="eye" :size="18" /></button>
        </div>
      </div>
      <button class="btn-primary w-full" :disabled="busy">{{ busy ? 'Logging in…' : 'Log in' }}</button>
    </form>
    <template #footer>
      New to CoopVault? <RouterLink to="/signup" class="link">Create an account</RouterLink>
    </template>
  </AuthLayout>
</template>
