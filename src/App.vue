<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { state, isLoggedIn } from './store'
import BottomNav from './components/BottomNav.vue'
import Icon from './components/Icon.vue'

const route = useRoute()
const showNav = computed(() => isLoggedIn.value && route.meta.tab)
const fullWidth = computed(() => route.meta.landing)
</script>

<template>
  <div :class="fullWidth ? '' : ['mx-auto min-h-screen max-w-lg', showNav ? 'pb-28' : '']">
    <RouterView v-slot="{ Component }">
      <Transition name="fade" mode="out-in">
        <component :is="Component" :key="$route.path" />
      </Transition>
    </RouterView>
    <BottomNav v-if="showNav" />
  </div>
  <Transition name="fade">
    <div v-if="state.toast" class="pointer-events-none fixed inset-x-0 top-0 z-[60] flex justify-center px-4 pt-safe" role="status" aria-live="polite">
      <div class="mt-3 flex max-w-md items-center gap-2.5 rounded-2xl px-4 py-3 text-sm font-medium shadow-lift"
        :class="state.toast.kind === 'error' ? 'bg-neg text-white' : 'bg-forest-900 text-white'">
        <Icon :name="state.toast.kind === 'error' ? 'alert' : 'checkCircle'" :size="18" />
        {{ state.toast.message }}
      </div>
    </div>
  </Transition>
</template>
