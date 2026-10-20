<script setup>
import { ref, onMounted } from 'vue'
import * as api from '../api'
import { current, isAdmin, toast } from '../store'
import { relative } from '../format'
import PageHeader from '../components/PageHeader.vue'
import Sheet from '../components/Sheet.vue'
import Loader from '../components/Loader.vue'
import ErrorBox from '../components/ErrorBox.vue'
import Icon from '../components/Icon.vue'

const items = ref(null)
const error = ref('')
const composing = ref(false)
const form = ref({ title: '', message: '', pinned: false })
const busy = ref(false)

async function load() {
  try { items.value = await api.get('coop.list_announcements', { cooperative: current.value.cooperative }) } catch (e) { error.value = e.message }
}
async function post() {
  busy.value = true
  try {
    await api.post('coop.post_announcement', { cooperative: current.value.cooperative, ...form.value, pinned: form.value.pinned ? 1 : 0 })
    composing.value = false
    form.value = { title: '', message: '', pinned: false }
    toast('Announcement posted')
    await load()
  } catch (e) { toast(e.message, 'error') } finally { busy.value = false }
}
async function remove(a) {
  try {
    await api.post('coop.delete_announcement', { name: a.name })
    items.value = items.value.filter((i) => i.name !== a.name)
  } catch (e) { toast(e.message, 'error') }
}
onMounted(load)
</script>

<template>
  <div>
    <PageHeader title="Announcements" back="/">
      <template #actions>
        <button v-if="isAdmin" class="btn-primary btn-sm" @click="composing = true"><Icon name="plus" :size="16" /> Post</button>
      </template>
    </PageHeader>
    <div class="space-y-3 px-5 pb-10">
      <ErrorBox :message="error" />
      <Loader v-if="!items && !error" />
      <p v-else-if="items && !items.length" class="mt-10 text-center text-sm text-ink-soft">No announcements yet.</p>
      <article v-for="a in items" :key="a.name" class="card p-4">
        <div class="flex items-start gap-2">
          <Icon v-if="a.pinned" name="pin" :size="16" class="mt-1 text-amber-600" />
          <h2 class="flex-1 font-bold">{{ a.title }}</h2>
          <button v-if="isAdmin" class="text-ink-faint" aria-label="Delete" @click="remove(a)"><Icon name="trash" :size="18" /></button>
        </div>
        <p class="mt-1 whitespace-pre-line text-sm text-ink-soft">{{ a.message }}</p>
        <p class="mt-2 text-xs text-ink-faint">{{ relative(a.creation) }}</p>
      </article>
    </div>
    <Sheet :open="composing" title="New announcement" @close="composing = false">
      <form class="space-y-4" @submit.prevent="post">
        <input v-model="form.title" class="input" placeholder="Title" required />
        <textarea v-model="form.message" rows="5" class="input" placeholder="Message to all members" required />
        <label class="flex items-center gap-2 text-sm"><input v-model="form.pinned" type="checkbox" class="h-4 w-4 accent-brand-700" /> Pin to top</label>
        <button class="btn-primary w-full" :disabled="busy">Post to members</button>
      </form>
    </Sheet>
  </div>
</template>
