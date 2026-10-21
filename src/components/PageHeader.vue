<script setup>
import { useRouter } from 'vue-router'
import Icon from './Icon.vue'

const props = defineProps({ title: String, back: { type: [String, Boolean], default: false }, subtitle: String })
const router = useRouter()
function goBack() {
  if (window.history.state?.back) router.back()
  else router.push(typeof props.back === 'string' ? props.back : '/home')
}
</script>

<template>
  <header class="sticky top-0 z-30 bg-paper/85 backdrop-blur-xl pt-safe">
    <div class="flex min-h-[60px] items-center gap-2 px-4 py-2.5">
      <button v-if="back" class="-ml-1.5 grid h-10 w-10 place-items-center rounded-full text-ink hover:bg-line/5" aria-label="Back" @click="goBack">
        <Icon name="back" :size="22" />
      </button>
      <div class="min-w-0 flex-1" :class="back ? '' : 'pl-1'">
        <h1 class="truncate font-display text-[22px] font-semibold leading-tight tracking-tight">{{ title }}</h1>
        <p v-if="subtitle" class="truncate text-xs text-ink-soft">{{ subtitle }}</p>
      </div>
      <slot name="actions" />
    </div>
  </header>
</template>
