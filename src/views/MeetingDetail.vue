<script setup>
import { ref, computed, onMounted } from 'vue'
import * as api from '../api'
import { toast } from '../store'
import { date, dateTime, relative } from '../format'
import PageHeader from '../components/PageHeader.vue'
import Loader from '../components/Loader.vue'
import ErrorBox from '../components/ErrorBox.vue'
import Sheet from '../components/Sheet.vue'
import Icon from '../components/Icon.vue'
import MeetingForm from '../components/MeetingForm.vue'

const props = defineProps({ name: String })
const m = ref(null)
const error = ref('')
const busy = ref(false)
const editing = ref(false)
const cancelling = ref(false)
const cancelNote = ref('')
const taking = ref(false)
const present = ref([])
const draft = ref(null) // { minutes, resolutions }
const publishing = ref(false)
const OUTCOMES = ['Passed', 'Not passed', 'Deferred']

async function load() {
  try { m.value = await api.get('meetings.get_meeting', { name: props.name }) } catch (e) { error.value = e.message }
}
onMounted(load)

const started = computed(() => m.value && new Date(String(m.value.starts_at).replace(' ', 'T')) - Date.now() < 3600 * 1000)
const canTakeAttendance = computed(() => m.value?.can_manage && !m.value.minutes_published && m.value.status !== 'Cancelled' && started.value)
const writingMinutes = computed(() => m.value?.can_manage && m.value.status === 'Held' && !m.value.minutes_published)
const coming = computed(() => (m.value?.attendance || []).filter((a) => a.response === 'Coming'))
const there = computed(() => (m.value?.attendance || []).filter((a) => a.present))

async function act(method, args, done) {
  busy.value = true
  try {
    m.value = await api.post(`meetings.${method}`, { name: props.name, ...args })
    if (done) toast(done)
    return true
  } catch (e) { toast(e.message, 'error') } finally { busy.value = false }
}
const reply = (response) => act('reply', { response }, response === 'Coming' ? 'Thanks. The secretary knows you’re coming.' : 'Apologies sent.')

function openAttendance() {
  const ticked = there.value.length ? there.value : coming.value
  present.value = ticked.map((a) => a.member)
  taking.value = true
}
async function saveAttendance() {
  if (await act('record_attendance', { present: present.value }, 'Attendance saved')) {
    taking.value = false
    startMinutes()
  }
}
function startMinutes() {
  draft.value = { minutes: m.value.minutes || '', resolutions: (m.value.resolutions || []).map((r) => ({ ...r })) }
}
const addResolution = () => draft.value.resolutions.push({ resolution: '', outcome: 'Passed', votes_for: null, votes_against: null, abstained: null })
async function saveMinutes(publish) {
  const ok = await act('save_minutes', { ...draft.value, publish: publish ? 1 : 0 }, publish ? 'Minutes published. Every member has been told.' : 'Draft saved')
  if (ok) {
    publishing.value = false
    if (publish) draft.value = null
  }
}
async function cancel() {
  if (await act('cancel_meeting', { note: cancelNote.value }, 'Meeting cancelled. Members have been told.')) cancelling.value = false
}
const votes = (r) => [r.votes_for != null && `${r.votes_for} for`, r.votes_against != null && `${r.votes_against} against`, r.abstained && `${r.abstained} abstained`].filter(Boolean).join(' · ')
const printPage = () => window.print()
const outcomeTone = (o) => (o === 'Passed' ? 'bg-pos-soft text-pos' : o === 'Not passed' ? 'bg-neg-soft text-neg' : 'bg-sunk text-ink-soft')
</script>

<template>
  <div>
    <PageHeader :title="m?.title || 'Meeting'" :subtitle="m?.kind" back="/meetings" />
    <div class="space-y-4 px-5 pb-12 pt-1">
      <ErrorBox :message="error" />
      <Loader v-if="!m && !error" />
      <template v-if="m">
        <section class="card p-5">
          <div class="flex items-start justify-between gap-3">
            <div>
              <p class="text-[17px] font-semibold">{{ dateTime(m.starts_at) }}</p>
              <p v-if="m.venue" class="mt-0.5 text-sm text-ink-soft">{{ m.venue }}</p>
            </div>
            <span v-if="m.status !== 'Scheduled'" class="chip" :class="m.status === 'Held' ? 'bg-pos-soft text-pos' : 'bg-sunk text-ink-soft'">{{ m.status }}</span>
          </div>
          <div v-if="m.agenda" class="mt-4 border-t border-line/[0.07] pt-3">
            <p class="text-xs font-semibold text-ink-soft">Agenda</p>
            <p class="mt-1 whitespace-pre-line text-sm">{{ m.agenda }}</p>
          </div>
          <p class="mt-4 text-xs text-ink-soft">{{ m.counts.coming }} coming · {{ m.counts.apologies }} apologies · {{ m.counts.members }} members<template v-if="m.status === 'Held'"> · {{ m.counts.present }} were there</template></p>

          <div v-if="m.can_reply" class="mt-4 grid grid-cols-2 gap-2">
            <button class="btn-sm" :class="m.my_response === 'Coming' ? 'btn-primary' : 'btn-secondary'" :disabled="busy" :aria-pressed="m.my_response === 'Coming'" @click="reply('Coming')"><Icon name="check" :size="16" /> I’ll be there</button>
            <button class="btn-sm" :class="m.my_response === 'Apology' ? 'btn-primary' : 'btn-secondary'" :disabled="busy" :aria-pressed="m.my_response === 'Apology'" @click="reply('Apology')">Send apologies</button>
          </div>
          <div v-if="m.can_manage && m.status === 'Scheduled'" class="mt-3 flex flex-wrap gap-2">
            <button class="btn-secondary btn-sm" @click="editing = true"><Icon name="edit" :size="15" /> Change</button>
            <button v-if="canTakeAttendance" class="btn-primary btn-sm" @click="openAttendance"><Icon name="users" :size="15" /> Take attendance</button>
            <button class="btn-ghost btn-sm text-neg" @click="cancelling = true; cancelNote = ''">Cancel meeting</button>
          </div>
        </section>

        <section v-if="m.status === 'Scheduled' && coming.length" class="card p-4">
          <p class="text-xs font-semibold text-ink-soft">Coming</p>
          <p class="mt-1 text-sm">{{ coming.map((a) => a.member_name).join(', ') }}</p>
        </section>

        <!-- Minutes being written -->
        <section v-if="writingMinutes" class="space-y-3">
          <div class="flex items-center justify-between">
            <h2 class="section-title">Minutes</h2>
            <button v-if="canTakeAttendance" class="text-xs font-semibold link" @click="openAttendance">Attendance ({{ m.counts.present }})</button>
          </div>
          <template v-if="draft">
            <textarea v-model="draft.minutes" rows="8" class="input" aria-label="Minutes" placeholder="What was discussed and agreed, in plain words." />
            <div v-for="(r, i) in draft.resolutions" :key="i" class="card space-y-3 p-4">
              <div class="flex items-start gap-2">
                <textarea v-model="r.resolution" rows="2" class="input flex-1" :aria-label="`Resolution ${i + 1}`" placeholder="Resolved that…" />
                <button type="button" class="grid h-10 w-10 place-items-center rounded-xl text-ink-faint hover:text-neg" aria-label="Remove resolution" @click="draft.resolutions.splice(i, 1)"><Icon name="trash" :size="17" /></button>
              </div>
              <div class="seg grid-cols-3 text-[13px]">
                <button v-for="o in OUTCOMES" :key="o" type="button" :class="{ on: r.outcome === o }" @click="r.outcome = o">{{ o }}</button>
              </div>
              <div class="grid grid-cols-3 gap-2">
                <div><label class="label text-xs" :for="`rf-${i}`">For</label><input :id="`rf-${i}`" v-model.number="r.votes_for" type="number" min="0" class="input num py-2" /></div>
                <div><label class="label text-xs" :for="`ra-${i}`">Against</label><input :id="`ra-${i}`" v-model.number="r.votes_against" type="number" min="0" class="input num py-2" /></div>
                <div><label class="label text-xs" :for="`rb-${i}`">Abstained</label><input :id="`rb-${i}`" v-model.number="r.abstained" type="number" min="0" class="input num py-2" /></div>
              </div>
            </div>
            <button type="button" class="btn-secondary btn-sm w-full" @click="addResolution"><Icon name="plus" :size="15" /> Add a resolution</button>
            <div class="grid grid-cols-2 gap-2">
              <button class="btn-secondary" :disabled="busy" @click="saveMinutes(false)">Save draft</button>
              <button class="btn-primary" :disabled="busy || draft.minutes.trim().length < 20" @click="publishing = true">Publish</button>
            </div>
            <p class="hint">Published minutes go to every member and can’t be changed afterwards. A correction goes in the next meeting’s minutes.</p>
          </template>
          <button v-else class="btn-primary w-full" @click="startMinutes"><Icon name="clipboard" :size="17" /> {{ m.minutes ? 'Continue the minutes' : 'Write the minutes' }}</button>
        </section>

        <!-- Published minutes -->
        <section v-if="m.minutes_published" class="card p-5 print:shadow-none">
          <div class="flex items-center justify-between">
            <h2 class="section-title">Minutes</h2>
            <button class="text-xs font-semibold link print:hidden" @click="printPage"><Icon name="download" :size="13" /> Print or save as PDF</button>
          </div>
          <p class="mt-2 whitespace-pre-line text-sm leading-relaxed">{{ m.minutes }}</p>
          <div v-if="m.resolutions?.length" class="mt-4 space-y-2 border-t border-line/[0.07] pt-3">
            <p class="text-xs font-semibold text-ink-soft">Resolutions</p>
            <div v-for="(r, i) in m.resolutions" :key="i" class="rounded-2xl bg-sunk p-3">
              <div class="flex items-start justify-between gap-3">
                <p class="text-sm">{{ i + 1 }}. {{ r.resolution }}</p>
                <span class="chip shrink-0" :class="outcomeTone(r.outcome)">{{ r.outcome }}</span>
              </div>
              <p v-if="votes(r)" class="num mt-1 text-xs text-ink-soft">{{ votes(r) }}</p>
            </div>
          </div>
          <p v-if="there.length" class="mt-4 text-xs text-ink-soft"><b class="text-ink">Present ({{ there.length }}):</b> {{ there.map((a) => a.member_name).join(', ') }}</p>
          <p class="mt-3 text-xs text-ink-faint">Published {{ relative(m.published_on) }}<template v-if="m.minutes_by"> by {{ m.minutes_by }}</template> · {{ date(m.published_on) }}</p>
        </section>
        <p v-else-if="m.status === 'Held' && !m.can_manage" class="rounded-3xl bg-sunk p-4 text-sm text-ink-soft">The secretary is writing the minutes. You’ll be told when they’re ready.</p>
      </template>
    </div>

    <MeetingForm :open="editing" :meeting="m" @close="editing = false" @saved="(x) => (m = x)" />

    <Sheet :open="taking" title="Who’s here?" subtitle="Tick everyone at the meeting. You can correct it until the minutes are published." @close="taking = false">
      <div class="card divide-soft max-h-[50vh] overflow-y-auto">
        <label v-for="p in m?.members || []" :key="p.name" class="flex items-center gap-3 p-3.5">
          <input v-model="present" type="checkbox" :value="p.name" class="h-5 w-5 accent-[rgb(var(--brand))]" />
          <span class="flex-1 text-[15px]">{{ p.full_name }}</span>
          <span class="num text-xs text-ink-faint">{{ p.member_number }}</span>
        </label>
      </div>
      <button class="btn-primary mt-4 w-full" :disabled="busy" @click="saveAttendance">Save attendance ({{ present.length }})</button>
    </Sheet>

    <Sheet :open="publishing" title="Publish the minutes?" subtitle="Every member will be able to read them, and they can’t be changed afterwards." @close="publishing = false">
      <div class="grid grid-cols-2 gap-3">
        <button class="btn-secondary" @click="publishing = false">Not yet</button>
        <button class="btn-primary" :disabled="busy" @click="saveMinutes(true)">Publish</button>
      </div>
    </Sheet>

    <Sheet :open="cancelling" title="Cancel this meeting?" subtitle="Every member is told." @close="cancelling = false">
      <div class="space-y-4">
        <div><label class="label" for="cn">Why <span class="font-normal text-ink-faint">(optional, members see this)</span></label><input id="cn" v-model="cancelNote" class="input" placeholder="e.g. Moved because of the holiday" /></div>
        <div class="grid grid-cols-2 gap-3">
          <button class="btn-secondary" @click="cancelling = false">Keep it</button>
          <button class="btn-danger" :disabled="busy" @click="cancel">Cancel meeting</button>
        </div>
      </div>
    </Sheet>
  </div>
</template>
