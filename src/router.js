import { createRouter, createWebHistory } from 'vue-router'
import { state, loadSession, isLoggedIn, current, isAdmin, logout } from './store'
import { setUnauthorizedHandler } from './api'

const routes = [
  { path: '/login', component: () => import('./views/Login.vue'), meta: { guest: true } },
  { path: '/signup', component: () => import('./views/Signup.vue'), meta: { guest: true } },
  { path: '/forgot', component: () => import('./views/Forgot.vue'), meta: { guest: true } },
  { path: '/welcome', component: () => import('./views/Onboarding.vue'), meta: { noCoop: true } },
  { path: '/', component: () => import('./views/Home.vue'), meta: { tab: 'home' } },
  { path: '/contribute', component: () => import('./views/Contribute.vue') },
  { path: '/history', component: () => import('./views/History.vue'), meta: { tab: 'history' } },
  { path: '/loans', component: () => import('./views/Loans.vue'), meta: { tab: 'loans' } },
  { path: '/loans/new', component: () => import('./views/LoanApply.vue') },
  { path: '/loans/:name', component: () => import('./views/LoanDetail.vue'), props: true },
  { path: '/loans/:name/repay', component: () => import('./views/Repay.vue'), props: true },
  { path: '/announcements', component: () => import('./views/Announcements.vue') },
  { path: '/profile', component: () => import('./views/Profile.vue'), meta: { tab: 'profile', noCoop: true } },
  { path: '/pay/callback', component: () => import('./views/PayCallback.vue') },
  { path: '/admin', component: () => import('./views/admin/Admin.vue'), meta: { tab: 'admin', admin: true } },
  { path: '/admin/members/:name', component: () => import('./views/admin/MemberDetail.vue'), props: true, meta: { tab: 'admin', admin: true } },
  { path: '/:pathMatch(.*)*', redirect: '/' },
]

const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior: () => ({ top: 0 }),
})

setUnauthorizedHandler(() => {
  logout()
  router.replace({ path: '/login', query: { expired: 1 } })
})

router.beforeEach(async (to) => {
  // Invite links look like /welcome?code=ABC123; keep the code through login/sign-up
  if (to.query.code) {
    try { sessionStorage.setItem('coopvault.joinCode', String(to.query.code)) } catch {}
  }
  if (!state.loaded) await loadSession().catch(() => {})
  if (to.meta.guest) return isLoggedIn.value ? '/' : true
  if (!isLoggedIn.value) return { path: '/login', query: to.fullPath !== '/' ? { next: to.fullPath } : {} }
  if (!to.meta.noCoop && !current.value) return '/welcome'
  if (to.meta.admin && !isAdmin.value) return '/'
  return true
})

export default router
