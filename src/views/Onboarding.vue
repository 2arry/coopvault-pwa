<script setup>
import { reactive, ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import * as api from '../api'
import { state, refreshMemberships, selectCooperative, toast } from '../store'
import ErrorBox from '../components/ErrorBox.vue'
import Icon from '../components/Icon.vue'

const router = useRouter()
const code = ref(readCode())
const mode = ref('join')
function readCode() {
  try { return sessionStorage.getItem('coopvault.joinCode') || '' } catch { return '' }
}
const busy = ref(false)
const error = ref('')
const form = reactive({
  cooperative_name: '', description: '', contribution_amount: '', contribution_frequency: 'Monthly',
  loan_multiplier: 1, interest_rate: 0, max_loan_tenure_months: 6,
})
const pending = computed(() => state.memberships.filter((m) => m.status === 'Pending'))
const hasActive = computed(() => state.memberships.some((m) => m.status === 'Active'))

async function join() {
  busy.value = true
  error.value = ''
  try {
    const res = await api.post('coop.join_cooperative', { join_code: code.value })
    await refreshMemberships()
    selectCooperative(res.name)
    toast(res.status === 'Active' ? 'You are already a member' : 'Request sent. An admin will approve you shortly.')
    code.value = ''
    try { sessionStorage.removeItem('coopvault.joinCode') } catch {}
    if (res.status === 'Active') router.replace('/')
  } catch (e) {
    error.value = e.message
  } finally {
    busy.value = false
  }
}

async function create() {
  busy.value = true
  error.value = ''
  try {
    const res = await api.post('coop.create_cooperative', form)
    await refreshMemberships()
    selectCooperative(res.name)
    toast('Cooperative created. Share the join code with members.')
    router.replace('/admin?tab=settings')
  } catch (e) {
    error.value = e.message
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="px-5 pt-safe pb-10">
    <div class="flex items-center justify-between pt-6">
      <img src="/logo.svg" alt="" class="h-11 w-11 rounded-xl" />
      <RouterLink v-if="hasActive" to="/" class="text-sm font-semibold text-brand-700">Back to home</RouterLink>
      <RouterLink v-else to="/profile" class="text-sm font-semibold text-ink-soft">Profile</RouterLink>
    </div>
    <h1 class="mt-6 text-2xl font-extrabold">Hi {{ state.user?.first_name || 'there' }} 👋</h1>
    <p class="mt-1 text-ink-soft">Join your cooperative with the code your admin shared, or start a new one.</p>

    <div v-for="m in pending" :key="m.name" class="card mt-5 flex items-center gap-3 p-4">
      <div class="rounded-full bg-amber-50 p-2 text-amber-700"><Icon name="clock" /></div>
      <div class="flex-1 text-sm">
        <p class="font-semibold">{{ m.cooperative_name }}</p>
        <p class="text-ink-soft">Waiting for an admin to approve your request.</p>
      </div>
    </div>

    <div class="mt-6 grid grid-cols-2 gap-1 rounded-xl bg-black/5 p-1 text-sm font-semibold">
      <button class="rounded-lg py-2" :class="mode === 'join' ? 'bg-white shadow-sm' : 'text-ink-soft'" @click="mode = 'join'">Join</button>
      <button class="rounded-lg py-2" :class="mode === 'create' ? 'bg-white shadow-sm' : 'text-ink-soft'" @click="mode = 'create'">Create new</button>
    </div>

    <div class="mt-5"><ErrorBox :message="error" /></div>

    <form v-if="mode === 'join'" class="mt-4 space-y-4" @submit.prevent="join">
      <div>
        <label class="label" for="code">Join code</label>
        <input id="code" v-model="code" class="input text-center text-2xl font-bold uppercase tracking-[0.4em]" maxlength="8" placeholder="ABC123" required autocomplete="off" />
      </div>
      <button class="btn-primary w-full" :disabled="busy || code.length < 4">Request to join</button>
    </form>

    <form v-else class="mt-4 space-y-4" @submit.prevent="create">
      <div>
        <label class="label" for="cname">Cooperative name</label>
        <input id="cname" v-model="form.cooperative_name" class="input" required placeholder="e.g. Unity Savings Circle" />
      </div>
      <div>
        <label class="label" for="desc">Description <span class="font-normal text-ink-faint">(optional)</span></label>
        <textarea id="desc" v-model="form.description" rows="2" class="input" />
      </div>
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="label" for="amt">Contribution</label>
          <input id="amt" v-model="form.contribution_amount" type="number" min="0" inputmode="decimal" class="input" placeholder="10000" />
        </div>
        <div>
          <label class="label" for="freq">Every</label>
          <select id="freq" v-model="form.contribution_frequency" class="input">
            <option>Weekly</option><option>Monthly</option><option>Quarterly</option><option>Flexible</option>
          </select>
        </div>
        <div>
          <label class="label" for="rate">Loan interest %</label>
          <input id="rate" v-model="form.interest_rate" type="number" min="0" max="100" step="0.1" class="input" />
        </div>
        <div>
          <label class="label" for="tenure">Max tenure (months)</label>
          <input id="tenure" v-model="form.max_loan_tenure_months" type="number" min="1" class="input" />
        </div>
      </div>
      <p class="hint">Members can borrow up to what they've contributed. You can change these rules and add bank details later.</p>
      <button class="btn-primary w-full" :disabled="busy">Create cooperative</button>
    </form>
  </div>
</template>
