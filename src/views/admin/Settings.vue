<script setup>
import { ref, computed, onMounted } from 'vue'
import * as api from '../../api'
import { state, current, refreshMemberships, loadDashboard, toast, shareText, copyText } from '../../store'
import { appUrl } from '../../format'
import Loader from '../../components/Loader.vue'
import ErrorBox from '../../components/ErrorBox.vue'
import Sheet from '../../components/Sheet.vue'
import BankAccountForm from '../../components/BankAccountForm.vue'
import Icon from '../../components/Icon.vue'

const coop = ref(null)
const error = ref('')
const busy = ref(false)
const connecting = ref(false)
const confirmNewCode = ref(false)
const online = computed(() => state.paystack.enabled)
const inviteLink = computed(() => appUrl(`/join/${coop.value?.join_code}`))

async function load() {
  try { coop.value = (await loadDashboard()).cooperative } catch (e) { error.value = e.message }
}
onMounted(load)

async function save() {
  busy.value = true
  error.value = ''
  try {
    const { name, join_code, status, account_verified, ...fields } = coop.value
    coop.value = { ...(await api.post('coop.update_cooperative', { cooperative: current.value.cooperative, ...fields })), join_code }
    await refreshMemberships()
    loadDashboard().catch(() => {})
    toast('Settings saved')
  } catch (e) { error.value = e.message } finally { busy.value = false }
}

async function connectBank(form) {
  busy.value = true
  try {
    const join_code = coop.value.join_code
    coop.value = { ...(await api.post('coop.set_bank_account', { cooperative: current.value.cooperative, ...form })), join_code }
    connecting.value = false
    toast('Bank account verified. Online payments will settle here.')
  } catch (e) { toast(e.message, 'error') } finally { busy.value = false }
}

async function newCode() {
  try {
    coop.value.join_code = (await api.post('coop.regenerate_join_code', { cooperative: current.value.cooperative })).join_code
    confirmNewCode.value = false
    toast('New invite link created. The old one no longer works.')
  } catch (e) { toast(e.message, 'error') }
}

function shareInvite() {
  shareText(`Join ${coop.value.cooperative_name} on CoopVault. It’s where we track our contributions and loans now.\n\nTap to join: ${inviteLink.value}`, `Join ${coop.value.cooperative_name}`)
}
</script>

<template>
  <div>
    <ErrorBox :message="error" />
    <Loader v-if="!coop && !error" />
    <form v-if="coop" class="space-y-7" @submit.prevent="save">
      <!-- Invite -->
      <section class="relative overflow-hidden rounded-4xl bg-forest-800 p-5 text-white shadow-lift">
        <svg class="pointer-events-none absolute -right-14 -top-14 h-48 w-48 text-coin-400/[0.12]" viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="34" fill="none" stroke="currentColor" stroke-width="9" /></svg>
        <p class="relative text-sm text-forest-100/80">Invite members</p>
        <p class="relative mt-1 truncate font-semibold text-coin-300">{{ inviteLink.replace(/^https?:\/\//, '') }}</p>
        <p class="relative mt-1 text-xs text-forest-100/70">Code <b class="tracking-[0.2em] text-white">{{ coop.join_code }}</b>. New members ask to join, and you approve them in Review.</p>
        <div class="relative mt-4 flex gap-2">
          <button type="button" class="btn-gold btn-sm flex-1" @click="shareInvite"><Icon name="share" :size="16" /> Share invite</button>
          <button type="button" class="btn btn-sm bg-white/10 text-white hover:bg-white/15" aria-label="Copy link" @click="copyText(inviteLink, 'Invite link copied')"><Icon name="copy" :size="16" /></button>
          <button type="button" class="btn btn-sm bg-white/10 text-white hover:bg-white/15" aria-label="Create a new link" @click="confirmNewCode = true"><Icon name="refresh" :size="16" /></button>
        </div>
      </section>

      <section class="space-y-4">
        <h2 class="section-title">About</h2>
        <div><label class="label" for="sname">Name</label><input id="sname" v-model="coop.cooperative_name" class="input" required /></div>
        <div><label class="label" for="sdesc">Description</label><textarea id="sdesc" v-model="coop.description" rows="2" class="input" placeholder="What the group is for, when you meet…" /></div>
      </section>

      <section class="space-y-4">
        <h2 class="section-title">Contributions</h2>
        <div class="grid grid-cols-2 gap-3">
          <div><label class="label" for="samt">Each member pays</label><input id="samt" v-model="coop.contribution_amount" type="number" min="0" class="input" /></div>
          <div>
            <label class="label" for="sfreq">Every</label>
            <select id="sfreq" v-model="coop.contribution_frequency" class="input"><option value="Weekly">Week</option><option value="Monthly">Month</option><option value="Quarterly">Quarter</option><option value="Flexible">Flexible</option></select>
          </div>
        </div>
        <div v-if="coop.contribution_frequency !== 'Flexible'">
          <label class="label" for="sstart">Counting from</label>
          <input id="sstart" v-model="coop.start_date" type="date" class="input" />
          <p class="hint">Members owe one contribution per period from this date, or from when they joined if later.</p>
        </div>
      </section>

      <section class="space-y-4">
        <h2 class="section-title">Loans</h2>
        <div>
          <label class="label" for="smult">How much of their savings can members borrow?</label>
          <select id="smult" v-model.number="coop.loan_multiplier" class="input">
            <option :value="1">All of it (100%)</option><option :value="0.75">Three quarters (75%)</option><option :value="0.5">Half (50%)</option><option :value="0.25">A quarter (25%)</option>
            <option v-if="![1, 0.75, 0.5, 0.25].includes(Number(coop.loan_multiplier))" :value="coop.loan_multiplier">{{ Math.round(coop.loan_multiplier * 100) }}%</option>
          </select>
          <p class="hint">Members can never borrow more than they’ve saved. What they still owe is taken off their limit.</p>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div><label class="label" for="srate">Interest (flat %)</label><input id="srate" v-model="coop.interest_rate" type="number" min="0" max="100" step="0.5" class="input" /></div>
          <div><label class="label" for="sten">Longest term (months)</label><input id="sten" v-model="coop.max_loan_tenure_months" type="number" min="1" class="input" /></div>
        </div>
      </section>

      <section class="space-y-4">
        <h2 class="section-title">Bank account</h2>
        <template v-if="online">
          <div v-if="coop.account_verified" class="card p-4">
            <div class="flex items-center justify-between">
              <span class="chip bg-pos-soft text-pos"><Icon name="checkCircle" :size="13" /> Verified</span>
              <button type="button" class="text-sm link" @click="connecting = true">Change</button>
            </div>
            <p class="money mt-2 text-2xl tracking-wider">{{ coop.account_number }}</p>
            <p class="text-sm text-ink-soft">{{ coop.bank_name }} · {{ coop.account_name }}</p>
            <p class="mt-3 text-xs text-ink-soft">Online payments settle straight into this account through Paystack. Members also see it for manual transfers.</p>
          </div>
          <button v-else type="button" class="flex w-full items-center gap-3.5 rounded-3xl border border-dashed border-brand-text/40 bg-brand-soft/60 p-4 text-left" @click="connecting = true">
            <span class="grid h-11 w-11 place-items-center rounded-2xl bg-card text-brand-text"><Icon name="bank" /></span>
            <span class="flex-1"><b class="block">Connect the cooperative’s bank account</b><span class="text-sm text-ink-soft">So online payments go straight to the group’s own account.</span></span>
            <Icon name="chevron" :size="18" class="text-ink-faint" />
          </button>
        </template>
        <template v-else>
          <div><label class="label" for="sbank">Bank</label><input id="sbank" v-model="coop.bank_name" class="input" /></div>
          <div class="grid grid-cols-2 gap-3">
            <div><label class="label" for="sacct">Account number</label><input id="sacct" v-model="coop.account_number" inputmode="numeric" class="input" /></div>
            <div><label class="label" for="sacctn">Account name</label><input id="sacctn" v-model="coop.account_name" class="input" /></div>
          </div>
        </template>
      </section>

      <section v-if="online" class="space-y-4">
        <h2 class="section-title">Online payments</h2>
        <label class="flex items-center justify-between gap-4 rounded-3xl bg-card p-4 shadow-soft">
          <span><b class="block text-[15px]">Let members pay online</b><span class="text-sm text-ink-soft">Card, transfer and USSD through Paystack</span></span>
          <input v-model="coop.accept_online_payments" type="checkbox" :true-value="1" :false-value="0" class="h-6 w-6 accent-[rgb(var(--brand))]" />
        </label>
        <div v-if="coop.accept_online_payments">
          <span class="label">Who pays the Paystack fee?</span>
          <div class="seg grid-cols-2">
            <button type="button" :class="{ on: coop.fee_bearer === 'Member' }" @click="coop.fee_bearer = 'Member'">The member</button>
            <button type="button" :class="{ on: coop.fee_bearer === 'Cooperative' }" @click="coop.fee_bearer = 'Cooperative'">The cooperative</button>
          </div>
          <p class="hint">{{ coop.fee_bearer === 'Member' ? 'The fee (about 1.5%) is added at checkout, so the full contribution reaches the pool.' : 'Members pay the exact amount; the fee comes out of what the cooperative receives.' }}</p>
        </div>
      </section>

      <RouterLink to="/announcements" class="card flex items-center gap-3.5 p-4">
        <span class="grid h-10 w-10 place-items-center rounded-2xl bg-gold-soft text-gold-text"><Icon name="bell" :size="18" /></span>
        <span class="flex-1 font-semibold">Post an announcement</span><Icon name="chevron" :size="18" class="text-ink-faint" />
      </RouterLink>

      <div class="sticky bottom-24 z-10">
        <button class="btn-primary btn-lg w-full shadow-lift" :disabled="busy">{{ busy ? 'Saving…' : 'Save settings' }}</button>
      </div>
    </form>

    <Sheet :open="connecting" title="Cooperative bank account" subtitle="We confirm the account name with the bank, then send online payments here." @close="connecting = false">
      <BankAccountForm :initial="{ bank_code: coop?.settlement_bank_code, bank_name: coop?.bank_name, account_number: coop?.account_number, account_name: coop?.account_name }"
        :busy="busy" submit-label="Verify and connect" @submit="connectBank" />
    </Sheet>
    <Sheet :open="confirmNewCode" title="Create a new invite link?" subtitle="The current link and code will stop working. Members who already joined aren’t affected." @close="confirmNewCode = false">
      <div class="grid grid-cols-2 gap-3">
        <button class="btn-secondary" @click="confirmNewCode = false">Cancel</button>
        <button class="btn-primary" @click="newCode">New link</button>
      </div>
    </Sheet>
  </div>
</template>
