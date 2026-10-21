<script setup>
import { ref, onMounted } from 'vue'
import * as api from '../../../api'
import { toast } from '../../../store'
import { date, figure, relative } from '../../../format'
import PageHeader from '../../../components/PageHeader.vue'
import Loader from '../../../components/Loader.vue'
import ErrorBox from '../../../components/ErrorBox.vue'
import Sheet from '../../../components/Sheet.vue'
import StatusPill from '../../../components/StatusPill.vue'
import Icon from '../../../components/Icon.vue'

const props = defineProps({ name: String })
const j = ref(null)
const error = ref('')
const busy = ref(false)
const asking = ref(null) // 'reject' | 'reverse'
const note = ref('')

async function load() {
  try { j.value = await api.get('accounts.get_journal', { name: props.name }) } catch (e) { error.value = e.message }
}
onMounted(load)

async function act(method, args = {}, message) {
  busy.value = true
  try {
    j.value = await api.post(method, { name: props.name, ...args })
    asking.value = null
    toast(message)
  } catch (e) { toast(e.message, 'error') } finally { busy.value = false }
}
const SOURCE_LINKS = {
  'Coop Contribution': (n) => `/receipt/Coop Contribution/${n}`,
  'Coop Loan Repayment': (n) => `/receipt/Coop Loan Repayment/${n}`,
  'Coop Loan': (n) => `/loans/${n}`,
  'Coop Withdrawal': (n) => `/withdrawals/${n}`,
  'Coop Share Out': (n) => `/admin/books/share-out/${n}`,
}
</script>

<template>
  <div>
    <PageHeader title="Journal entry" :subtitle="name" back="/admin/books/journals" />
    <div class="space-y-4 px-5 pb-12 pt-1">
      <ErrorBox :message="error" />
      <Loader v-if="!j && !error" />
      <template v-if="j">
        <section class="card p-5">
          <div class="flex items-start justify-between gap-3">
            <div>
              <p class="font-semibold">{{ j.remarks || j.voucher_type }}</p>
              <p class="text-sm text-ink-soft">{{ j.voucher_type }} · {{ date(j.posting_date) }}</p>
            </div>
            <StatusPill :status="j.status" :label="j.status === 'Draft' ? 'To approve' : undefined" />
          </div>
          <div class="mt-4 overflow-x-auto">
            <table class="w-full text-sm">
              <thead><tr class="border-b border-line/10 text-xs text-ink-soft"><th class="py-2 text-left font-semibold">Account</th><th class="py-2 text-right font-semibold">Debit</th><th class="py-2 text-right font-semibold">Credit</th></tr></thead>
              <tbody>
                <tr v-for="(l, i) in j.lines" :key="i" class="border-b border-line/[0.06] align-top">
                  <td class="py-2 pr-2">
                    <span class="block">{{ l.account_name }}</span>
                    <span v-if="l.member_name || l.remarks" class="block text-xs text-ink-soft">{{ [l.member_name, l.remarks].filter(Boolean).join(' · ') }}</span>
                  </td>
                  <td class="num py-2 text-right tabular-nums">{{ figure(l.debit) }}</td>
                  <td class="num py-2 pl-3 text-right tabular-nums">{{ figure(l.credit) }}</td>
                </tr>
                <tr class="font-semibold"><td class="py-2">Total</td><td class="py-2 text-right tabular-nums">{{ figure(j.total_debit) }}</td><td class="py-2 pl-3 text-right tabular-nums">{{ figure(j.total_debit) }}</td></tr>
              </tbody>
            </table>
          </div>
        </section>

        <section class="card divide-soft text-sm">
          <div class="flex justify-between p-4"><span class="text-ink-soft">Prepared by</span><span>{{ j.prepared_by_name || 'System' }}</span></div>
          <div v-if="j.approved_by" class="flex justify-between p-4"><span class="text-ink-soft">{{ j.status === 'Rejected' ? 'Rejected by' : 'Approved by' }}</span><span>{{ j.approved_by_name }} · {{ relative(j.approved_on) }}</span></div>
          <div v-if="j.reference_name" class="flex justify-between p-4">
            <span class="text-ink-soft">From</span>
            <RouterLink v-if="SOURCE_LINKS[j.reference_doctype]" :to="SOURCE_LINKS[j.reference_doctype](j.reference_name)" class="link num">{{ j.reference_name }}</RouterLink>
            <span v-else class="num">{{ j.reference_name }}</span>
          </div>
          <div v-if="j.reverses" class="flex justify-between p-4"><span class="text-ink-soft">Reverses</span><RouterLink :to="`/admin/books/journal/${j.reverses}`" class="link num">{{ j.reverses }}</RouterLink></div>
          <div v-if="j.reversed_by" class="p-4">
            <div class="flex justify-between"><span class="text-ink-soft">Reversed by</span><RouterLink :to="`/admin/books/journal/${j.reversed_by}`" class="link num">{{ j.reversed_by }}</RouterLink></div>
            <p v-if="j.reversal_reason" class="mt-1 text-ink-soft">“{{ j.reversal_reason }}”</p>
          </div>
          <div v-else-if="j.status === 'Rejected' && j.reversal_reason" class="p-4 text-ink-soft">“{{ j.reversal_reason }}”</div>
        </section>

        <div v-if="j.status === 'Draft'" class="grid grid-cols-2 gap-2">
          <button class="btn-secondary" :disabled="busy" @click="asking = 'reject'; note = ''">Reject</button>
          <button class="btn-primary" :disabled="busy || !j.can_approve" @click="act('accounts.approve_journal', {}, 'Approved and posted')">Approve</button>
          <p v-if="!j.can_approve" class="col-span-2 flex gap-2 text-xs text-ink-soft"><Icon name="info" :size="14" class="mt-0.5" /> You prepared this, so another staff member has to approve it.</p>
        </div>
        <button v-if="j.status === 'Posted' && j.voucher_type === 'Manual Journal'" class="btn-ghost w-full text-neg" @click="asking = 'reverse'; note = ''">Reverse this entry</button>
      </template>
    </div>

    <Sheet :open="!!asking" :title="asking === 'reverse' ? 'Reverse this entry?' : 'Reject this entry?'"
      :subtitle="asking === 'reverse' ? 'An opposite entry is posted today, linked to this one. Nothing is deleted.' : 'It won’t be posted. The person who prepared it is told why.'" @close="asking = null">
      <form class="space-y-4" @submit.prevent="asking === 'reverse' ? act('accounts.reverse_journal', { reason: note }, 'Reversed') : act('accounts.reject_journal', { note }, 'Rejected')">
        <textarea v-model="note" rows="3" class="input" :placeholder="asking === 'reverse' ? 'Why it’s being reversed' : 'What needs fixing'" :required="asking === 'reverse'" />
        <button class="btn-danger w-full" :disabled="busy">{{ asking === 'reverse' ? 'Reverse' : 'Reject' }}</button>
      </form>
    </Sheet>
  </div>
</template>
