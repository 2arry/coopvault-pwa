// Shared "add to home screen" state: native prompt on Android/desktop Chrome, instructions on iOS.
import { ref } from 'vue'

const DISMISS_KEY = 'coopvault.installDismissed'
export const installEvent = ref(window.__coopInstallEvent || null)
export const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent)
export const isStandalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true

window.addEventListener('coopvault:installable', () => (installEvent.value = window.__coopInstallEvent))
window.addEventListener('appinstalled', () => (installEvent.value = null))

export const canPrompt = () => !!installEvent.value
export const dismissed = () => { try { return !!localStorage.getItem(DISMISS_KEY) } catch { return false } }
export const dismiss = () => { try { localStorage.setItem(DISMISS_KEY, '1') } catch {} }

export async function promptInstall() {
  const e = installEvent.value
  if (!e) return false
  e.prompt()
  const choice = await e.userChoice
  installEvent.value = null
  return choice?.outcome === 'accepted'
}
