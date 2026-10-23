<script setup>
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import * as api from '../api'
import { startSession, loadSession, state, toast } from '../store'
import AuthLayout from '../components/AuthLayout.vue'
import ErrorBox from '../components/ErrorBox.vue'
import Icon from '../components/Icon.vue'

const router = useRouter()
const route = useRoute()
// ?setup=1: first password for an account an officer created (the link in their setup message)
const setup = !!route.query.setup
const login = ref(String(route.query.login || ''))
const code = ref('')
const password = ref('')
const show = ref(false)
const busy = ref(false)
const error = ref('')

function formatCode(e) {
  const raw = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8)
  code.value = raw.length > 4 ? `${raw.slice(0, 4)}-${raw.slice(4)}` : raw
}

async function submit() {
  busy.value = true
  error.value = ''
  try {
    startSession(await api.post('auth.reset_password_with_code', { login: login.value.trim(), code: code.value, new_password: password.value }))
    state.loaded = false
    await loadSession()
    toast(setup ? 'Welcome! Your account is ready.' : 'Password changed. You’re logged in.')
    router.replace('/home')
  } catch (e) {
    error.value = e.message
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <AuthLayout :title="setup ? 'Set up your account' : 'Reset your password'"
    :subtitle="setup ? 'Enter the setup code your cooperative sent you, then choose your own password.' : 'Ask an admin of your cooperative for a reset code. It works once and expires after 30 minutes.'">
    <form class="space-y-4" @submit.prevent="submit">
      <ErrorBox :message="error" />
      <div>
        <label class="label" for="login">{{ setup ? 'Your phone number' : 'Email or phone number' }}</label>
        <input id="login" v-model="login" class="input" autocomplete="username" required />
      </div>
      <div>
        <label class="label" for="code">{{ setup ? 'Setup code' : 'Reset code' }}</label>
        <input id="code" :value="code" class="input money text-center text-2xl tracking-[0.25em]" placeholder="ABCD-1234" autocomplete="one-time-code"
          autocapitalize="characters" required @input="formatCode" />
        <p v-if="!setup" class="hint">Your admin gets it from Manage → Members → your name → Reset password.</p>
      </div>
      <div>
        <label class="label" for="password">{{ setup ? 'Choose a password' : 'New password' }}</label>
        <div class="relative">
          <input id="password" v-model="password" :type="show ? 'text' : 'password'" minlength="8" class="input pr-12" autocomplete="new-password" required />
          <button type="button" class="absolute right-2 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-xl text-ink-faint hover:text-ink" :aria-label="show ? 'Hide password' : 'Show password'" @click="show = !show"><Icon name="eye" :size="18" /></button>
        </div>
      </div>
      <button class="btn-primary w-full" :disabled="busy || code.length < 9">{{ busy ? (setup ? 'Setting up…' : 'Resetting…') : setup ? 'Create my account' : 'Set new password' }}</button>
      <p v-if="setup" class="flex gap-2 text-xs text-ink-soft"><Icon name="lock" :size="16" class="shrink-0" /> Only you know this password. Nobody at the cooperative can see it.</p>
      <p v-else class="flex gap-2 text-xs text-ink-soft"><Icon name="shield" :size="16" class="shrink-0" /> For your safety, payout changes, loans and withdrawals pause for 3 days after a reset.</p>
    </form>
    <template #footer><RouterLink to="/login" class="link">Back to log in</RouterLink></template>
  </AuthLayout>
</template>
