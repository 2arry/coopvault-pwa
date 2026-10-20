<script setup>
import { ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { current } from '../../store'
import PageHeader from '../../components/PageHeader.vue'
import Reviews from './Reviews.vue'
import Members from './Members.vue'
import Settings from './Settings.vue'

const route = useRoute()
const router = useRouter()
const tabs = [
  { key: 'reviews', label: 'To review', component: Reviews },
  { key: 'members', label: 'Members', component: Members },
  { key: 'settings', label: 'Settings', component: Settings },
]
const tab = ref(tabs.some((t) => t.key === route.query.tab) ? route.query.tab : 'reviews')
watch(tab, (t) => router.replace({ query: { tab: t } }))
</script>

<template>
  <div>
    <PageHeader title="Manage" :subtitle="current?.cooperative_name" />
    <div class="px-5">
      <div class="grid grid-cols-3 gap-1 rounded-xl bg-black/5 p-1 text-sm font-semibold">
        <button v-for="t in tabs" :key="t.key" class="rounded-lg py-2" :class="tab === t.key ? 'bg-white shadow-sm' : 'text-ink-soft'" @click="tab = t.key">{{ t.label }}</button>
      </div>
    </div>
    <div class="px-5 pb-8 pt-4">
      <KeepAlive><component :is="tabs.find((t) => t.key === tab).component" /></KeepAlive>
    </div>
  </div>
</template>
