<script setup>
import { ref } from 'vue'
import * as api from '../api'
import AuthLayout from '../components/AuthLayout.vue'
import ErrorBox from '../components/ErrorBox.vue'

const email = ref('')
const sent = ref(false)
const busy = ref(false)
const error = ref('')

async function submit() {
  busy.value = true
  error.value = ''
  try {
    await api.post('auth.forgot_password', { email: email.value.trim() })
    sent.value = true
  } catch (e) {
    error.value = e.message
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <AuthLayout title="Reset password" subtitle="We'll email you a link to set a new password.">
    <div v-if="sent" class="card p-5 text-sm">
      If an account exists for <b>{{ email }}</b>, a reset link is on its way. If it doesn't arrive, ask your cooperative admin for help.
    </div>
    <form v-else class="space-y-4" @submit.prevent="submit">
      <ErrorBox :message="error" />
      <div>
        <label class="label" for="email">Email</label>
        <input id="email" v-model="email" type="email" class="input" required />
      </div>
      <button class="btn-primary w-full" :disabled="busy">Send reset link</button>
    </form>
    <template #footer><RouterLink to="/login" class="font-semibold text-brand-700">Back to log in</RouterLink></template>
  </AuthLayout>
</template>
