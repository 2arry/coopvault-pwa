<script setup>
// "Did it arrive?" for money the treasurer sent (a loan or a withdrawal).
import { ref, computed } from 'vue'
import * as api from '../api'
import { currency, toast } from '../store'
import { money, date } from '../format'
import Sheet from './Sheet.vue'
import Icon from './Icon.vue'

const props = defineProps({ kind: { type: String, required: true }, doc: { type: Object, required: true } }) // kind: loan | withdrawal
const emit = defineEmits(['done'])
const busy = ref(false)
const reporting = ref(false)
const note = ref('')
const amount = computed(() => props.doc.principal ?? props.doc.amount)
const sentOn = computed(() => props.doc.disbursed_on || props.doc.sent_on)
const ep = computed(() => (props.kind === 'loan'
  ? { yes: 'finance.confirm_loan_received', no: 'finance.report_loan_not_received' }
  : { yes: 'finance.confirm_withdrawal_received', no: 'finance.report_withdrawal_not_received' }))

async function yes() {
  busy.value = true
  try {
    emit('done', await api.post(ep.value.yes, { name: props.doc.name }))
    toast(props.kind === 'loan' ? 'Thanks! Your repayment plan starts today.' : 'Thanks for confirming')
  } catch (e) { toast(e.message, 'error') } finally { busy.value = false }
}
async function no() {
  busy.value = true
  try {
    emit('done', await api.post(ep.value.no, { name: props.doc.name, note: note.value }))
    reporting.value = false
    toast('The treasurer has been told. They’ll check the transfer.')
  } catch (e) { toast(e.message, 'error') } finally { busy.value = false }
}
</script>

<template>
  <section class="rounded-3xl border p-5" :class="doc.receipt_disputed ? 'border-warn/30 bg-warn-soft' : 'border-brand-text/25 bg-brand-soft/60'">
    <template v-if="!doc.receipt_disputed">
      <p class="text-[15px] font-semibold">Did {{ money(amount, currency) }} arrive?</p>
      <p class="mt-1 text-sm text-ink-soft">
        Sent to {{ doc.payout_bank_name }} ••{{ String(doc.payout_account_number || '').slice(-4) }}<span v-if="sentOn"> on {{ date(sentOn) }}</span>.
        Reference <b class="num text-ink">{{ doc.transfer_reference }}</b>.
      </p>
      <p v-if="kind === 'loan'" class="mt-2 text-xs text-ink-soft">Your repayment plan starts the day you confirm.</p>
      <div class="mt-4 grid grid-cols-2 gap-2">
        <button class="btn-secondary btn-sm" :disabled="busy" @click="reporting = true">It hasn’t arrived</button>
        <button class="btn-primary btn-sm" :disabled="busy" @click="yes">Yes, it arrived</button>
      </div>
      <p class="mt-3 text-xs text-ink-faint">If you don’t answer within {{ doc.confirm_after_days || 7 }} days, we’ll treat it as received.</p>
    </template>
    <template v-else>
      <p class="flex items-center gap-2 text-[15px] font-semibold text-warn"><Icon name="alert" :size="18" /> You said it hasn’t arrived</p>
      <p class="mt-1 text-sm text-ink-soft">The treasurer has been told and will check the transfer (reference {{ doc.transfer_reference }}).</p>
      <button class="btn-primary btn-sm mt-4 w-full" :disabled="busy" @click="yes">It’s arrived now</button>
    </template>
  </section>
  <Sheet :open="reporting" title="Tell the treasurer it hasn’t arrived" subtitle="Bank transfers can take a while. If it’s been more than a day, let them know." @close="reporting = false">
    <form class="space-y-4" @submit.prevent="no">
      <textarea v-model="note" rows="3" class="input" placeholder="e.g. Nothing in my GTBank account since Monday" />
      <button class="btn-primary w-full" :disabled="busy">Tell the treasurer</button>
    </form>
  </Sheet>
</template>
