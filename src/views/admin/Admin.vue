<script setup>
import { ref, watch, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { current, dashboard, isOwner } from '../../store'
import PageHeader from '../../components/PageHeader.vue'
import Overview from './Overview.vue'
import Reviews from './Reviews.vue'
import Members from './Members.vue'
import Settings from './Settings.vue'

const route = useRoute()
const router = useRouter()
const pending = computed(() => Object.values(dashboard.value?.pending || {}).reduce((a, b) => a + b, 0))
// Settings (rules, bank account, roles) belong to Admins; the treasurer runs the day-to-day.
const tabs = computed(() => [
  { key: 'overview', label: 'Overview', component: Overview },
  { key: 'reviews', label: 'Review', component: Reviews },
  { key: 'members', label: 'Members', component: Members },
  ...(isOwner.value ? [{ key: 'settings', label: 'Settings', component: Settings }] : []),
])
const known = (t) => tabs.value.some((x) => x.key === t)
const tab = ref(known(route.query.tab) ? route.query.tab : 'overview')
watch(tab, (t) => router.replace({ query: { tab: t } }))
watch(() => route.query.tab, (t) => { if (t && known(t)) tab.value = t })
watch(tabs, () => { if (!known(tab.value)) tab.value = 'overview' })
</script>

<template>
  <div>
    <PageHeader title="Manage" :subtitle="current?.cooperative_name" />
    <div class="sticky top-[calc(env(safe-area-inset-top,0px)+60px)] z-20 bg-paper/85 px-5 pb-3 backdrop-blur-xl">
      <div class="seg" :class="tabs.length === 4 ? 'grid-cols-4' : 'grid-cols-3'">
        <button v-for="t in tabs" :key="t.key" class="flex items-center justify-center gap-1" :class="{ on: tab === t.key }" @click="tab = t.key">
          {{ t.label }}
          <span v-if="t.key === 'reviews' && pending" class="grid h-[18px] min-w-[18px] place-items-center rounded-full bg-accent px-1 text-[10px] font-bold text-white">{{ pending }}</span>
        </button>
      </div>
    </div>
    <div class="px-5 pb-8 pt-2">
      <KeepAlive><component :is="tabs.find((t) => t.key === tab)?.component || Overview" @goto="tab = $event" /></KeepAlive>
    </div>
  </div>
</template>
