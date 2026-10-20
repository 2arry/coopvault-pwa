<script setup>
import { ref, computed, onMounted } from 'vue'
import * as api from '../../api'
import { current, currency } from '../../store'
import { money, initials } from '../../format'
import Loader from '../../components/Loader.vue'
import ErrorBox from '../../components/ErrorBox.vue'
import StatusPill from '../../components/StatusPill.vue'
import Icon from '../../components/Icon.vue'

const members = ref(null)
const error = ref('')
const q = ref('')
const shown = computed(() => (members.value || []).filter((m) =>
  !q.value || `${m.full_name} ${m.user} ${m.phone || ''}`.toLowerCase().includes(q.value.toLowerCase())))
const totals = computed(() => (members.value || []).reduce((t, m) => ({
  saved: t.saved + (m.total_contributed || 0), owed: t.owed + (m.loan_outstanding || 0),
}), { saved: 0, owed: 0 }))

onMounted(async () => {
  try { members.value = await api.get('coop.list_members', { cooperative: current.value.cooperative }) } catch (e) { error.value = e.message }
})
</script>

<template>
  <div class="space-y-4">
    <ErrorBox :message="error" />
    <Loader v-if="!members && !error" />
    <template v-if="members">
      <div class="grid grid-cols-2 gap-3">
        <div class="card p-3"><p class="text-xs text-ink-soft">Total saved</p><p class="num font-bold">{{ money(totals.saved, currency) }}</p></div>
        <div class="card p-3"><p class="text-xs text-ink-soft">Owed to pool</p><p class="num font-bold">{{ money(totals.owed, currency) }}</p></div>
      </div>
      <input v-model="q" class="input" placeholder="Search members" type="search" />
      <div class="card divide-y divide-black/5">
        <RouterLink v-for="m in shown" :key="m.name" :to="`/admin/members/${m.name}`" class="flex items-center gap-3 p-3.5">
          <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-100 text-sm font-bold text-brand-800">{{ initials(m.full_name) }}</div>
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-1.5">
              <p class="truncate text-sm font-semibold">{{ m.full_name }}</p>
              <span v-if="m.role !== 'Member'" class="rounded bg-black/5 px-1.5 text-[10px] font-bold text-ink-soft">{{ m.role }}</span>
            </div>
            <p class="num text-xs text-ink-soft">Saved {{ money(m.total_contributed, currency) }}<span v-if="m.loan_outstanding"> · Owes {{ money(m.loan_outstanding, currency) }}</span></p>
          </div>
          <StatusPill v-if="m.status !== 'Active'" :status="m.status" />
          <Icon name="chevron" class="text-ink-faint" :size="18" />
        </RouterLink>
        <p v-if="!shown.length" class="p-6 text-center text-sm text-ink-soft">No members found.</p>
      </div>
    </template>
  </div>
</template>
