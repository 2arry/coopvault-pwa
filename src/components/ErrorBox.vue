<script setup>
import Icon from './Icon.vue'
defineProps({ message: String })
</script>

<template>
  <div v-if="message" class="flex gap-2 rounded-xl bg-red-50 px-3.5 py-3 text-sm text-red-800 whitespace-pre-line" role="alert">
    <Icon name="alert" :size="18" class="mt-0.5 shrink-0" />
    <span>{{ message }}</span>
  </div>
</template>
