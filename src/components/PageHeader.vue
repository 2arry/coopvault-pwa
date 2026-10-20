<script setup>
import { useRouter } from 'vue-router'
import Icon from './Icon.vue'

const props = defineProps({ title: String, back: { type: [String, Boolean], default: false }, subtitle: String })
const router = useRouter()
function goBack() {
  if (window.history.state?.back) router.back()
  else router.push(typeof props.back === 'string' ? props.back : '/')
}
</script>

<template>
  <header class="sticky top-0 z-30 bg-paper/90 backdrop-blur pt-safe">
    <div class="flex items-center gap-2 px-4 py-3 min-h-[56px]">
      <button v-if="back" class="-ml-2 rounded-full p-2 hover:bg-black/5" aria-label="Back" @click="goBack">
        <Icon name="back" :size="22" />
      </button>
      <div class="min-w-0 flex-1">
        <h1 class="truncate text-lg font-bold">{{ title }}</h1>
        <p v-if="subtitle" class="truncate text-xs text-ink-soft">{{ subtitle }}</p>
      </div>
      <slot name="actions" />
    </div>
  </header>
</template>
