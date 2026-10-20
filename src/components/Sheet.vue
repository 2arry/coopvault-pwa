<script setup>
// Bottom sheet used for confirmations and small forms.
defineProps({ open: Boolean, title: String })
const emit = defineEmits(['close'])
</script>

<template>
  <Teleport to="body">
    <Transition name="fade">
      <div v-if="open" class="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center" @click.self="emit('close')">
        <div class="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-white p-5 pb-safe sm:rounded-3xl" role="dialog" :aria-label="title">
          <div class="mx-auto mb-4 h-1 w-10 rounded-full bg-black/10 sm:hidden" />
          <h2 v-if="title" class="mb-4 text-lg font-bold">{{ title }}</h2>
          <slot />
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
