<script setup>
import { ref, onMounted } from 'vue'
import * as api from '../../api'
import { current, refreshMemberships, toast } from '../../store'
import Loader from '../../components/Loader.vue'
import ErrorBox from '../../components/ErrorBox.vue'
import Icon from '../../components/Icon.vue'

const coop = ref(null)
const error = ref('')
const busy = ref(false)

onMounted(async () => {
  try { coop.value = (await api.get('coop.get_dashboard', { cooperative: current.value.cooperative })).cooperative } catch (e) { error.value = e.message }
})

async function save() {
  busy.value = true
  error.value = ''
  try {
    const { name, join_code, status, ...fields } = coop.value
    coop.value = await api.post('coop.update_cooperative', { cooperative: current.value.cooperative, ...fields })
    await refreshMemberships()
    toast('Settings saved')
  } catch (e) { error.value = e.message } finally { busy.value = false }
}

async function newCode() {
  try {
    coop.value.join_code = (await api.post('coop.regenerate_join_code', { cooperative: current.value.cooperative })).join_code
    toast('New join code created. The old one no longer works.')
  } catch (e) { toast(e.message, 'error') }
}

function share() {
  const text = `Join ${coop.value.cooperative_name} on CoopVault: ${location.origin}/welcome?code=${coop.value.join_code} (join code ${coop.value.join_code})`
  if (navigator.share) navigator.share({ title: 'Join our cooperative', text }).catch(() => {})
  else navigator.clipboard?.writeText(text).then(() => toast('Invite copied. Paste it in your WhatsApp group.'))
}
</script>

<template>
  <div>
    <ErrorBox :message="error" />
    <Loader v-if="!coop && !error" />
    <form v-if="coop" class="space-y-6" @submit.prevent="save">
      <section class="rounded-2xl bg-brand-800 p-5 text-white">
        <p class="text-sm text-brand-100">Join code</p>
        <p class="num mt-1 text-3xl font-extrabold tracking-[0.3em]">{{ coop.join_code }}</p>
        <div class="mt-4 flex gap-2">
          <button type="button" class="btn btn-sm flex-1 bg-white text-brand-900" @click="share"><Icon name="share" :size="16" /> Invite members</button>
          <button type="button" class="btn btn-sm bg-white/10 text-white" aria-label="New code" @click="newCode"><Icon name="refresh" :size="16" /></button>
        </div>
      </section>

      <section class="space-y-4">
        <h2 class="section-title">General</h2>
        <div><label class="label">Name</label><input v-model="coop.cooperative_name" class="input" required /></div>
        <div><label class="label">Description</label><textarea v-model="coop.description" rows="2" class="input" /></div>
        <div class="grid grid-cols-2 gap-3">
          <div><label class="label">Contribution</label><input v-model="coop.contribution_amount" type="number" min="0" class="input" /></div>
          <div><label class="label">Every</label><select v-model="coop.contribution_frequency" class="input"><option>Weekly</option><option>Monthly</option><option>Quarterly</option><option>Flexible</option></select></div>
        </div>
      </section>

      <section class="space-y-4">
        <h2 class="section-title">Loan rules</h2>
        <div>
          <label class="label">Borrow limit (× contributions)</label>
          <input v-model="coop.loan_multiplier" type="number" min="0" max="1" step="0.05" class="input" />
          <p class="hint">1 means a member can owe at most what they've contributed. 0.5 means half of it.</p>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div><label class="label">Interest (flat %)</label><input v-model="coop.interest_rate" type="number" min="0" max="100" step="0.1" class="input" /></div>
          <div><label class="label">Max months</label><input v-model="coop.max_loan_tenure_months" type="number" min="1" class="input" /></div>
        </div>
      </section>

      <section class="space-y-4">
        <h2 class="section-title">Bank account for contributions</h2>
        <div><label class="label">Bank</label><input v-model="coop.bank_name" class="input" /></div>
        <div class="grid grid-cols-2 gap-3">
          <div><label class="label">Account number</label><input v-model="coop.account_number" inputmode="numeric" class="input" /></div>
          <div><label class="label">Account name</label><input v-model="coop.account_name" class="input" /></div>
        </div>
      </section>

      <RouterLink to="/announcements" class="card flex items-center gap-3 p-4"><Icon name="bell" class="text-brand-700" /><span class="flex-1 font-semibold">Post an announcement</span><Icon name="chevron" class="text-ink-faint" /></RouterLink>

      <button class="btn-primary w-full" :disabled="busy">{{ busy ? 'Saving…' : 'Save settings' }}</button>
    </form>
  </div>
</template>
