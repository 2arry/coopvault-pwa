<script setup>
import { reactive, ref, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import * as api from '../api'
import { state, refreshMemberships, selectCooperative, toast } from '../store'
import { pendingJoinCode, clearJoinCode } from '../router'
import { firstName } from '../format'
import InviteBanner from '../components/InviteBanner.vue'
import ErrorBox from '../components/ErrorBox.vue'
import Icon from '../components/Icon.vue'

const route = useRoute()
const router = useRouter()
const invite = ref(pendingJoinCode())
const code = ref(invite.value)
const mode = ref(route.query.mode === 'create' ? 'create' : invite.value || route.query.mode === 'join' || state.memberships.length ? 'join' : 'create')
const busy = ref(false)
const error = ref('')
const form = reactive({
  cooperative_name: '', description: '', contribution_amount: '', contribution_frequency: 'Monthly',
  start_date: '', interest_rate: 5, max_loan_tenure_months: 6, location: '', registration_number: '', expected_members: '',
})
const pending = computed(() => state.memberships.filter((m) => m.status === 'Pending'))
const hasActive = computed(() => state.memberships.some((m) => m.status === 'Active'))

async function join() {
  busy.value = true
  error.value = ''
  try {
    const res = await api.post('coop.join_cooperative', { join_code: code.value.trim() })
    await refreshMemberships()
    selectCooperative(res.name)
    clearJoinCode()
    invite.value = ''
    code.value = ''
    if (res.status === 'Active') {
      toast('You’re already a member')
      router.replace('/home')
    } else {
      toast('Request sent. Your admin will approve you shortly.')
    }
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
    const res = await api.post('coop.create_cooperative', { ...form, loan_multiplier: 1 })
    await refreshMemberships()
    selectCooperative(res.name)
    if (res.status === 'Pending review') {
      toast('Sent to Cooperative360 for review. Set up your rules while you wait.')
      router.replace('/home')
    } else {
      toast('Your cooperative is ready. Invite your members next.')
      router.replace('/admin?tab=settings')
    }
  } catch (e) {
    error.value = e.message
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="px-5 pt-safe pb-12">
    <div class="flex items-center justify-between pt-6">
      <img src="/logo.svg" alt="" class="h-10 w-10 rounded-xl shadow-sm" />
      <RouterLink v-if="hasActive" to="/home" class="text-sm link">Back to home</RouterLink>
      <RouterLink v-else to="/profile" class="text-sm font-semibold text-ink-soft">Profile</RouterLink>
    </div>
    <h1 class="mt-8 font-display text-[32px] font-semibold leading-tight tracking-tight">Welcome, {{ firstName(state.user?.full_name) || 'friend' }}</h1>
    <p class="mt-2 text-[15px] text-ink-soft">Join your group with its invite code, or start a new cooperative and invite everyone.</p>

    <div v-for="m in pending" :key="m.name" class="card mt-6 flex items-center gap-3.5 p-4">
      <div class="grid h-11 w-11 place-items-center rounded-2xl bg-warn-soft text-warn"><Icon name="clock" /></div>
      <div class="flex-1 text-sm">
        <p class="font-semibold">{{ m.cooperative_name }}</p>
        <p class="text-ink-soft">Waiting for an admin to approve you. You’ll get access as soon as they do.</p>
      </div>
    </div>

    <!-- Fast path from an invite link -->
    <div v-if="invite" class="mt-6">
      <InviteBanner :code="invite" />
      <ErrorBox :message="error" />
      <button class="btn-primary btn-lg mt-3 w-full" :disabled="busy" @click="join">{{ busy ? 'Sending request…' : 'Ask to join' }}</button>
      <button class="btn-ghost mt-2 w-full text-sm" @click="invite = ''; clearJoinCode()">Use a different code</button>
    </div>

    <template v-else>
      <div class="seg mt-7 grid-cols-2">
        <button :class="{ on: mode === 'join' }" @click="mode = 'join'">Join a group</button>
        <button :class="{ on: mode === 'create' }" @click="mode = 'create'">Start a new one</button>
      </div>
      <div class="mt-5"><ErrorBox :message="error" /></div>

      <form v-if="mode === 'join'" class="mt-4 space-y-4" @submit.prevent="join">
        <div>
          <label class="label" for="code">Invite code</label>
          <input id="code" v-model="code" class="input money text-center text-3xl uppercase tracking-[0.35em]" maxlength="8" placeholder="ABC123" required autocomplete="off" autocapitalize="characters" />
          <p class="hint">It’s the 6-character code in the invite link your admin shared.</p>
        </div>
        <button class="btn-primary w-full" :disabled="busy || code.trim().length < 4">{{ busy ? 'Sending request…' : 'Ask to join' }}</button>
      </form>

      <form v-else class="mt-4 space-y-5" @submit.prevent="create">
        <div>
          <label class="label" for="cname">Cooperative name</label>
          <input id="cname" v-model="form.cooperative_name" class="input" required placeholder="e.g. Unity Savings Circle" />
        </div>
        <div class="card-flat space-y-4 p-4">
          <p class="text-sm font-semibold">About the group</p>
          <div class="grid grid-cols-2 gap-3">
            <div><label class="label text-xs" for="loc">Town and state</label><input id="loc" v-model="form.location" class="input" required placeholder="e.g. Ikeja, Lagos" /></div>
            <div><label class="label text-xs" for="exp">Members (about)</label><input id="exp" v-model="form.expected_members" type="number" min="2" inputmode="numeric" class="input" placeholder="25" /></div>
          </div>
          <div>
            <label class="label text-xs" for="reg">Registration number <span class="font-normal text-ink-faint">(if registered)</span></label>
            <input id="reg" v-model="form.registration_number" class="input" placeholder="From the Director of Cooperatives" />
          </div>
          <p class="hint">Cooperative360 checks each new group before members can join, usually within a day. Just type it in: there’s nothing to upload.</p>
        </div>
        <div class="card-flat space-y-4 p-4">
          <p class="text-sm font-semibold">How members save</p>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="label text-xs" for="amt">Each member pays</label>
              <input id="amt" v-model="form.contribution_amount" type="number" min="0" inputmode="decimal" class="input" placeholder="10000" />
            </div>
            <div>
              <label class="label text-xs" for="freq">Every</label>
              <select id="freq" v-model="form.contribution_frequency" class="input">
                <option value="Weekly">Week</option><option value="Monthly">Month</option><option value="Quarterly">Quarter</option><option value="Flexible">Whenever (flexible)</option>
              </select>
            </div>
          </div>
          <div v-if="form.contribution_frequency !== 'Flexible'">
            <label class="label text-xs" for="start">Counting from</label>
            <input id="start" v-model="form.start_date" type="date" class="input" />
            <p class="hint">One contribution per {{ form.contribution_frequency === 'Weekly' ? 'week' : form.contribution_frequency === 'Quarterly' ? 'quarter' : 'month' }}. Each member starts with the first full {{ form.contribution_frequency === 'Weekly' ? 'week' : form.contribution_frequency === 'Quarterly' ? 'quarter' : 'month' }} after they join (or after this date), so nobody owes for time before they were in. Leave empty to start from today.</p>
          </div>
        </div>
        <div class="card-flat space-y-4 p-4">
          <p class="text-sm font-semibold">Loans</p>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="label text-xs" for="rate">Interest (flat %)</label>
              <input id="rate" v-model="form.interest_rate" type="number" min="0" max="100" step="0.5" class="input" />
            </div>
            <div>
              <label class="label text-xs" for="tenure">Longest term (months)</label>
              <input id="tenure" v-model="form.max_loan_tenure_months" type="number" min="1" max="60" class="input" />
            </div>
          </div>
          <p class="hint">Members can borrow up to what they’ve saved, minus what they still owe. You can change all of this later.</p>
        </div>
        <button class="btn-primary btn-lg w-full" :disabled="busy">{{ busy ? 'Creating…' : 'Create cooperative' }}</button>
      </form>
    </template>
  </div>
</template>
