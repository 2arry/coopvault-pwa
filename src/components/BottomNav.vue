<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { isAdmin } from '../store'
import Icon from './Icon.vue'

const route = useRoute()
const tabs = computed(() => [
  { to: '/', tab: 'home', label: 'Home', icon: 'home' },
  { to: '/history', tab: 'history', label: 'History', icon: 'history' },
  { to: '/loans', tab: 'loans', label: 'Loans', icon: 'loans' },
  ...(isAdmin.value ? [{ to: '/admin', tab: 'admin', label: 'Manage', icon: 'admin' }] : []),
  { to: '/profile', tab: 'profile', label: 'Me', icon: 'user' },
])
</script>

<template>
  <nav class="fixed inset-x-0 bottom-0 z-40 border-t border-black/5 bg-white/95 backdrop-blur pb-safe">
    <div class="mx-auto flex max-w-lg">
      <RouterLink v-for="t in tabs" :key="t.tab" :to="t.to"
        class="flex flex-1 flex-col items-center gap-0.5 pt-2.5 pb-1 text-[11px] font-semibold transition"
        :class="route.meta.tab === t.tab ? 'text-brand-800' : 'text-ink-faint'">
        <Icon :name="t.icon" :size="22" :stroke="route.meta.tab === t.tab ? 2.3 : 1.8" />
        {{ t.label }}
      </RouterLink>
    </div>
  </nav>
</template>
