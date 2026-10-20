<script setup>
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import * as api from '../api'
import { startSession, loadSession, state } from '../store'
import AuthLayout from '../components/AuthLayout.vue'
import ErrorBox from '../components/ErrorBox.vue'

const route = useRoute()
const router = useRouter()
const email = ref('')
const password = ref('')
const busy = ref(false)
const error = ref(route.query.expired ? 'Your session has ended. Please log in again.' : '')

async function submit() {
  busy.value = true
  error.value = ''
  try {
    startSession(await api.post('auth.login', { email: email.value.trim(), password: password.value }))
    state.loaded = false
    await loadSession()
    router.replace(route.query.next || '/')
  } catch (e) {
    error.value = e.message
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <AuthLayout title="Welcome back" subtitle="Your savings, contributions and loans in one place.">
    <form class="space-y-4" @submit.prevent="submit">
      <ErrorBox :message="error" />
      <div>
        <label class="label" for="email">Email or phone</label>
        <input id="email" v-model="email" class="input" autocomplete="username" required placeholder="you@example.com" />
      </div>
      <div>
        <div class="flex items-baseline justify-between">
          <label class="label" for="password">Password</label>
          <RouterLink to="/forgot" class="text-sm font-semibold text-brand-700">Forgot?</RouterLink>
        </div>
        <input id="password" v-model="password" type="password" class="input" autocomplete="current-password" required />
      </div>
      <button class="btn-primary w-full" :disabled="busy">{{ busy ? 'Logging in…' : 'Log in' }}</button>
    </form>
    <template #footer>
      New here? <RouterLink to="/signup" class="font-semibold text-brand-700">Create an account</RouterLink>
    </template>
  </AuthLayout>
</template>
