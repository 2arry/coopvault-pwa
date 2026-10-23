<script setup>
// Officers add someone who isn't on the app yet (e.g. from the old WhatsApp list). New accounts
// get a one-time setup code to pass on; the member picks their own password with it.
import { ref, computed, watch } from 'vue'
import * as api from '../api'
import { current, copyText, shareText, toast } from '../store'
import { appUrl, firstName, whatsappLink } from '../format'
import ErrorBox from './ErrorBox.vue'
import Sheet from './Sheet.vue'
import Icon from './Icon.vue'

const props = defineProps({ open: Boolean, code: Object }) // code: a new setup code to show for an existing member
const emit = defineEmits(['close', 'added'])
const form = ref({ full_name: '', phone: '' })
const result = ref(null)
const busy = ref(false)
const error = ref('')

watch(() => props.open, (open) => {
  if (!open) return
  form.value = { full_name: '', phone: '' }
  error.value = ''
  result.value = props.code || null
})

async function add() {
  busy.value = true
  error.value = ''
  try {
    result.value = await api.post('coop.add_member', { cooperative: current.value.cooperative, ...form.value })
    emit('added', result.value)
    if (!result.value.setup_code) toast(`${result.value.full_name} already has an account and has been told.`)
  } catch (e) { error.value = e.message } finally { busy.value = false }
}

const message = computed(() => {
  const r = result.value
  if (!r?.setup_code) return ''
  const link = appUrl(`/forgot?setup=1&login=${encodeURIComponent(r.phone)}`)
  return `Hello ${firstName(r.full_name)}, you’ve been added to ${current.value.cooperative_name} on Cooperative360, where we keep our contributions and loans.\n\nTo set up your account, open ${link} and enter this code: ${r.setup_code}\n\nThen choose your own password. The code works once, for ${r.days} days.`
})
</script>

<template>
  <Sheet :open="open" :title="result?.setup_code ? 'Setup code' : 'Add a member'"
    :subtitle="result?.setup_code ? `Send this to ${result.full_name}. They sign in with their phone number and choose their own password.` : 'For someone who isn’t on the app yet. They get a code to set up their account. No email needed.'"
    @close="emit('close')">
    <template v-if="result?.setup_code">
      <p class="money rounded-3xl bg-sunk py-5 text-center text-4xl tracking-[0.2em]">{{ result.setup_code }}</p>
      <p class="mt-2 text-center text-xs text-ink-soft">For {{ result.phone }} · works once, for {{ result.days }} days</p>
      <div class="mt-4 grid grid-cols-2 gap-2">
        <button class="btn-secondary" @click="copyText(message, 'Message copied')"><Icon name="copy" :size="16" /> Copy message</button>
        <a :href="whatsappLink(result.phone, message)" target="_blank" rel="noopener" class="btn-primary"><Icon name="chat" :size="16" /> WhatsApp</a>
      </div>
      <button class="btn-ghost mt-2 w-full text-sm" @click="shareText(message)"><Icon name="share" :size="16" /> Share another way</button>
      <p v-if="result.status === 'Pending'" class="mt-3 flex gap-2 rounded-2xl bg-info-soft p-3 text-xs text-info"><Icon name="info" :size="14" class="mt-0.5 shrink-0" /> They’ll be a member once an officer who approves new members says yes in Review.</p>
      <p class="mt-3 text-xs text-ink-soft">Only share it with them. Anyone with the code and their phone number could set up the account.</p>
      <button v-if="!code" class="btn-secondary mt-4 w-full" @click="result = null; form = { full_name: '', phone: '' }"><Icon name="userPlus" :size="16" /> Add someone else</button>
    </template>
    <form v-else class="space-y-4" @submit.prevent="add">
      <div><label class="label" for="am-name">Full name</label><input id="am-name" v-model="form.full_name" class="input" required autocomplete="off" /></div>
      <div><label class="label" for="am-phone">Phone number</label><input id="am-phone" v-model="form.phone" class="input num" type="tel" inputmode="tel" required placeholder="0803 123 4567" autocomplete="off" />
        <p class="hint">They’ll sign in with this number.</p></div>
      <ErrorBox :message="error" />
      <button class="btn-primary w-full" :disabled="busy">{{ busy ? 'Adding…' : 'Add member' }}</button>
    </form>
  </Sheet>
</template>
