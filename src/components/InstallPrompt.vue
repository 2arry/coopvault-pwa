<script setup>
// Encourages installing the PWA (shown on Home until dismissed, and always on Profile).
import { ref, computed } from 'vue'
import { installEvent, isIOS, isStandalone, dismissed, dismiss, promptInstall } from '../install'
import Icon from './Icon.vue'

const props = defineProps({ persistent: Boolean })
const hidden = ref(!props.persistent && dismissed())
const show = computed(() => !isStandalone && !hidden.value && (isIOS || installEvent.value))

function close() {
  hidden.value = true
  dismiss()
}
async function install() {
  if (await promptInstall()) close()
}
</script>

<template>
  <div v-if="show" class="card flex items-start gap-3.5 p-4">
    <img src="/pwa-64x64.png" alt="" class="h-11 w-11 rounded-2xl shadow-sm" />
    <div class="flex-1 text-sm">
      <p class="font-semibold">Put CoopVault on your home screen</p>
      <p v-if="isIOS && !installEvent" class="mt-0.5 text-ink-soft">In Safari, tap <b>Share</b> <Icon name="share" :size="14" class="-mt-1 inline" /> then <b>Add to Home Screen</b>.</p>
      <p v-else class="mt-0.5 text-ink-soft">Opens like an app. No app store, no big download.</p>
      <button v-if="installEvent" class="btn-primary btn-sm mt-3" @click="install"><Icon name="download" :size="16" /> Install</button>
    </div>
    <button v-if="!persistent" class="-m-1 p-1 text-ink-faint" aria-label="Dismiss" @click="close"><Icon name="x" :size="18" /></button>
  </div>
</template>
