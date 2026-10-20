<script setup>
// Encourages installing the PWA: native prompt on Android/Chrome, instructions on iOS.
import { ref, onMounted } from 'vue'
import Icon from './Icon.vue'

const deferred = ref(null)
const show = ref(false)
const ios = /iphone|ipad|ipod/i.test(navigator.userAgent)
const standalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone

function dismissed() { try { return localStorage.getItem('coopvault.installDismissed') } catch { return null } }
function dismiss() {
  show.value = false
  try { localStorage.setItem('coopvault.installDismissed', '1') } catch {}
}

onMounted(() => {
  if (standalone || dismissed()) return
  if (window.__coopInstallEvent) deferred.value = window.__coopInstallEvent
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    deferred.value = e
    show.value = true
  })
  show.value = ios || !!deferred.value
})

async function install() {
  if (!deferred.value) return
  deferred.value.prompt()
  await deferred.value.userChoice
  deferred.value = null
  dismiss()
}
</script>

<template>
  <div v-if="show" class="card flex items-start gap-3 p-4">
    <img src="/pwa-64x64.png" alt="" class="h-10 w-10 rounded-xl" />
    <div class="flex-1 text-sm">
      <p class="font-semibold">Install CoopVault</p>
      <p v-if="ios && !deferred" class="text-ink-soft">Tap <b>Share</b> <Icon name="share" :size="14" class="inline -mt-1" /> then <b>Add to Home Screen</b>.</p>
      <p v-else class="text-ink-soft">Add it to your home screen for quick access.</p>
      <button v-if="deferred" class="btn-primary btn-sm mt-2" @click="install">Install app</button>
    </div>
    <button class="text-ink-faint" aria-label="Dismiss" @click="dismiss"><Icon name="x" :size="18" /></button>
  </div>
</template>
