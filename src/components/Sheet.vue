<script setup>
// Bottom sheet used for confirmations and small forms.
import { watch, onBeforeUnmount } from 'vue'
const props = defineProps({ open: Boolean, title: String, subtitle: String })
const emit = defineEmits(['close'])
const onKey = (e) => e.key === 'Escape' && emit('close')
watch(() => props.open, (open) => {
  document.body.style.overflow = open ? 'hidden' : ''
  open ? window.addEventListener('keydown', onKey) : window.removeEventListener('keydown', onKey)
})
onBeforeUnmount(() => {
  document.body.style.overflow = ''
  window.removeEventListener('keydown', onKey)
})
</script>

<template>
  <Teleport to="body">
    <Transition name="sheet">
      <div v-if="open" class="fixed inset-0 z-50 flex items-end justify-center bg-forest-950/40 backdrop-blur-[2px] sm:items-center sm:p-4" @click.self="emit('close')">
        <div class="sheet-panel max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-4xl bg-card p-5 pb-safe shadow-lift sm:rounded-4xl" role="dialog" aria-modal="true" :aria-label="title">
          <div class="mx-auto mb-4 h-1.5 w-10 rounded-full bg-line/10 sm:hidden" />
          <div v-if="title" class="mb-5">
            <h2 class="font-display text-xl font-semibold tracking-tight">{{ title }}</h2>
            <p v-if="subtitle" class="mt-1 text-sm text-ink-soft">{{ subtitle }}</p>
          </div>
          <slot />
          <div class="h-2" />
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
