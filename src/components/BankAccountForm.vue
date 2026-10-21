<script setup>
// Bank + account number with live account-name lookup through Paystack.
// Falls back to free-text bank / account name when online payments are not set up.
import { ref, computed, watch, onMounted } from 'vue'
import * as api from '../api'
import { state } from '../store'
import Sheet from './Sheet.vue'
import Icon from './Icon.vue'

const props = defineProps({ initial: { type: Object, default: () => ({}) }, busy: Boolean, submitLabel: { type: String, default: 'Save account' } })
const emit = defineEmits(['submit'])

const verified = computed(() => state.paystack.enabled)
const banks = ref([])
const picking = ref(false)
const q = ref('')
const form = ref({
  bank_code: props.initial.bank_code || '',
  bank_name: props.initial.bank_name || '',
  account_number: props.initial.account_number || '',
  account_name: props.initial.account_name || '',
})
const resolving = ref(false)
const lookupError = ref('')
const filtered = computed(() => {
  const s = q.value.trim().toLowerCase()
  return s ? banks.value.filter((b) => b.name.toLowerCase().includes(s)) : banks.value
})

onMounted(async () => {
  if (verified.value) banks.value = await api.get('payments.banks').catch(() => [])
})

function choose(b) {
  form.value.bank_code = b.code
  form.value.bank_name = b.name
  picking.value = false
  q.value = ''
}

let lookupTimer
watch(() => [form.value.bank_code, form.value.account_number], () => {
  if (!verified.value) return
  lookupError.value = ''
  if (form.value.account_number !== props.initial.account_number || form.value.bank_code !== props.initial.bank_code) {
    form.value.account_name = ''
  }
  clearTimeout(lookupTimer)
  if (form.value.bank_code && /^\d{10}$/.test(form.value.account_number)) {
    lookupTimer = setTimeout(resolve, 250)
  }
})

async function resolve() {
  resolving.value = true
  try {
    const res = await api.get('payments.resolve_account', { bank_code: form.value.bank_code, account_number: form.value.account_number })
    form.value.account_name = res.account_name
  } catch (e) {
    lookupError.value = e.message
  } finally {
    resolving.value = false
  }
}

const ready = computed(() => form.value.account_number && (verified.value ? form.value.account_name && form.value.bank_code : form.value.bank_name && form.value.account_name))
</script>

<template>
  <form class="space-y-4" @submit.prevent="ready && emit('submit', { ...form })">
    <div>
      <span class="label">Bank</span>
      <button v-if="verified" type="button" class="input flex items-center justify-between text-left" @click="picking = true">
        <span :class="form.bank_name ? 'text-ink' : 'text-ink-faint'">{{ form.bank_name || 'Choose your bank' }}</span>
        <Icon name="chevronDown" :size="18" class="text-ink-faint" />
      </button>
      <input v-else v-model="form.bank_name" class="input" placeholder="e.g. GTBank" required />
    </div>
    <div>
      <label class="label" for="acct">Account number</label>
      <input id="acct" v-model.trim="form.account_number" inputmode="numeric" maxlength="10" class="input num tracking-wider" placeholder="10 digits" required />
    </div>
    <div v-if="verified">
      <div v-if="resolving" class="flex items-center gap-2 rounded-2xl bg-sunk px-4 py-3 text-sm text-ink-soft">
        <span class="h-4 w-4 animate-spin rounded-full border-2 border-line/20 border-t-brand-text" /> Checking account…
      </div>
      <div v-else-if="form.account_name" class="flex items-center gap-2.5 rounded-2xl bg-pos-soft px-4 py-3 text-sm text-pos">
        <Icon name="checkCircle" :size="18" /><span class="font-semibold">{{ form.account_name }}</span>
      </div>
      <p v-else-if="lookupError" class="rounded-2xl bg-neg-soft px-4 py-3 text-sm text-neg">{{ lookupError }}</p>
      <p v-else class="hint">We'll confirm the account name with the bank.</p>
    </div>
    <div v-else>
      <label class="label" for="acctname">Account name</label>
      <input id="acctname" v-model="form.account_name" class="input" required />
    </div>
    <slot />
    <button class="btn-primary w-full" :disabled="busy || !ready">{{ busy ? 'Saving…' : submitLabel }}</button>
  </form>

  <Sheet :open="picking" title="Choose bank" @close="picking = false">
    <div class="relative">
      <Icon name="search" :size="18" class="absolute left-4 top-1/2 -translate-y-1/2 text-ink-faint" />
      <input v-model="q" class="input pl-11" placeholder="Search banks" type="search" autofocus />
    </div>
    <div class="mt-3 max-h-[55vh] overflow-y-auto divide-soft">
      <button v-for="b in filtered" :key="b.code" type="button" class="flex w-full items-center justify-between px-1 py-3 text-left text-[15px]" @click="choose(b)">
        <span>{{ b.name }}</span><Icon v-if="b.code === form.bank_code" name="check" class="text-brand-text" />
      </button>
      <p v-if="!filtered.length" class="py-6 text-center text-sm text-ink-soft">No bank matches “{{ q }}”.</p>
    </div>
  </Sheet>
</template>
