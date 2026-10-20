<script setup>
import Icon from './Icon.vue'
const model = defineModel()
defineProps({ options: Array })
</script>

<template>
  <div class="grid gap-2" :style="{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }">
    <button v-for="o in options" :key="o.value" type="button"
      class="flex flex-col items-center gap-1 rounded-xl border px-2 py-3 text-xs font-semibold transition"
      :class="model === o.value ? 'border-brand-700 bg-brand-50 text-brand-900 ring-2 ring-brand-100' : 'border-black/10 bg-white text-ink-soft'"
      @click="model = o.value">
      <Icon :name="o.icon" :size="22" />
      {{ o.label }}
    </button>
  </div>
</template>
