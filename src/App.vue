<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { state, isLoggedIn } from './store'
import BottomNav from './components/BottomNav.vue'

const route = useRoute()
const showNav = computed(() => isLoggedIn.value && route.meta.tab)
</script>

<template>
  <div class="min-h-screen mx-auto max-w-lg" :class="showNav ? 'pb-24' : ''">
    <RouterView v-slot="{ Component }">
      <Transition name="fade" mode="out-in">
        <component :is="Component" :key="$route.fullPath" />
      </Transition>
    </RouterView>
    <BottomNav v-if="showNav" />
    <Transition name="fade">
      <div v-if="state.toast" class="fixed inset-x-0 top-0 z-50 flex justify-center px-4 pt-safe" role="status">
        <div class="mt-3 max-w-md rounded-xl px-4 py-3 text-sm font-medium shadow-lg"
          :class="state.toast.kind === 'error' ? 'bg-red-700 text-white' : 'bg-ink text-white'">
          {{ state.toast.message }}
        </div>
      </div>
    </Transition>
  </div>
</template>
