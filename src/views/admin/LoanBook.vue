<script setup>
import { ref, onMounted } from 'vue'
import * as api from '../../api'
import { current, currency } from '../../store'
import { money, whatsappLink } from '../../format'
import PageHeader from '../../components/PageHeader.vue'
import Loader from '../../components/Loader.vue'
import ErrorBox from '../../components/ErrorBox.vue'
import Icon from '../../components/Icon.vue'

const book = ref(null)
const error = ref('')
onMounted(async () => {
  try { book.value = await api.get('finance.loan_book', { cooperative: current.value.cooperative }) } catch (e) { error.value = e.message }
})
const reminder = (l) => `Hello ${l.member_name.split(' ')[0]}, this is a reminder from ${current.value.cooperative_name}: ${money(l.overdue_amount, currency.value)} on your loan is overdue (${l.days_overdue} days). You can pay in the Cooperative360 app. Thank you.`
const tone = (days) => (days > 90 ? 'bg-neg text-white' : days > 30 ? 'bg-neg-soft text-neg' : 'bg-warn-soft text-warn')
</script>

<template>
  <div>
    <PageHeader title="Loan book" :subtitle="current?.cooperative_name" back="/admin?tab=overview" />
    <div class="space-y-4 px-5 pb-12 pt-1">
      <ErrorBox :message="error" />
      <Loader v-if="!book && !error" />
      <template v-if="book">
        <section class="relative overflow-hidden rounded-4xl bg-navy-800 p-5 text-white shadow-lift">
          <p class="text-sm text-navy-100/80">Out on loan</p>
          <p class="money mt-1 text-[34px] leading-tight">{{ money(book.outstanding, currency) }}</p>
          <p class="text-xs text-navy-100/70">{{ book.active_count }} active loan{{ book.active_count === 1 ? '' : 's' }}<template v-if="book.pending"> · {{ book.pending }} waiting for approval</template><template v-if="book.waiting_to_send"> · {{ book.waiting_to_send }} to send</template></p>
          <div class="mt-4 grid grid-cols-2 gap-2 text-sm">
            <div class="rounded-2xl bg-white/[0.08] p-3"><p class="text-xs text-navy-100/70">At risk (late)</p><p class="money">{{ book.par_percent }}%</p></div>
            <div class="rounded-2xl bg-white/[0.08] p-3"><p class="text-xs text-navy-100/70">Overdue now</p><p class="money">{{ money(book.overdue_amount, currency) }}</p></div>
          </div>
        </section>

        <section class="card p-5">
          <h2 class="text-sm font-semibold">How late</h2>
          <p class="text-xs text-ink-soft">Balance of loans with a payment overdue, by how long (portfolio at risk).</p>
          <div class="mt-3 space-y-2.5">
            <div v-for="b in book.buckets" :key="b.label">
              <div class="flex justify-between text-sm"><span>{{ b.label }}</span><span class="num">{{ money(b.balance, currency) }} <span class="text-xs text-ink-soft">({{ b.count }})</span></span></div>
              <div class="mt-1 h-2 overflow-hidden rounded-full bg-line/[0.07]"><div class="h-full rounded-full bg-neg/70" :style="{ width: `${b.percent}%` }" /></div>
            </div>
          </div>
        </section>

        <section>
          <h2 class="px-1 text-sm font-semibold">Follow up</h2>
          <div v-if="book.late.length" class="mt-3 space-y-2">
            <div v-for="l in book.late" :key="l.name" class="card p-4">
              <RouterLink :to="`/loans/${l.name}`" class="flex items-start justify-between gap-3">
                <div class="min-w-0">
                  <p class="truncate font-semibold">{{ l.member_name }}</p>
                  <p class="text-xs text-ink-soft">{{ l.member_number }} · {{ money(l.balance, currency) }} left</p>
                </div>
                <div class="text-right"><p class="money text-lg text-neg">{{ money(l.overdue_amount, currency) }}</p><span class="chip" :class="tone(l.days_overdue)">{{ l.days_overdue }} days</span></div>
              </RouterLink>
              <p v-if="l.guarantors.length" class="mt-2 text-xs text-ink-soft">Guaranteed by {{ l.guarantors.map((g) => `${g.member_name} (${money(g.amount, currency)})`).join(', ') }}</p>
              <a v-if="l.phone" :href="whatsappLink(l.phone, reminder(l))" target="_blank" rel="noopener" class="btn-secondary btn-sm mt-3 w-full"><Icon name="chat" :size="16" /> Remind on WhatsApp</a>
            </div>
          </div>
          <div v-else class="card mt-3 p-6 text-center text-sm text-ink-soft"><Icon name="checkCircle" class="mx-auto mb-2 text-pos" :size="24" />Nobody is behind on a loan.</div>
        </section>
      </template>
    </div>
  </div>
</template>
