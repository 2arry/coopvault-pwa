<script setup>
// Call a meeting, or change the time, place or agenda of one that hasn't happened yet.
import { ref, watch } from 'vue'
import * as api from '../api'
import { current, toast } from '../store'
import { localInput } from '../format'
import ErrorBox from './ErrorBox.vue'
import Sheet from './Sheet.vue'

const props = defineProps({ open: Boolean, meeting: Object })
const emit = defineEmits(['close', 'saved'])
const KINDS = ['General meeting', 'Annual general meeting', 'Executive meeting', 'Special meeting']
const form = ref({})
const busy = ref(false)
const error = ref('')
const nowInput = () => localInput(new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString())

watch(() => props.open, (open) => {
  if (!open) return
  error.value = ''
  const m = props.meeting
  form.value = m ? { name: m.name, title: m.title, kind: m.kind, starts_at: localInput(m.starts_at), venue: m.venue || '', agenda: m.agenda || '' }
    : { title: '', kind: 'General meeting', starts_at: '', venue: '', agenda: '' }
})

async function save() {
  busy.value = true
  error.value = ''
  try {
    const m = await api.post('meetings.save_meeting', { cooperative: current.value.cooperative, ...form.value })
    toast(props.meeting ? 'Meeting updated. Members have been told about any change of time or place.' : 'Meeting called. Every member has been told.')
    emit('saved', m)
    emit('close')
  } catch (e) { error.value = e.message } finally { busy.value = false }
}
</script>

<template>
  <Sheet :open="open" :title="meeting ? 'Change the meeting' : 'Call a meeting'" subtitle="Members are told straight away and reminded the day before." @close="emit('close')">
    <form class="space-y-4" @submit.prevent="save">
      <div><label class="label" for="mf-title">Title</label><input id="mf-title" v-model="form.title" class="input" required placeholder="e.g. November meeting" /></div>
      <div>
        <label class="label" for="mf-kind">Kind</label>
        <select id="mf-kind" v-model="form.kind" class="input"><option v-for="k in KINDS" :key="k">{{ k }}</option></select>
      </div>
      <div><label class="label" for="mf-when">Date and time</label><input id="mf-when" v-model="form.starts_at" type="datetime-local" :min="nowInput()" class="input" required /></div>
      <div><label class="label" for="mf-venue">Where</label><input id="mf-venue" v-model="form.venue" class="input" placeholder="A place, or a link for an online meeting" /></div>
      <div><label class="label" for="mf-agenda">Agenda <span class="font-normal text-ink-faint">(optional)</span></label>
        <textarea id="mf-agenda" v-model="form.agenda" rows="4" class="input" placeholder="1. Accounts&#10;2. Loan requests&#10;3. Any other business" /></div>
      <ErrorBox :message="error" />
      <button class="btn-primary w-full" :disabled="busy">{{ meeting ? 'Save changes' : 'Call the meeting' }}</button>
    </form>
  </Sheet>
</template>
