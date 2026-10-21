<script setup>
import { ref, computed, onMounted } from 'vue'
import * as api from '../api'
import { current } from '../store'
import { money, date } from '../format'
import PageHeader from '../components/PageHeader.vue'
import Loader from '../components/Loader.vue'
import ErrorBox from '../components/ErrorBox.vue'
import Icon from '../components/Icon.vue'

const props = defineProps({ name: String })
const so = ref(null)
const error = ref('')
onMounted(async () => {
  try { so.value = await api.get('accounts.get_share_out', { name: props.name }) } catch (e) { error.value = e.message }
})
const mine = computed(() => so.value?.lines?.find((l) => l.member === current.value?.name))
const basis = computed(() => ({ 'Average savings': 'your average savings over the year', 'Savings at year end': 'what you had saved at the end of the year', 'Interest paid': 'the interest you paid on loans' }[so.value?.basis]))
</script>

<template>
  <div>
    <PageHeader title="Share-out" :subtitle="current?.cooperative_name" back="/home" />
    <div class="space-y-4 px-5 pb-12 pt-1">
      <ErrorBox :message="error" />
      <Loader v-if="!so && !error" />
      <template v-if="so">
        <section class="relative overflow-hidden rounded-4xl bg-navy-800 p-6 text-white shadow-lift">
          <p class="text-sm text-navy-100/80">Your share, added to your savings</p>
          <p class="money mt-1 text-[40px] leading-tight">{{ money(mine?.share_amount || 0, so.currency) }}</p>
          <p class="mt-2 text-sm text-navy-100/80">For {{ date(so.period_start) }} – {{ date(so.period_end) }}, in proportion to {{ basis }}.</p>
        </section>
        <section class="card divide-soft px-5 text-sm">
          <div class="flex justify-between py-3"><span class="text-ink-soft">The group’s surplus</span><span class="num">{{ money(so.surplus, so.currency) }}</span></div>
          <div class="flex justify-between py-3"><span class="text-ink-soft">Set aside in the reserve fund ({{ so.reserve_percent }}%)</span><span class="num">{{ money(so.reserve_amount, so.currency) }}</span></div>
          <div class="flex justify-between py-3"><span class="text-ink-soft">Kept for the group</span><span class="num">{{ money(so.retained, so.currency) }}</span></div>
          <div class="flex justify-between py-3 font-semibold"><span>Shared among members</span><span class="num">{{ money(so.to_members, so.currency) }}</span></div>
        </section>
        <p class="flex gap-2 text-xs text-ink-soft"><Icon name="info" :size="14" class="mt-0.5 shrink-0" /> The surplus is mostly interest members paid on loans, less costs like payment fees. Approved by {{ so.approved_by_name || 'your admins' }}.</p>
      </template>
    </div>
  </div>
</template>
