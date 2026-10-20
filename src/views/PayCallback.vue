<script setup>
// Paystack redirects here after checkout with ?reference=...
import { ref, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import * as api from '../api'
import { money } from '../format'
import Icon from '../components/Icon.vue'

const route = useRoute()
const result = ref(null)
const error = ref('')

onMounted(async () => {
  const reference = route.query.reference || route.query.trxref
  if (!reference) return (error.value = 'Missing payment reference.')
  try { result.value = await api.get('payments.verify', { reference }) } catch (e) { error.value = e.message }
})
</script>

<template>
  <div class="flex min-h-screen flex-col items-center justify-center px-6 text-center">
    <template v-if="!result && !error">
      <div class="h-12 w-12 animate-spin rounded-full border-4 border-brand-100 border-t-brand-700" />
      <p class="mt-4 font-semibold">Confirming your payment…</p>
    </template>
    <template v-else-if="result?.status === 'Success'">
      <div class="rounded-full bg-brand-50 p-4 text-brand-700"><Icon name="check" :size="36" :stroke="2.5" /></div>
      <h1 class="mt-4 text-2xl font-extrabold">Payment received</h1>
      <p class="mt-1 text-ink-soft">{{ money(result.amount, result.currency) }} {{ result.purpose === 'Contribution' ? 'added to your savings' : 'paid towards your loan' }}.</p>
      <RouterLink :to="result.loan ? `/loans/${result.loan}` : '/'" class="btn-primary mt-6 w-full max-w-xs">Done</RouterLink>
    </template>
    <template v-else-if="result?.status === 'Initiated'">
      <div class="rounded-full bg-amber-50 p-4 text-amber-700"><Icon name="clock" :size="36" :stroke="2.5" /></div>
      <h1 class="mt-4 text-2xl font-extrabold">Payment processing</h1>
      <p class="mt-1 text-ink-soft">We haven't received confirmation from Paystack yet. It will show in your history once it completes.</p>
      <RouterLink to="/history" class="btn-primary mt-6 w-full max-w-xs">View history</RouterLink>
    </template>
    <template v-else>
      <div class="rounded-full bg-red-50 p-4 text-red-700"><Icon name="x" :size="36" :stroke="2.5" /></div>
      <h1 class="mt-4 text-2xl font-extrabold">Payment not completed</h1>
      <p class="mt-1 text-ink-soft">{{ error || `The payment was ${result.status.toLowerCase()}. You have not been charged.` }}</p>
      <RouterLink to="/" class="btn-primary mt-6 w-full max-w-xs">Back to home</RouterLink>
    </template>
  </div>
</template>
