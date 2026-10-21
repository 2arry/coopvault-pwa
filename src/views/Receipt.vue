<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import * as api from '../api'
import { shareText, loadDashboard } from '../store'
import { money, date } from '../format'
import PageHeader from '../components/PageHeader.vue'
import Loader from '../components/Loader.vue'
import ErrorBox from '../components/ErrorBox.vue'
import Icon from '../components/Icon.vue'

const props = defineProps({ doctype: String, name: String })
const route = useRoute()
const fresh = !!route.query.new
const r = ref(null)
const error = ref('')

const confirmed = computed(() => r.value?.status === 'Confirmed')
const opening = computed(() => r.value?.payment_method === 'Opening Balance')
const methodLabel = computed(() => ({ Paystack: 'Paid online (Paystack)', 'Opening Balance': 'Brought over from before CoopVault', 'Bank Transfer': 'Bank transfer', Cash: 'Cash' }[r.value?.payment_method] || r.value?.payment_method))
const statusLabel = computed(() => ({ Confirmed: 'Confirmed', Pending: 'Waiting for you to confirm', Rejected: 'Declined', Reversed: 'Reversed (refunded or disputed)' }[r.value?.status] || r.value?.status))
const statusClass = computed(() => (confirmed.value ? 'text-pos' : ['Rejected', 'Reversed'].includes(r.value?.status) ? 'text-neg' : 'text-warn'))
const verb = computed(() => (r.value?.doctype === 'Coop Contribution' ? 'saved' : 'repaid'))
const doneTo = computed(() => (r.value?.loan ? `/loans/${r.value.loan}` : '/home'))

function share() {
  const x = r.value
  const lines = [
    `${confirmed.value ? '✅' : '⏳'} ${x.cooperative_name}`,
    `${x.member_name} ${opening.value ? 'brought over' : verb.value} ${money(x.amount, x.currency)}`,
    `${date(x.date)} · ${methodLabel.value}`,
    `Ref: ${x.name}${x.reference && x.reference !== x.name ? ` / ${x.reference}` : ''}`,
    `${statusLabel.value} on CoopVault`,
  ]
  shareText(lines.join('\n'), 'Payment receipt')
}

onMounted(async () => {
  try {
    r.value = await api.get('finance.get_receipt', { doctype: props.doctype, name: props.name })
    if (fresh) loadDashboard().catch(() => {})
  } catch (e) { error.value = e.message }
})
</script>

<template>
  <div>
    <PageHeader v-if="!fresh" title="Receipt" back="/activity" />
    <div class="px-5 pb-12" :class="fresh ? 'pt-safe' : 'pt-1'">
      <ErrorBox :message="error" />
      <Loader v-if="!r && !error" />
      <template v-if="r">
        <div v-if="fresh" class="pb-6 pt-12 text-center">
          <div class="mx-auto grid h-20 w-20 animate-pop place-items-center rounded-full" :class="confirmed ? 'bg-pos-soft text-pos' : 'bg-warn-soft text-warn'">
            <Icon :name="confirmed ? 'check' : 'clock'" :size="40" :stroke="2.5" />
          </div>
          <h1 class="mt-5 font-display text-[30px] font-semibold tracking-tight">{{ confirmed ? (r.doctype === 'Coop Contribution' ? 'Saved!' : 'Payment received') : 'Still processing' }}</h1>
          <p class="mx-auto mt-2 max-w-xs text-ink-soft">
            <template v-if="confirmed">{{ money(r.amount, r.currency) }} {{ r.doctype === 'Coop Contribution' ? 'is now in your savings' : 'has been taken off your loan' }}.</template>
            <template v-else>Paystack hasn’t confirmed this yet. It usually takes a few seconds, and you’ll get a notification.</template>
          </p>
        </div>

        <!-- Receipt -->
        <div class="relative overflow-hidden rounded-4xl border border-line/[0.07] bg-card shadow-soft animate-rise">
          <div class="bg-navy-800 px-6 pb-6 pt-5 text-white">
            <div class="flex items-center justify-between text-xs text-navy-100/70">
              <span class="flex items-center gap-1.5"><img src="/logo.svg" alt="" class="h-5 w-5 rounded" /> {{ r.cooperative_name }}</span>
              <span>{{ r.kind }}</span>
            </div>
            <p class="money mt-4 text-[42px] leading-none">{{ money(r.amount, r.currency) }}</p>
            <p class="mt-2 text-sm text-navy-100/80">{{ r.member_name }}</p>
          </div>
          <div class="relative h-4">
            <span class="absolute -left-3 top-0 h-6 w-6 rounded-full bg-paper" /><span class="absolute -right-3 top-0 h-6 w-6 rounded-full bg-paper" />
            <div class="mx-6 border-t-2 border-dashed border-line/10 pt-2" />
          </div>
          <dl class="divide-soft px-6 pb-4 text-sm">
            <div class="flex justify-between py-3"><dt class="text-ink-soft">Status</dt><dd class="font-semibold" :class="statusClass">{{ statusLabel }}</dd></div>
            <div class="flex justify-between py-3"><dt class="text-ink-soft">Date</dt><dd>{{ date(r.date) }}</dd></div>
            <div class="flex justify-between py-3"><dt class="text-ink-soft">Method</dt><dd>{{ methodLabel }}</dd></div>
            <div v-if="r.loan" class="flex justify-between py-3"><dt class="text-ink-soft">Loan</dt><dd><RouterLink :to="`/loans/${r.loan}`" class="link">{{ r.loan }}</RouterLink></dd></div>
            <div class="flex justify-between gap-4 py-3"><dt class="text-ink-soft">Receipt no.</dt><dd class="num text-right">{{ r.name }}</dd></div>
            <div v-if="r.reference && r.reference !== r.name" class="flex justify-between gap-4 py-3"><dt class="text-ink-soft">Reference</dt><dd class="num truncate text-right">{{ r.reference }}</dd></div>
            <div v-if="confirmed" class="flex justify-between py-3"><dt class="text-ink-soft">Confirmed by</dt><dd>{{ r.confirmed_automatically ? 'Paystack (automatic)' : opening ? `${r.member_name}` : r.confirmed_by || 'Treasurer' }}</dd></div>
            <div v-if="r.notes" class="py-3"><dt class="text-ink-soft">Note</dt><dd class="mt-0.5">{{ r.notes }}</dd></div>
            <div v-if="r.review_note && r.status === 'Reversed'" class="py-3"><dt class="text-ink-soft">Why it was reversed</dt><dd class="mt-0.5">{{ r.review_note }}</dd></div>
          </dl>
        </div>

        <div class="mt-6 grid grid-cols-2 gap-3">
          <button class="btn-secondary" @click="share"><Icon name="share" :size="18" /> Share</button>
          <RouterLink :to="doneTo" class="btn-primary">Done</RouterLink>
        </div>
      </template>
    </div>
  </div>
</template>
