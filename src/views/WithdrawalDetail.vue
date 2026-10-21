<script setup>
import { ref, computed, onMounted } from 'vue'
import * as api from '../api'
import { currency, toast, loadDashboard } from '../store'
import { money, date } from '../format'
import PageHeader from '../components/PageHeader.vue'
import StatusPill from '../components/StatusPill.vue'
import TransferConfirm from '../components/TransferConfirm.vue'
import Loader from '../components/Loader.vue'
import ErrorBox from '../components/ErrorBox.vue'
import Sheet from '../components/Sheet.vue'
import Icon from '../components/Icon.vue'

const props = defineProps({ name: String })
const w = ref(null)
const error = ref('')
const busy = ref(false)
const confirmCancel = ref(false)
const steps = computed(() => {
  const x = w.value
  if (!x) return []
  return [
    { label: 'Requested', done: true, when: x.requested_on },
    { label: x.status === 'Rejected' ? 'Declined' : 'Sent by the treasurer', done: ['Sent', 'Completed', 'Rejected'].includes(x.status), when: x.sent_on, bad: x.status === 'Rejected' },
    { label: 'Arrived in your account', done: x.status === 'Completed', when: x.received_on },
  ]
})

async function load() {
  try { w.value = await api.get('finance.get_withdrawal', { name: props.name }) } catch (e) { error.value = e.message }
}
async function cancel() {
  busy.value = true
  try {
    await api.post('finance.cancel_withdrawal', { name: props.name })
    toast('Withdrawal request cancelled')
    confirmCancel.value = false
    loadDashboard().catch(() => {})
    await load()
  } catch (e) { toast(e.message, 'error') } finally { busy.value = false }
}
async function confirmed(updated) {
  w.value = updated
  loadDashboard().catch(() => {})
}
onMounted(load)
</script>

<template>
  <div>
    <PageHeader title="Withdrawal" :subtitle="name" back="/activity" />
    <div class="space-y-4 px-5 pb-12 pt-1">
      <ErrorBox :message="error" />
      <Loader v-if="!w && !error" />
      <template v-if="w">
        <section class="card p-5">
          <div class="flex items-center justify-between">
            <p class="text-sm text-ink-soft">{{ w.member_name }}</p>
            <StatusPill :status="w.status" />
          </div>
          <p class="money mt-1 text-[40px] leading-tight">{{ money(w.amount, currency) }}</p>
          <p v-if="w.reason" class="text-sm text-ink-soft">{{ w.reason }}</p>
          <ol class="mt-5 space-y-3">
            <li v-for="s in steps" :key="s.label" class="flex items-center gap-3 text-sm">
              <span class="grid h-6 w-6 place-items-center rounded-full" :class="s.bad ? 'bg-neg text-white' : s.done ? 'bg-pos text-white' : 'border-2 border-line/20'">
                <Icon v-if="s.done" :name="s.bad ? 'x' : 'check'" :size="13" :stroke="3" />
              </span>
              <span class="flex-1" :class="s.done ? '' : 'text-ink-faint'">{{ s.label }}</span>
              <span class="text-xs text-ink-faint">{{ s.when ? date(s.when, { day: 'numeric', month: 'short' }) : '' }}</span>
            </li>
          </ol>
          <button v-if="w.status === 'Pending' && w.is_mine" class="btn-ghost mt-4 w-full text-neg" @click="confirmCancel = true">Cancel request</button>
        </section>

        <TransferConfirm v-if="w.status === 'Sent' && w.is_mine" kind="withdrawal" :doc="w" @done="confirmed" />

        <section v-if="w.transfer_reference || w.payout_account_number" class="card divide-soft px-5 text-sm">
          <div v-if="w.payout_account_number" class="flex justify-between gap-4 py-3"><span class="text-ink-soft">Sent to</span><span class="text-right">{{ w.payout_bank_name }} · {{ w.payout_account_number }}<br /><span class="text-xs text-ink-soft">{{ w.payout_account_name }}</span></span></div>
          <div v-if="w.transfer_reference" class="flex justify-between gap-4 py-3"><span class="text-ink-soft">Transfer reference</span><span class="num">{{ w.transfer_reference }}</span></div>
          <div v-if="w.review_note" class="py-3"><p class="text-ink-soft">Note from the treasurer</p><p class="mt-0.5">{{ w.review_note }}</p></div>
        </section>
      </template>
    </div>
    <Sheet :open="confirmCancel" title="Cancel this withdrawal?" @close="confirmCancel = false">
      <div class="grid grid-cols-2 gap-3">
        <button class="btn-secondary" @click="confirmCancel = false">Keep it</button>
        <button class="btn-danger" :disabled="busy" @click="cancel">Cancel request</button>
      </div>
    </Sheet>
  </div>
</template>
