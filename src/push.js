// Web Push: lets the server reach members when the app is closed (no email or SMS needed).
import * as api from './api'
import { isIOS, isStandalone } from './install'

export const pushSupported = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
// iPhones only allow push for apps added to the home screen
export const needsInstallForPush = isIOS && !isStandalone

function keyToBytes(base64) {
  const padded = (base64 + '='.repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(padded)
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)))
}

export async function currentSubscription() {
  if (!pushSupported) return null
  const reg = await navigator.serviceWorker.getRegistration()
  return reg ? reg.pushManager.getSubscription() : null
}

export async function enablePush() {
  if (!pushSupported) throw new Error('This browser can’t show notifications.')
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') throw new Error('Notifications are blocked. Allow them for this site in your browser settings.')
  const { public_key: key } = await api.get('notifications.push_config')
  const reg = await navigator.serviceWorker.ready
  const sub = (await reg.pushManager.getSubscription()) || (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyToBytes(key) }))
  await api.post('notifications.subscribe', { subscription: sub.toJSON() })
  return sub
}

/** Hide amounts and names on this phone's lock screen. */
export async function setDiscreet(on) {
  const sub = await currentSubscription()
  if (!sub) throw new Error('Turn on notifications on this phone first.')
  return api.post('notifications.set_privacy', { endpoint: sub.endpoint, discreet: on ? 1 : 0 })
}

export async function deviceStatus() {
  const sub = await currentSubscription().catch(() => null)
  if (!sub) return { subscribed: false, discreet: false }
  return api.get('notifications.device_status', { endpoint: sub.endpoint }).catch(() => ({ subscribed: true, discreet: false }))
}

/** Stop this browser receiving pushes (used when signing out). The server drops the subscription too. */
export async function forgetDevice() {
  const sub = await currentSubscription().catch(() => null)
  if (sub) await sub.unsubscribe().catch(() => {})
}

export async function disablePush() {
  const sub = await currentSubscription()
  if (!sub) return
  await api.post('notifications.unsubscribe', { endpoint: sub.endpoint }).catch(() => {})
  await sub.unsubscribe()
}
