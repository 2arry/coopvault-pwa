<script setup>
import Icon from './Icon.vue'
defineProps({ message: String })
</script>

<template>
  <div v-if="message" class="flex gap-2.5 whitespace-pre-line rounded-2xl bg-neg-soft px-4 py-3 text-sm text-neg" role="alert">
    <Icon name="alert" :size="18" class="mt-0.5" />
    <span>{{ message }}</span>
  </div>
</template>
