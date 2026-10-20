import { reactive, computed } from 'vue'
import * as api from './api'

const COOP_KEY = 'coopvault.cooperative'

export const state = reactive({
  token: api.getToken(), // mirrored here so login state is reactive (localStorage is not)
  user: null,
  memberships: [],
  currentId: safeGet(COOP_KEY),
  paystack: { enabled: false },
  loaded: false,
  toast: null,
})

function safeGet(k) { try { return localStorage.getItem(k) } catch { return null } }
function safeSet(k, v) { try { v ? localStorage.setItem(k, v) : localStorage.removeItem(k) } catch {} }

export const isLoggedIn = computed(() => !!state.token && !!state.user)

export const current = computed(() => {
  const list = state.memberships
  return list.find((m) => m.cooperative === state.currentId) || list.find((m) => m.status === 'Active') || list[0] || null
})
export const currency = computed(() => current.value?.currency || 'NGN')
export const isAdmin = computed(() => current.value?.status === 'Active' && ['Admin', 'Treasurer'].includes(current.value?.role))

export function selectCooperative(id) {
  state.currentId = id
  safeSet(COOP_KEY, id)
}

export async function loadSession() {
  if (!state.token) {
    state.loaded = true
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

export function startSession(payload) {
  api.setToken(payload.token)
  state.token = payload.token
  state.user = payload.user
}

export function logout() {
  api.setToken(null)
  state.token = null
  state.user = null
  state.memberships = []
  selectCooperative(null)
}

let toastTimer
export function toast(message, kind = 'success') {
  state.toast = { message, kind }
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => (state.toast = null), 3800)
}
