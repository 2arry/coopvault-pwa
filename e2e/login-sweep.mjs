// Log every demo account in through the live app's login page; officers also open Manage.
import { PROD as env, suite, go, launch, PASSWORD } from './lib.mjs'

const out = process.argv[2] || 'shots/sweep'
const t = suite(out)
const people = [
  ['amaka', 'amaka@example.com', 'Admin'], ['tunde', '+234 803 100 0002', 'Treasurer'], ['kemi', 'kemi@example.com', 'Chairman'],
  ['femi', 'femi@example.com', 'Accountant'], ['lola', '0803 100 0010', 'Loan Officer'], ['chioma', 'chioma@example.com'],
  ['ify', 'ify@example.com'], ['musa', '0803 100 0005'], ['ngozi', 'ngozi@example.com'], ['bisi', 'bisi@example.com'],
]
const b = await launch()
for (const [key, login, role] of people) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })
  await ctx.addInitScript(() => localStorage.setItem('coopvault.installDismissed', '1'))
  const p = await ctx.newPage()
  p.on('pageerror', (e) => t.errors.push(`${key}: ${e.message}`))
  await go(p, env, '/login', 300)
  await p.fill('#login', login)
  await p.fill('#password', PASSWORD)
  await p.getByRole('button', { name: 'Log in' }).click()
  const ok = await p.waitForURL(/\/(home|welcome)/, { timeout: 30000 }).then(() => true).catch(() => false)
  await p.waitForTimeout(1200)
  const headline = (await p.locator('section').first().innerText().catch(() => '')).replace(/\s+/g, ' ').slice(0, 90)
  t.check(`${key} logs in via ${login}`, ok, headline)
  if (ok && role) {
    await go(p, env, '/admin?tab=reviews', 1200)
    const waiting = await p.getByText('Needs your approval').count()
    t.check(`${key} (${role}) opens Manage`, p.url().includes('/admin'), waiting ? 'has approvals waiting' : 'nothing waiting')
    await t.shot(p, `review-${key}`)
  }
  await ctx.close()
}
await b.close()
t.done()
