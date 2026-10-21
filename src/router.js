import { createRouter, createWebHistory } from 'vue-router'
import { state, loadSession, isLoggedIn, current, isAdmin, logout } from './store'
import { setUnauthorizedHandler } from './api'

const JOIN_KEY = 'coopvault.joinCode'
// Resolved at build time so nested folders (views/admin/…) are code-split correctly
const pages = import.meta.glob('./views/**/*.vue')
const view = (path) => {
  const page = pages[`./views/${path}.vue`]
  if (!page) throw new Error(`Unknown view: ${path}`)
  return page
}

const routes = [
  { path: '/', component: view('Landing'), meta: { public: true, landing: true } },
  { path: '/login', component: view('Login'), meta: { guest: true } },
  { path: '/signup', component: view('Signup'), meta: { guest: true } },
  { path: '/forgot', component: view('Forgot'), meta: { guest: true } },
  { path: '/join/:code', redirect: (to) => ({ path: '/welcome', query: { code: to.params.code } }) },
  { path: '/welcome', component: view('Onboarding'), meta: { noCoop: true, inviteFriendly: true } },
  { path: '/home', component: view('Home'), meta: { tab: 'home' } },
  { path: '/save', component: view('Save') },
  { path: '/contribute', redirect: '/save' },
  { path: '/activity', component: view('Activity'), meta: { tab: 'activity' } },
  { path: '/history', redirect: '/activity' },
  { path: '/loans', component: view('Loans'), meta: { tab: 'loans' } },
  { path: '/loans/new', component: view('LoanApply') },
  { path: '/loans/:name', component: view('LoanDetail'), props: true },
  { path: '/loans/:name/repay', component: view('Repay'), props: true },
  { path: '/receipt/:doctype/:name', component: view('Receipt'), props: true },
  { path: '/autosave', component: view('Autosave') },
  { path: '/withdraw', component: view('Withdraw') },
  { path: '/withdrawals/:name', component: view('WithdrawalDetail'), props: true },
  { path: '/notifications', component: view('Notifications'), meta: { noCoop: true } },
  { path: '/announcements', component: view('Announcements') },
  { path: '/profile', component: view('Profile'), meta: { tab: 'profile', noCoop: true } },
  { path: '/profile/payout', component: view('PayoutAccount'), meta: { noCoop: true } },
  { path: '/pay/callback', component: view('PayCallback') },
  { path: '/admin', component: view('admin/Admin'), meta: { tab: 'admin', admin: true } },
  { path: '/admin/members/:name', component: view('admin/MemberDetail'), props: true, meta: { tab: 'admin', admin: true } },
  { path: '/admin/books/report/:kind', component: view('admin/books/Report'), props: true, meta: { admin: true } },
  { path: '/admin/books/journals', component: view('admin/books/Journals'), meta: { admin: true } },
  { path: '/admin/books/journal/new', component: view('admin/books/JournalNew'), meta: { admin: true } },
  { path: '/admin/books/journal/:name', component: view('admin/books/Journal'), props: true, meta: { admin: true } },
  { path: '/admin/books/accounts', component: view('admin/books/Accounts'), meta: { admin: true } },
  { path: '/admin/books/ledger/:account', component: view('admin/books/Ledger'), props: true, meta: { admin: true } },
  { path: '/admin/books/share-out', component: view('admin/books/ShareOut'), meta: { admin: true } },
  { path: '/admin/books/share-out/:name', component: view('admin/books/ShareOut'), props: true, meta: { admin: true } },
  { path: '/share-out/:name', component: view('ShareOutMine'), props: true },
  { path: '/:pathMatch(.*)*', redirect: '/' },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior: (to, from, saved) => saved || { top: 0 },
})

setUnauthorizedHandler(() => {
  logout()
  router.replace({ path: '/login', query: { expired: 1 } })
})

export const pendingJoinCode = () => {
  try { return sessionStorage.getItem(JOIN_KEY) || '' } catch { return '' }
}
export const clearJoinCode = () => {
  try { sessionStorage.removeItem(JOIN_KEY) } catch {}
}

router.beforeEach(async (to) => {
  // Invite links (/join/ABC123 or ?code=ABC123) keep the code through sign-up / login
  if (to.query.code) {
    try { sessionStorage.setItem(JOIN_KEY, String(to.query.code).toUpperCase()) } catch {}
  }
  if (!state.loaded) await loadSession().catch(() => {})

  if (to.meta.landing) return isLoggedIn.value ? '/home' : true
  if (to.meta.guest) return isLoggedIn.value ? '/home' : true
  if (!isLoggedIn.value) {
    if (to.meta.inviteFriendly && pendingJoinCode()) return '/signup'
    return { path: '/login', query: { next: to.fullPath } }
  }
  if (!to.meta.noCoop && !current.value) return '/welcome'
  if (to.meta.admin && !isAdmin.value) return '/home'
  return true
})

export default router
