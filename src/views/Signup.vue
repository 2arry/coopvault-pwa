<script setup>
import { reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import * as api from '../api'
import { startSession, loadSession, state } from '../store'
import AuthLayout from '../components/AuthLayout.vue'
import ErrorBox from '../components/ErrorBox.vue'

const router = useRouter()
const form = reactive({ full_name: '', email: '', phone: '', password: '' })
const busy = ref(false)
const error = ref('')

async function submit() {
  busy.value = true
  error.value = ''
  try {
    startSession(await api.post('auth.signup', { ...form, email: form.email.trim() }))
    state.loaded = false
    await loadSession()
    router.replace('/welcome')
  } catch (e) {
    error.value = e.message
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <AuthLayout title="Create your account" subtitle="Join your cooperative and keep track of every naira.">
    <form class="space-y-4" @submit.prevent="submit">
      <ErrorBox :message="error" />
      <div>
        <label class="label" for="name">Full name</label>
        <input id="name" v-model="form.full_name" class="input" autocomplete="name" required />
      </div>
      <div>
        <label class="label" for="email">Email</label>
        <input id="email" v-model="form.email" type="email" class="input" autocomplete="email" required />
      </div>
      <div>
        <label class="label" for="phone">Phone <span class="font-normal text-ink-faint">(optional)</span></label>
        <input id="phone" v-model="form.phone" type="tel" class="input" autocomplete="tel" placeholder="08012345678" />
      </div>
      <div>
        <label class="label" for="password">Password</label>
        <input id="password" v-model="form.password" type="password" minlength="8" class="input" autocomplete="new-password" required />
        <p class="hint">At least 8 characters.</p>
      </div>
      <button class="btn-primary w-full" :disabled="busy">{{ busy ? 'Creating account…' : 'Create account' }}</button>
    </form>
    <template #footer>
      Already have an account? <RouterLink to="/login" class="font-semibold text-brand-700">Log in</RouterLink>
    </template>
  </AuthLayout>
</template>
