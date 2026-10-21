<script setup>
import { reactive, ref, computed } from 'vue'
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
const joining = computed(() => !!code || route.query.intent === 'join')
const form = reactive({ full_name: '', email: '', phone: '', password: '' })
const show = ref(false)
const busy = ref(false)
const error = ref('')

async function submit() {
  busy.value = true
  error.value = ''
  try {
    startSession(await api.post('auth.signup', { ...form, email: form.email.trim() }))
    state.loaded = false
    await loadSession()
    router.replace({ path: '/welcome', query: joining.value && !code ? { mode: 'join' } : {} })
  } catch (e) {
    error.value = e.message
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <AuthLayout :title="joining ? 'Join your cooperative' : 'Create your account'"
    :subtitle="joining ? 'Create an account and your admin will approve you.' : 'Start a cooperative or join one. It takes a minute.'">
    <template #banner><InviteBanner v-if="code" :code="code" /></template>
    <form class="space-y-4" @submit.prevent="submit">
      <ErrorBox :message="error" />
      <div>
        <label class="label" for="name">Full name</label>
        <input id="name" v-model="form.full_name" class="input" autocomplete="name" required placeholder="As your group knows you" />
      </div>
      <div>
        <label class="label" for="phone">Phone number</label>
        <input id="phone" v-model="form.phone" type="tel" class="input" autocomplete="tel" placeholder="0801 234 5678" />
        <p class="hint">Used to log in and for reminders from your treasurer.</p>
      </div>
      <div>
        <label class="label" for="email">Email</label>
        <input id="email" v-model="form.email" type="email" class="input" autocomplete="email" required placeholder="For receipts and password resets" />
      </div>
      <div>
        <label class="label" for="password">Password</label>
        <div class="relative">
          <input id="password" v-model="form.password" :type="show ? 'text' : 'password'" minlength="8" class="input pr-12" autocomplete="new-password" required />
          <button type="button" class="absolute right-2 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-xl text-ink-faint hover:text-ink" :aria-label="show ? 'Hide password' : 'Show password'" @click="show = !show"><Icon name="eye" :size="18" /></button>
        </div>
        <p class="hint">At least 8 characters.</p>
      </div>
      <button class="btn-primary w-full" :disabled="busy">{{ busy ? 'Creating account…' : joining ? 'Create account and join' : 'Create account' }}</button>
    </form>
    <template #footer>
      Already have an account? <RouterLink to="/login" class="link">Log in</RouterLink>
    </template>
  </AuthLayout>
</template>
