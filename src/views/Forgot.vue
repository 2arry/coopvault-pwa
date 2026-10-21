<script setup>
import { ref } from 'vue'
import * as api from '../api'
import AuthLayout from '../components/AuthLayout.vue'
import ErrorBox from '../components/ErrorBox.vue'
import Icon from '../components/Icon.vue'

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
  <AuthLayout title="Reset your password" subtitle="We’ll email you a link to choose a new one.">
    <div v-if="sent" class="card flex gap-3 p-5 text-sm">
      <Icon name="checkCircle" class="text-pos" />
      <p>If there’s an account for <b>{{ email }}</b>, a reset link is on its way. Nothing after a few minutes? Your cooperative admin can help.</p>
    </div>
    <form v-else class="space-y-4" @submit.prevent="submit">
      <ErrorBox :message="error" />
      <div>
        <label class="label" for="email">Email</label>
        <input id="email" v-model="email" type="email" class="input" autocomplete="email" required />
      </div>
      <button class="btn-primary w-full" :disabled="busy">{{ busy ? 'Sending…' : 'Send reset link' }}</button>
    </form>
    <template #footer><RouterLink to="/login" class="link">Back to log in</RouterLink></template>
  </AuthLayout>
</template>
