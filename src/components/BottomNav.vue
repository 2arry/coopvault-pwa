<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { isAdmin, dashboard } from '../store'
import Icon from './Icon.vue'

const route = useRoute()
const pending = computed(() => Object.values(dashboard.value?.pending || {}).reduce((a, b) => a + b, 0))
const tabs = computed(() => [
  { to: '/home', tab: 'home', label: 'Home', icon: 'home' },
  { to: '/activity', tab: 'activity', label: 'Activity', icon: 'activity' },
  { to: '/loans', tab: 'loans', label: 'Loans', icon: 'loans' },
  ...(isAdmin.value ? [{ to: '/admin', tab: 'admin', label: 'Manage', icon: 'admin', badge: pending.value }] : []),
  { to: '/profile', tab: 'profile', label: 'Me', icon: 'user' },
])
</script>

<template>
  <nav class="fixed inset-x-0 bottom-0 z-40 border-t border-line/[0.07] bg-card/90 backdrop-blur-xl pb-safe" aria-label="Main">
    <div class="mx-auto flex max-w-lg">
      <RouterLink v-for="t in tabs" :key="t.tab" :to="t.to"
        class="relative flex flex-1 flex-col items-center gap-1 pb-1 pt-2.5 text-[11px] font-semibold transition"
        :class="route.meta.tab === t.tab ? 'text-brand-text' : 'text-ink-faint hover:text-ink-soft'"
        :aria-current="route.meta.tab === t.tab ? 'page' : undefined">
        <span class="relative rounded-full px-4 py-1 transition" :class="route.meta.tab === t.tab ? 'bg-brand-soft' : ''">
          <Icon :name="t.icon" :size="21" :stroke="route.meta.tab === t.tab ? 2.2 : 1.8" />
          <span v-if="t.badge" class="absolute -right-0.5 -top-1 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-gold px-1 text-[10px] font-bold text-forest-950">{{ t.badge > 9 ? '9+' : t.badge }}</span>
        </span>
        {{ t.label }}
      </RouterLink>
    </div>
  </nav>
</template>
