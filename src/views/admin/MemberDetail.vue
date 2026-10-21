<script setup>
import { ref, computed, onMounted } from 'vue'
import * as api from '../../api'
import { current, currency, isOwner, toast, shareText, copyText } from '../../store'
import { money, date, relative, today, paidThroughLabel, periodWord, whatsappLink, appUrl } from '../../format'
import { memberReminder } from '../../reminders'
import PageHeader from '../../components/PageHeader.vue'
import ActivityRow from '../../components/ActivityRow.vue'
import AmountField from '../../components/AmountField.vue'
import Loader from '../../components/Loader.vue'
import ErrorBox from '../../components/ErrorBox.vue'
import Sheet from '../../components/Sheet.vue'
import StatusPill from '../../components/StatusPill.vue'
import Icon from '../../components/Icon.vue'

const props = defineProps({ name: String })
const st = ref(null)
const error = ref('')
const busy = ref(false)
const confirming = ref(null) // { title, subtitle, action, fields, danger }
const opening = ref(false)
const ob = ref({ amount: '', as_of: today(), note: '' })
const reset = ref(null)

const member = computed(() => st.value?.member)
const s = computed(() => st.value?.standing)
const isSelf = computed(() => current.value?.name === props.name)
const owing = computed(() => ['due', 'behind'].includes(s.value?.state))
const reminder = computed(() => (st.value && owing.value ? memberReminder({ ...member.value, standing: s.value }, current.value.cooperative_name, currency.value) : ''))
const payoutRecent = computed(() => {
  const c = member.value?.payout_changed_on
  return c && Date.now() - new Date(String(c).replace(' ', 'T')).getTime() < 72 * 3600 * 1000
})

async function load() {
  try { st.value = await api.get('coop.get_statement', { cooperative: current.value.cooperative, member: props.name }) } catch (e) { error.value = e.message }
}

function ask(change) {
  const name = member.value.full_name
  const options = {
    Suspended: { title: `Suspend ${name}?`, subtitle: 'They can still log in and see their records, but can’t pay, borrow or withdraw until you reinstate them.', danger: true },
    Active: { title: `Reinstate ${name}?`, subtitle: 'They’ll be able to pay, borrow and withdraw again.' },
    Admin: { title: `Make ${name} an admin?`, subtitle: 'Admins can change the rules, the bank account, roles and reset passwords.' },
    Treasurer: { title: `Make ${name} the treasurer?`, subtitle: 'Treasurers send loans and withdrawals, approve new members and propose opening balances. They can’t change settings or roles.' },
    Member: { title: `Make ${name} a regular member?`, subtitle: 'They’ll lose any admin or treasurer powers.' },
  }
  const key = change.status || change.role
  confirming.value = { ...options[key], fields: change }
}

async function applyChange() {
  busy.value = true
  try {
    await api.post('coop.update_member', { member: props.name, ...confirming.value.fields })
    Object.assign(st.value.member, confirming.value.fields)
    toast('Member updated')
    confirming.value = null
  } catch (e) { toast(e.message, 'error') } finally { busy.value = false }
}

async function proposeOpening() {
  busy.value = true
  try {
    await api.post('finance.propose_opening_balance', { cooperative: current.value.cooperative, member: props.name, amount: ob.value.amount, as_of: ob.value.as_of, note: ob.value.note })
    opening.value = false
    toast(`Sent to ${member.value.full_name} to confirm`)
  } catch (e) { toast(e.message, 'error') } finally { busy.value = false }
}

async function createReset() {
  busy.value = true
  try { reset.value = await api.post('coop.create_reset_code', { cooperative: current.value.cooperative, member: props.name }) } catch (e) { toast(e.message, 'error') } finally { busy.value = false }
}
const resetMessage = computed(() => reset.value
  ? `Your CoopVault password reset code is ${reset.value.code}. It works once and expires in ${reset.value.minutes} minutes. Open ${appUrl('/forgot')} and enter it with your phone number.`
  : '')

onMounted(load)
</script>

<template>
  <div>
    <PageHeader :title="member?.full_name || 'Member'" :subtitle="member?.phone" back="/admin?tab=members" />
    <div class="space-y-4 px-5 pb-12 pt-1">
      <ErrorBox :message="error" />
      <Loader v-if="!st && !error" />
      <template v-if="st">
        <section class="card p-5">
          <div class="grid grid-cols-3 gap-2 text-center">
            <div><p class="text-xs text-ink-soft">Savings</p><p class="money text-lg">{{ money(st.balances.savings, currency, { compact: true }) }}</p></div>
            <div><p class="text-xs text-ink-soft">Owes</p><p class="money text-lg">{{ money(st.balances.loan_outstanding, currency, { compact: true }) }}</p></div>
            <div><p class="text-xs text-ink-soft">Can borrow</p><p class="money text-lg">{{ money(st.balances.borrow_limit, currency, { compact: true }) }}</p></div>
          </div>
          <div v-if="s?.tracked" class="mt-4 flex items-center gap-3 rounded-2xl p-3"
            :class="s.state === 'behind' ? 'bg-neg-soft text-neg' : s.state === 'due' ? 'bg-warn-soft text-warn' : 'bg-pos-soft text-pos'">
            <Icon :name="owing ? 'clock' : 'checkCircle'" :size="18" />
            <p class="flex-1 text-sm font-semibold">
              <template v-if="s.state === 'behind'">{{ s.periods_behind }} {{ periodWord(s.frequency, s.periods_behind) }} behind · {{ money(s.due_now, currency) }} to catch up</template>
              <template v-else-if="s.state === 'due'">{{ money(s.due_now, currency) }} due this {{ periodWord(s.frequency) }}</template>
              <template v-else-if="s.paid_through">{{ paidThroughLabel(s.paid_through, s.frequency) }}</template>
              <template v-else>Starts {{ date(s.next_due_date, { day: 'numeric', month: 'short' }) }}</template>
            </p>
          </div>
          <div v-if="owing || (!isSelf)" class="mt-4 grid grid-cols-2 gap-2">
            <template v-if="owing">
              <a v-if="member.phone" :href="whatsappLink(member.phone, reminder)" target="_blank" rel="noopener" class="btn-secondary btn-sm"><Icon name="chat" :size="16" /> Remind</a>
              <button v-else class="btn-secondary btn-sm" @click="shareText(reminder)"><Icon name="share" :size="16" /> Remind</button>
            </template>
            <button v-if="!isSelf" class="btn-secondary btn-sm whitespace-nowrap" :class="owing ? '' : 'col-span-2'" @click="opening = true; ob = { amount: '', as_of: today(), note: '' }">Opening balance</button>
          </div>
        </section>

        <section class="card divide-soft text-sm">
          <div class="flex items-center justify-between p-4"><span class="text-ink-soft">Phone</span><span>{{ member.phone || '—' }}</span></div>
          <div class="flex items-center justify-between p-4">
            <span class="text-ink-soft">Role</span>
            <select v-if="isOwner && !isSelf" :value="member.role" class="rounded-xl border border-line/12 bg-card px-3 py-1.5" @change="ask({ role: $event.target.value }); $event.target.value = member.role">
              <option>Member</option><option>Treasurer</option><option>Admin</option>
            </select>
            <span v-else>{{ member.role }}</span>
          </div>
          <div class="flex items-center justify-between p-4">
            <span class="text-ink-soft">Status</span>
            <div class="flex items-center gap-3">
              <StatusPill :status="member.status" />
              <template v-if="isOwner && !isSelf">
                <button v-if="member.status === 'Active'" class="text-xs font-semibold text-neg" @click="ask({ status: 'Suspended' })">Suspend</button>
                <button v-else-if="member.status === 'Suspended'" class="text-xs font-semibold text-brand-text" @click="ask({ status: 'Active' })">Reinstate</button>
              </template>
            </div>
          </div>
          <div class="p-4">
            <div class="flex items-center justify-between gap-3">
              <span class="text-ink-soft">Payout account</span>
              <button v-if="member.payout_account_number" class="text-right" @click="copyText(member.payout_account_number)">
                <span class="num block font-semibold">{{ member.payout_account_number }}</span>
                <span class="block text-xs text-ink-soft">{{ member.payout_bank_name }} · {{ member.payout_account_name }}</span>
              </button>
              <span v-else class="text-ink-faint">Not added</span>
            </div>
            <p v-if="payoutRecent" class="mt-2 flex gap-2 rounded-2xl bg-warn-soft p-2.5 text-xs text-warn"><Icon name="alert" :size="14" class="mt-0.5" /> Changed {{ relative(member.payout_changed_on) }}. Check with them before sending money.</p>
          </div>
          <button v-if="isOwner && !isSelf" class="flex w-full items-center gap-3 p-4 text-left" @click="createReset">
            <Icon name="lock" :size="18" class="text-ink-soft" />
            <span class="flex-1"><span class="block font-semibold">Reset password</span><span class="block text-xs text-ink-soft">Creates a one-time code to give them</span></span>
            <Icon name="chevron" :size="18" class="text-ink-faint" />
          </button>
        </section>

        <section>
          <h2 class="px-1 text-sm font-semibold">Statement</h2>
          <div v-if="st.entries.length" class="card mt-3 px-4 py-1">
            <ActivityRow v-for="e in st.entries" :key="e.doctype + e.name" :entry="e" :currency="currency" />
          </div>
          <p v-else class="mt-3 px-1 text-sm text-ink-soft">No payments or loans yet.</p>
        </section>
      </template>
    </div>

    <Sheet :open="!!confirming" :title="confirming?.title" :subtitle="confirming?.subtitle" @close="confirming = null">
      <div class="grid grid-cols-2 gap-3">
        <button class="btn-secondary" @click="confirming = null">Cancel</button>
        <button :class="confirming?.danger ? 'btn-danger' : 'btn-primary'" :disabled="busy" @click="applyChange">Confirm</button>
      </div>
    </Sheet>

    <Sheet :open="opening" :title="`Opening balance for ${member?.full_name}`" subtitle="What they’d already saved before CoopVault. It only counts once they confirm it in their app." @close="opening = false">
      <form class="space-y-4" @submit.prevent="proposeOpening">
        <AmountField v-model="ob.amount" :currency="currency" label="Amount saved so far" id="ob-amount" />
        <div><label class="label" for="ob-date">As of</label><input id="ob-date" v-model="ob.as_of" type="date" :max="today()" class="input" /></div>
        <div><label class="label" for="ob-note">Note <span class="font-normal text-ink-faint">(optional)</span></label><input id="ob-note" v-model="ob.note" class="input" placeholder="e.g. From the 2026 savings notebook" /></div>
        <button class="btn-primary w-full" :disabled="busy || !(Number(ob.amount) > 0)">Send for them to confirm</button>
      </form>
    </Sheet>

    <Sheet :open="!!reset" title="Reset code" :subtitle="`Give this to ${reset?.full_name}. It works once and expires in ${reset?.minutes} minutes.`" @close="reset = null">
      <template v-if="reset">
        <p class="money rounded-3xl bg-sunk py-5 text-center text-4xl tracking-[0.2em]">{{ reset.code }}</p>
        <div class="mt-4 grid grid-cols-2 gap-2">
          <button class="btn-secondary" @click="copyText(reset.code, 'Code copied')"><Icon name="copy" :size="16" /> Copy</button>
          <a v-if="reset.phone" :href="whatsappLink(reset.phone, resetMessage)" target="_blank" rel="noopener" class="btn-primary"><Icon name="chat" :size="16" /> WhatsApp</a>
          <button v-else class="btn-primary" @click="shareText(resetMessage)"><Icon name="share" :size="16" /> Share</button>
        </div>
        <p class="mt-4 text-xs text-ink-soft">The other admins are told a code was created. After resetting, their payouts, loans and withdrawals pause for 3 days.</p>
      </template>
    </Sheet>
  </div>
</template>
