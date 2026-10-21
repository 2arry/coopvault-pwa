<script setup>
import { ref, onMounted } from 'vue'
import * as api from '../../../api'
import { current } from '../../../store'
import { date, figure } from '../../../format'
import PageHeader from '../../../components/PageHeader.vue'
import Loader from '../../../components/Loader.vue'
import ErrorBox from '../../../components/ErrorBox.vue'
import Icon from '../../../components/Icon.vue'

const props = defineProps({ account: String })
const r = ref(null)
const error = ref('')
const from = ref('')
const to = ref('')

async function load() {
  error.value = ''
  try {
    r.value = await api.get('accounts.general_ledger', { cooperative: current.value.cooperative, account: props.account,
      ...(from.value ? { from_date: from.value } : {}), ...(to.value ? { to_date: to.value } : {}) })
    from.value = String(r.value.from_date).slice(0, 10)
    to.value = String(r.value.to_date).slice(0, 10)
  } catch (e) { error.value = e.message }
}
onMounted(load)
const print = () => window.print()
</script>

<template>
  <div>
    <PageHeader :title="r?.account.account_name || 'Account'" :subtitle="r ? `${r.account.account_code} · ${r.account.root_type}` : ''" back="/admin/books/accounts" class="no-print">
      <template #actions><button v-if="r" class="btn-secondary btn-sm" @click="print"><Icon name="download" :size="16" /> PDF</button></template>
    </PageHeader>
    <div class="space-y-4 px-5 pb-12 pt-1">
      <form class="no-print grid grid-cols-[1fr_1fr_auto] gap-2" @submit.prevent="load">
        <div><label class="label text-xs" for="l-from">From</label><input id="l-from" v-model="from" type="date" class="input py-2.5" /></div>
        <div><label class="label text-xs" for="l-to">To</label><input id="l-to" v-model="to" type="date" class="input py-2.5" /></div>
        <button class="btn-secondary self-end py-2.5">Show</button>
      </form>
      <ErrorBox :message="error" />
      <Loader v-if="!r && !error" />
      <section v-if="r" class="card px-4 py-2 text-sm">
        <div class="flex justify-between border-b border-line/10 py-2 font-semibold"><span>Brought forward {{ date(r.from_date) }}</span><span class="tabular-nums">{{ figure(r.opening) }}</span></div>
        <RouterLink v-for="(l, i) in r.lines" :key="i" :to="`/admin/books/journal/${l.journal}`" class="grid grid-cols-[1fr_auto] gap-x-3 border-b border-line/[0.06] py-2.5">
          <span class="min-w-0">
            <span class="block truncate">{{ l.member_name || l.narration || l.voucher_type }}</span>
            <span class="block text-xs text-ink-soft">{{ date(l.posting_date) }} · {{ l.voucher_type }}</span>
          </span>
          <span class="text-right">
            <span class="block tabular-nums" :class="l.credit ? 'text-ink-soft' : ''">{{ l.debit ? `Dr ${figure(l.debit)}` : `Cr ${figure(l.credit)}` }}</span>
            <span class="block text-xs tabular-nums text-ink-faint">{{ figure(l.balance) }}</span>
          </span>
        </RouterLink>
        <p v-if="!r.lines.length" class="py-4 text-center text-ink-soft">No entries in this period.</p>
        <div class="flex justify-between py-2 font-semibold"><span>Balance {{ date(r.to_date) }}</span><span class="tabular-nums">{{ figure(r.closing) }}</span></div>
      </section>
    </div>
  </div>
</template>
