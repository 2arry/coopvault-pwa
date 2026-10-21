<script setup>
import { ref } from 'vue'
import Icon from './Icon.vue'

const model = defineModel({ default: null })
const error = ref('')
function pick(e) {
  const file = e.target.files?.[0]
  error.value = ''
  if (!file) return
  if (file.size > 5 * 1024 * 1024) {
    error.value = 'File must be smaller than 5MB'
    e.target.value = ''
    return
  }
  model.value = file
}
</script>

<template>
  <div>
    <span class="label">Receipt or screenshot <span class="font-normal text-ink-faint">(helps the treasurer confirm faster)</span></span>
    <label class="flex cursor-pointer items-center gap-3 rounded-2xl border border-dashed border-line/20 bg-card px-4 py-3.5 text-sm transition hover:border-brand-text">
      <span class="grid h-9 w-9 place-items-center rounded-xl bg-brand-soft text-brand-text"><Icon :name="model ? 'file' : 'upload'" :size="18" /></span>
      <span class="flex-1 truncate" :class="model ? 'text-ink' : 'text-ink-faint'">{{ model ? model.name : 'Attach a photo or PDF' }}</span>
      <button v-if="model" type="button" class="text-ink-faint" aria-label="Remove file" @click.prevent="model = null"><Icon name="x" :size="18" /></button>
      <input type="file" accept="image/*,application/pdf" class="sr-only" @change="pick" />
    </label>
    <p v-if="error" class="hint text-neg">{{ error }}</p>
  </div>
</template>
