<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import * as api from '../api'
import { current } from '../store'
import { date, dateTime } from '../format'
import PageHeader from '../components/PageHeader.vue'
import Loader from '../components/Loader.vue'
import ErrorBox from '../components/ErrorBox.vue'
import Icon from '../components/Icon.vue'
import MeetingForm from '../components/MeetingForm.vue'

const router = useRouter()
const list = ref(null)
const error = ref('')
const calling = ref(false)

async function load() {
  try { list.value = await api.get('meetings.list_meetings', { cooperative: current.value.cooperative }) } catch (e) { error.value = e.message }
}
onMounted(load)
const day = (v) => date(v, { day: 'numeric' })
const month = (v) => date(v, { month: 'short' })
</script>

<template>
  <div>
    <PageHeader title="Meetings" :subtitle="current?.cooperative_name" back="/home" />
    <div class="space-y-5 px-5 pb-12 pt-1">
      <ErrorBox :message="error" />
      <Loader v-if="!list && !error" />
      <template v-if="list">
        <button v-if="list.can_manage" type="button" class="flex w-full items-center gap-3.5 rounded-3xl border border-dashed border-brand-text/40 bg-brand-soft/60 p-4 text-left" @click="calling = true">
          <span class="grid h-10 w-10 place-items-center rounded-2xl bg-card text-brand-text"><Icon name="plus" :size="19" /></span>
          <span class="flex-1"><b class="block text-[15px]">Call a meeting</b><span class="text-sm text-ink-soft">Everyone is told and reminded the day before</span></span>
        </button>

        <section>
          <h2 class="section-title">Coming up</h2>
          <div v-if="list.upcoming.length" class="mt-3 space-y-2">
            <RouterLink v-for="m in list.upcoming" :key="m.name" :to="`/meetings/${m.name}`" class="card flex items-center gap-4 p-4">
              <span class="grid w-12 shrink-0 rounded-2xl bg-info-soft py-1.5 text-center text-info">
                <span class="money text-xl leading-none">{{ day(m.starts_at) }}</span><span class="text-[11px] font-semibold uppercase">{{ month(m.starts_at) }}</span>
              </span>
              <span class="min-w-0 flex-1">
                <span class="block truncate text-[15px] font-semibold">{{ m.title }}</span>
                <span class="block truncate text-xs text-ink-soft">{{ dateTime(m.starts_at) }}<template v-if="m.venue"> · {{ m.venue }}</template></span>
                <span class="block text-xs text-ink-faint">{{ m.counts.coming }} coming · {{ m.counts.apologies }} apologies</span>
              </span>
              <span v-if="m.my_response" class="chip" :class="m.my_response === 'Coming' ? 'bg-pos-soft text-pos' : 'bg-sunk text-ink-soft'">{{ m.my_response === 'Coming' ? 'Coming' : 'Apology' }}</span>
              <Icon v-else name="chevron" :size="18" class="text-ink-faint" />
            </RouterLink>
          </div>
          <p v-else class="mt-2 text-sm text-ink-soft">No meetings planned yet.</p>
        </section>

        <section v-if="list.past.length">
          <h2 class="section-title">Earlier</h2>
          <div class="card mt-3 divide-soft">
            <RouterLink v-for="m in list.past" :key="m.name" :to="`/meetings/${m.name}`" class="flex items-center gap-3 p-4">
              <span class="min-w-0 flex-1">
                <span class="block truncate font-semibold" :class="m.status === 'Cancelled' ? 'text-ink-faint line-through' : ''">{{ m.title }}</span>
                <span class="block text-xs text-ink-soft">{{ date(m.starts_at) }}<template v-if="m.status === 'Held'"> · {{ m.counts.present }} present</template></span>
              </span>
              <span v-if="m.minutes_published" class="chip bg-pos-soft text-pos"><Icon name="clipboard" :size="12" /> Minutes</span>
              <span v-else-if="m.status === 'Cancelled'" class="chip bg-sunk text-ink-soft">Cancelled</span>
              <span v-else-if="m.status === 'Scheduled'" class="chip bg-warn-soft text-warn">Attendance not taken</span>
              <Icon name="chevron" :size="18" class="text-ink-faint" />
            </RouterLink>
          </div>
        </section>
      </template>
    </div>
    <MeetingForm :open="calling" @close="calling = false" @saved="(m) => router.push(`/meetings/${m.name}`)" />
  </div>
</template>
