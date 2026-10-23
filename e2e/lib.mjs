// Shared helpers for the browser checks.
import { chromium } from 'playwright'
import fs from 'node:fs'

export const STAGE = { app: 'http://127.0.0.1:5173', api: 'http://127.0.0.1:8100/api/method/coopvault.api.' }
export const PROD = { app: 'https://pay-frappe.web.app', api: 'https://api-payment.secureestate.app/api/method/coopvault.api.' }
export const PASSWORD = 'CoopDemo#2026'

export function suite(out) {
  fs.mkdirSync(out, { recursive: true })
  const results = []
  const errors = []
  const csp = []
  return {
    errors, csp,
    check(name, ok, detail = '') {
      results.push(!!ok)
      console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail !== '' ? `  [${typeof detail === 'string' ? detail : JSON.stringify(detail)}]` : ''}`)
    },
    shot: (page, name, full = true) => page.screenshot({ path: `${out}/${name}.png`, fullPage: full }),
    done() {
      if (errors.length) console.log('PAGE ERRORS:\n' + [...new Set(errors)].join('\n'))
      if (csp.length) console.log('CSP:\n' + [...new Set(csp)].join('\n'))
      results.push(!errors.length, !csp.length)
      console.log(`${results.filter(Boolean).length}/${results.length} passed (incl. no page errors, no CSP violations)`)
    },
  }
}

export async function login(env, key) {
  const r = await fetch(env.api + 'auth.login', { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json', Origin: env.app },
    body: JSON.stringify({ email: `${key}@example.com`, password: PASSWORD }) })
  const body = await r.json()
  if (!r.ok) throw new Error(`login ${key}: ${JSON.stringify(body).slice(0, 200)}`)
  return body.message.token
}

/** A phone-sized page signed in as a demo user (or a guest when key is null). */
export async function page(browser, env, t, key, { cooperative, scheme = 'light', width = 390, height = 844 } = {}) {
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 2, colorScheme: scheme, serviceWorkers: 'block' })
  const token = key ? await login(env, key) : null
  await ctx.addInitScript(([tok, coop]) => {
    if (tok) localStorage.setItem('coopvault.token', tok)
    if (coop) localStorage.setItem('coopvault.cooperative', coop)
    localStorage.setItem('coopvault.installDismissed', '1')
    document.addEventListener('securitypolicyviolation', (e) => console.error(`CSP ${e.violatedDirective} ${e.blockedURI}`))
  }, [token, cooperative])
  const p = await ctx.newPage()
  p.on('pageerror', (e) => t.errors.push(`${p.url()} ${e.message}`))
  p.on('console', (m) => {
    const from = m.location()?.url || ''
    if (from && !from.startsWith(env.app)) return // other origins (Paystack checkout) have their own CSP
    if (/CSP |Content Security Policy/.test(m.text())) t.csp.push(`${p.url()} ${m.text()}`)
    else if (m.type() === 'error' && !/Failed to load resource|status of 4\d\d/.test(m.text())) t.errors.push(`${p.url()} ${m.text()}`)
  })
  return p
}

export const go = async (p, env, path, settle = 700) => { await p.goto(env.app + path, { waitUntil: 'networkidle' }); await p.waitForTimeout(settle) }
export const launch = () => chromium.launch()
