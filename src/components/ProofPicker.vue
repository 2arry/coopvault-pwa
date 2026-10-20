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
    <label class="label">Proof of payment <span class="font-normal text-ink-faint">(optional)</span></label>
    <label class="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-black/15 bg-white px-3.5 py-3 text-sm hover:border-brand-600">
      <Icon :name="model ? 'file' : 'upload'" class="text-brand-700" />
      <span class="flex-1 truncate" :class="model ? 'text-ink' : 'text-ink-faint'">{{ model ? model.name : 'Attach receipt or screenshot' }}</span>
      <button v-if="model" type="button" class="text-ink-faint" aria-label="Remove file" @click.prevent="model = null"><Icon name="x" :size="18" /></button>
      <input type="file" accept="image/*,application/pdf" class="sr-only" @change="pick" />
    </label>
    <p v-if="error" class="hint text-red-700">{{ error }}</p>
  </div>
</template>
