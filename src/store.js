import { reactive, computed } from 'vue'
import * as api from './api'
import { forgetDevice } from './push'

const COOP_KEY = 'coopvault.cooperative'
const THEME_KEY = 'coopvault.theme'
const SEEN_KEY = 'coopvault.seenAnnouncements'

function safeGet(k) { try { return localStorage.getItem(k) } catch { return null } }
function safeSet(k, v) { try { v ? localStorage.setItem(k, v) : localStorage.removeItem(k) } catch {} }

export const state = reactive({
  token: api.getToken(), // mirrored here so login state is reactive (localStorage is not)
  user: null,
  memberships: [],
  currentId: safeGet(COOP_KEY),
  paystack: { enabled: false },
  dashboards: {}, // cooperative -> last dashboard payload, so screens render instantly
  loaded: false,
  toast: null,
  theme: safeGet(THEME_KEY) || 'system',
})

export const isLoggedIn = computed(() => !!state.token && !!state.user)

export const current = computed(() => {
  const list = state.memberships
  return list.find((m) => m.cooperative === state.currentId) || list.find((m) => m.status === 'Active') || list[0] || null
})
export const currency = computed(() => current.value?.currency || 'NGN')
// Officers (any role but Member) see Manage; what each can do there comes from the server's
// capabilities for their role (settings, pay_out, record, books, journal, close, loans, …)
export const ROLES = ['Member', 'Treasurer', 'Accountant', 'Loan Officer', 'Secretary', 'Chairman', 'Admin']
export const isAdmin = computed(() => current.value?.status === 'Active' && !!current.value?.role && current.value.role !== 'Member')
export const isOwner = computed(() => current.value?.status === 'Active' && current.value?.role === 'Admin')
export const can = (capability) => current.value?.status === 'Active' && (current.value?.capabilities || []).includes(capability)
// Cooperative360's own team: the platform console (no access to any group's money)
export const isPlatform = computed(() => !!state.user?.is_platform)
export const isDemo = computed(() => !!state.paystack?.test_mode)
export const dashboard = computed(() => (current.value ? state.dashboards[current.value.cooperative] : null))

export function selectCooperative(id) {
  state.currentId = id
  safeSet(COOP_KEY, id)
}

export async function loadSession() {
  if (!state.token) {
    state.loaded = true
    // Still worth knowing whether this is the demo (Paystack test mode) for the banner
    api.get('payments.config').then((c) => { state.paystack = c }).catch(() => {})
    return
  }
  try {
    const [me, paystack] = await Promise.all([api.get('auth.me'), api.get('payments.config').catch(() => ({ enabled: false }))])
    state.user = me.user
    state.memberships = me.cooperatives
    state.paystack = paystack
    if (current.value) selectCooperative(current.value.cooperative)
  } catch (e) {
    if (e.status === 401) logout()
    else throw e
  } finally {
    state.loaded = true
  }
}

export async function refreshMemberships() {
  const me = await api.get('auth.me')
  state.user = me.user
  state.memberships = me.cooperatives
}

/** Fetch (and cache) the dashboard for the current cooperative. */
export async function loadDashboard() {
  const coop = current.value?.cooperative
  if (!coop) return null
  const data = await api.get('coop.get_dashboard', { cooperative: coop })
  state.dashboards[coop] = data
  return data
}

export function startSession(payload) {
  api.setToken(payload.token)
  state.token = payload.token
  state.user = payload.user
}

/** End the session on the server too (which also stops push to this device); the local token is cleared either way. */
export async function signOut() {
  await forgetDevice()
  try { await api.post('auth.logout') } catch {}
  logout()
}

export function logout() {
  api.setToken(null)
  state.token = null
  state.user = null
  state.memberships = []
  state.dashboards = {}
  selectCooperative(null)
}

export function setTheme(theme) {
  state.theme = theme
  safeSet(THEME_KEY, theme === 'system' ? null : theme)
  if (theme === 'system') delete document.documentElement.dataset.theme
  else document.documentElement.dataset.theme = theme
}

export function lastSeenAnnouncement(coop) {
  try { return JSON.parse(safeGet(SEEN_KEY) || '{}')[coop] || '' } catch { return '' }
}
export function markAnnouncementsSeen(coop, creation) {
  try {
    const seen = JSON.parse(safeGet(SEEN_KEY) || '{}')
    seen[coop] = creation
    safeSet(SEEN_KEY, JSON.stringify(seen))
  } catch {}
}

let toastTimer
export function toast(message, kind = 'success') {
  state.toast = { message, kind }
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => (state.toast = null), 3800)
}

export async function copyText(text, message = 'Copied') {
  try {
    await navigator.clipboard.writeText(text)
    toast(message)
  } catch {
    toast('Copy failed. Press and hold to copy instead.', 'error')
  }
}

/** Native share sheet where available (great for WhatsApp), clipboard otherwise. */
export async function shareText(text, title = 'Cooperative360') {
  if (navigator.share) {
    try {
      await navigator.share({ title, text })
      return
    } catch (e) {
      if (e?.name === 'AbortError') return
    }
  }
  await copyText(text, 'Copied. Paste it in your WhatsApp group.')
}
