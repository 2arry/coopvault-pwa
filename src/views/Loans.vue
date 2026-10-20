<script setup>
import { ref, onMounted } from 'vue'
import * as api from '../api'
import { current, currency } from '../store'
import { money, date } from '../format'
import PageHeader from '../components/PageHeader.vue'
import StatusPill from '../components/StatusPill.vue'
import Loader from '../components/Loader.vue'
import ErrorBox from '../components/ErrorBox.vue'
import Icon from '../components/Icon.vue'

const loans = ref(null)
const error = ref('')
onMounted(async () => {
  try { loans.value = await api.get('finance.list_loans', { cooperative: current.value.cooperative }) } catch (e) { error.value = e.message }
})
</script>

<template>
  <div>
    <PageHeader title="My loans">
      <template #actions>
        <RouterLink to="/loans/new" class="btn-primary btn-sm"><Icon name="plus" :size="16" /> Borrow</RouterLink>
      </template>
    </PageHeader>
    <div class="px-5 pb-6">
      <ErrorBox :message="error" />
      <Loader v-if="!loans && !error" />
      <div v-else-if="loans && !loans.length" class="card mt-2 p-8 text-center">
        <div class="mx-auto w-fit rounded-full bg-amber-50 p-3 text-amber-700"><Icon name="loans" :size="28" /></div>
        <p class="mt-3 font-semibold">No loans yet</p>
        <p class="mt-1 text-sm text-ink-soft">You can borrow up to what you've contributed to the cooperative.</p>
        <RouterLink to="/loans/new" class="btn-primary mt-4">Check how much I can borrow</RouterLink>
      </div>
      <div v-else class="space-y-3">
        <RouterLink v-for="l in loans" :key="l.name" :to="`/loans/${l.name}`" class="card flex items-center gap-3 p-4">
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-2">
              <p class="num font-bold">{{ money(l.principal, currency) }}</p>
              <StatusPill :status="l.status" />
            </div>
            <p class="mt-0.5 truncate text-xs text-ink-soft">{{ l.purpose || 'Loan' }} · {{ date(l.application_date) }}</p>
          </div>
          <div v-if="l.status === 'Active'" class="text-right">
            <p class="text-xs text-ink-soft">Balance</p>
            <p class="num text-sm font-bold">{{ money(l.balance, currency) }}</p>
          </div>
          <Icon name="chevron" class="text-ink-faint" />
        </RouterLink>
      </div>
    </div>
  </div>
</template>
