<script setup>
import { ref, onMounted } from 'vue'
import * as api from '../api'
import { current, isAdmin, toast, markAnnouncementsSeen } from '../store'
import { relative } from '../format'
import PageHeader from '../components/PageHeader.vue'
import Sheet from '../components/Sheet.vue'
import Loader from '../components/Loader.vue'
import ErrorBox from '../components/ErrorBox.vue'
import Icon from '../components/Icon.vue'

const items = ref(null)
const error = ref('')
const composing = ref(false)
const removing = ref(null)
const form = ref({ title: '', message: '', pinned: false })
const busy = ref(false)

async function load() {
  try {
    items.value = await api.get('coop.list_announcements', { cooperative: current.value.cooperative })
    const newest = items.value.map((a) => a.creation).sort().pop()
    if (newest) markAnnouncementsSeen(current.value.cooperative, newest)
  } catch (e) { error.value = e.message }
}
async function post() {
  busy.value = true
  try {
    await api.post('coop.post_announcement', { cooperative: current.value.cooperative, ...form.value, pinned: form.value.pinned ? 1 : 0 })
    composing.value = false
    form.value = { title: '', message: '', pinned: false }
    toast('Posted to all members')
    await load()
  } catch (e) { toast(e.message, 'error') } finally { busy.value = false }
}
async function remove() {
  busy.value = true
  try {
    await api.post('coop.delete_announcement', { name: removing.value.name })
    items.value = items.value.filter((i) => i.name !== removing.value.name)
    removing.value = null
  } catch (e) { toast(e.message, 'error') } finally { busy.value = false }
}
onMounted(load)
</script>

<template>
  <div>
    <PageHeader title="Announcements" :subtitle="current?.cooperative_name" back="/home">
      <template #actions>
        <button v-if="isAdmin" class="btn-primary btn-sm" @click="composing = true"><Icon name="plus" :size="16" /> Post</button>
      </template>
    </PageHeader>
    <div class="space-y-3 px-5 pb-12">
      <ErrorBox :message="error" />
      <Loader v-if="!items && !error" />
      <div v-else-if="items && !items.length" class="card mt-2 p-8 text-center">
        <div class="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-sunk text-ink-soft"><Icon name="bell" :size="26" /></div>
        <p class="mt-4 font-semibold">No announcements yet</p>
        <p class="mt-1 text-sm text-ink-soft">{{ isAdmin ? 'Post meeting dates, rule changes or reminders. Every member sees them here.' : 'Updates from your admins will appear here.' }}</p>
      </div>
      <article v-for="a in items" :key="a.name" class="card p-5" :class="a.pinned ? 'ring-1 ring-accent/30' : ''">
        <div class="flex items-start gap-2">
          <div class="flex-1">
            <p v-if="a.pinned" class="mb-1 flex items-center gap-1 text-xs font-semibold text-accent-text"><Icon name="pin" :size="13" /> Pinned</p>
            <h2 class="font-display text-lg font-semibold leading-snug">{{ a.title }}</h2>
          </div>
          <button v-if="isAdmin && !a.is_system" class="-m-1 p-1 text-ink-faint hover:text-neg" aria-label="Delete announcement" @click="removing = a"><Icon name="trash" :size="18" /></button>
        </div>
        <p class="mt-2 whitespace-pre-line text-[15px] leading-relaxed text-ink-soft">{{ a.message }}</p>
        <p class="mt-3 text-xs text-ink-faint">{{ relative(a.creation) }}</p>
      </article>
    </div>
    <Sheet :open="composing" title="New announcement" subtitle="Every member sees this on their home screen." @close="composing = false">
      <form class="space-y-4" @submit.prevent="post">
        <input v-model="form.title" class="input" placeholder="Title, e.g. October meeting" required />
        <textarea v-model="form.message" rows="5" class="input" placeholder="What do members need to know?" required />
        <label class="flex items-center gap-2.5 text-sm"><input v-model="form.pinned" type="checkbox" class="h-5 w-5 accent-[rgb(var(--brand))]" /> Pin to the top</label>
        <button class="btn-primary w-full" :disabled="busy">Post to members</button>
      </form>
    </Sheet>
    <Sheet :open="!!removing" title="Delete this announcement?" @close="removing = null">
      <div class="grid grid-cols-2 gap-3">
        <button class="btn-secondary" @click="removing = null">Keep</button>
        <button class="btn-danger" :disabled="busy" @click="remove">Delete</button>
      </div>
    </Sheet>
  </div>
</template>
