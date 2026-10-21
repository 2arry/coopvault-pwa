<script setup>
// Paystack's hosted page redirects here (?reference=...) when the in-app popup couldn't be used.
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import * as api from '../api'
import { receiptPath } from '../payments'
import Icon from '../components/Icon.vue'

const route = useRoute()
const router = useRouter()
const result = ref(null)
const error = ref('')

onMounted(async () => {
  const reference = route.query.reference || route.query.trxref
  if (!reference) return (error.value = 'This payment link is missing its reference.')
  try {
    if (route.query.cancelled) await api.post('payments.mark_abandoned', { reference }).catch(() => {})
    result.value = await api.post('payments.verify', { reference })
    if (result.value.status === 'Success') router.replace(receiptPath(result.value))
  } catch (e) { error.value = e.message }
})
</script>

<template>
  <div class="flex min-h-screen flex-col items-center justify-center px-6 text-center">
    <template v-if="!result && !error">
      <div class="h-12 w-12 animate-spin rounded-full border-4 border-brand-soft border-t-brand-text" />
      <p class="mt-5 font-semibold">Confirming your payment…</p>
      <p class="mt-1 text-sm text-ink-soft">This only takes a moment.</p>
    </template>
    <template v-else-if="result && ['Initiated', 'Pending'].includes(result.status) && !route.query.cancelled">
      <div class="grid h-20 w-20 place-items-center rounded-full bg-warn-soft text-warn"><Icon name="clock" :size="36" :stroke="2.5" /></div>
      <h1 class="mt-5 font-display text-3xl font-semibold">Still processing</h1>
      <p class="mt-2 max-w-sm text-ink-soft">Paystack hasn’t confirmed this payment yet. It will appear in your activity as soon as it does. There’s no need to pay again.</p>
      <RouterLink to="/activity" class="btn-primary mt-8 w-full max-w-xs">View activity</RouterLink>
    </template>
    <template v-else-if="result?.status !== 'Success'">
      <div class="grid h-20 w-20 place-items-center rounded-full bg-neg-soft text-neg"><Icon name="x" :size="36" :stroke="2.5" /></div>
      <h1 class="mt-5 font-display text-3xl font-semibold">Payment not completed</h1>
      <p class="mt-2 max-w-sm text-ink-soft">{{ error || result?.message || 'The payment was cancelled or declined. You have not been charged.' }}</p>
      <RouterLink to="/home" class="btn-primary mt-8 w-full max-w-xs">Back to home</RouterLink>
    </template>
  </div>
</template>
