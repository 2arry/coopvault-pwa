<script setup>
import { ref, watch, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { current, dashboard } from '../../store'
import PageHeader from '../../components/PageHeader.vue'
import Overview from './Overview.vue'
import Reviews from './Reviews.vue'
import Members from './Members.vue'
import Settings from './Settings.vue'

const route = useRoute()
const router = useRouter()
const pending = computed(() => Object.values(dashboard.value?.pending || {}).reduce((a, b) => a + b, 0))
const tabs = [
  { key: 'overview', label: 'Overview', component: Overview },
  { key: 'reviews', label: 'Review', component: Reviews },
  { key: 'members', label: 'Members', component: Members },
  { key: 'settings', label: 'Settings', component: Settings },
]
const tab = ref(tabs.some((t) => t.key === route.query.tab) ? route.query.tab : 'overview')
watch(tab, (t) => router.replace({ query: { tab: t } }))
watch(() => route.query.tab, (t) => { if (t && tabs.some((x) => x.key === t)) tab.value = t })
</script>

<template>
  <div>
    <PageHeader title="Manage" :subtitle="current?.cooperative_name" />
    <div class="sticky top-[calc(env(safe-area-inset-top,0px)+60px)] z-20 bg-paper/85 px-5 pb-3 backdrop-blur-xl">
      <div class="seg grid-cols-4">
        <button v-for="t in tabs" :key="t.key" class="flex items-center justify-center gap-1" :class="{ on: tab === t.key }" @click="tab = t.key">
          {{ t.label }}
          <span v-if="t.key === 'reviews' && pending" class="grid h-[18px] min-w-[18px] place-items-center rounded-full bg-gold px-1 text-[10px] font-bold text-forest-950">{{ pending }}</span>
        </button>
      </div>
    </div>
    <div class="px-5 pb-8 pt-2">
      <KeepAlive><component :is="tabs.find((t) => t.key === tab).component" @goto="tab = $event" /></KeepAlive>
    </div>
  </div>
</template>
