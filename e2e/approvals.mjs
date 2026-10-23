// Roles and approvals on staging (after backend/apps/coopvault/dev/stage.sh and `node serve.mjs`).
import fs from 'node:fs'
import { STAGE as env, suite, page, go, login, launch } from './lib.mjs'

const state = JSON.parse(fs.readFileSync('/home/ubuntu/start-payment/backend/apps/coopvault/dev/tests/.state/demo_stage.json', 'utf8'))
const out = process.argv[2] || 'shots/approvals'
const t = suite(out)
const b = await launch()
const as = (key, opts) => page(b, env, t, key, { cooperative: state.coop, ...opts })
const api = async (key, method, body) => {
  const r = await fetch(env.api + method, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Session ${await login(env, key)}` }, body: JSON.stringify(body) })
  return (await r.json()).message
}

// Amaka (Admin) asks for a ₦20,000 loan: two stages in this group (review, then the Chairman)
const big = await api('amaka', 'finance.apply_loan', { cooperative: state.coop, amount: 20000, tenure_months: 2, purpose: 'Stock for the shop' })

// 1. Loan Officer: no Books or Settings; reviews loans
{
  const p = await as('lola')
  await go(p, env, '/admin?tab=reviews')
  t.check('loan officer: no Books tab, no Settings', !(await p.getByRole('button', { name: 'Books' }).count()) && !(await p.getByLabel('Settings').count()))
  const card = p.locator('.card', { hasText: 'Amaka Eze' }).filter({ hasText: 'Loan request' })
  t.check('loan officer sees Amaka’s loan at stage 1', await card.getByText(/Stage 1 of 2/).isVisible())
  await t.shot(p, 'a1-loan-officer-review')
  await card.getByRole('button', { name: 'Approve' }).click()
  await p.waitForTimeout(1200)
  t.check('after review it waits for the chairman', await p.getByText('Waiting on others').isVisible())
  await p.context().close()
}

// 2. Chairman: final approval; sees the books; no Settings
{
  const p = await as('kemi')
  await go(p, env, '/admin?tab=reviews')
  t.check('chairman sees Books but not Settings', (await p.getByRole('button', { name: 'Books' }).count()) === 1 && !(await p.getByLabel('Settings').count()))
  const card = p.locator('.card', { hasText: 'Amaka Eze' }).filter({ hasText: 'Final approval' })
  await t.shot(p, 'a2-chairman-review')
  await card.getByRole('button', { name: 'Approve' }).click()
  await p.waitForTimeout(1200)
  t.check('chairman approves; it leaves their queue', !(await p.locator('.card', { hasText: 'Final approval' }).count()))
  await p.context().close()
}

// 3. Amaka sees her loan's approval trail
{
  const p = await as('amaka')
  await go(p, env, `/loans/${big.name}`)
  t.check('borrower sees it approved and waiting to be sent', await p.getByText(/Approved\. The treasurer will send it/).isVisible())
  await t.shot(p, 'a3-borrower-loan')
  await go(p, env, '/admin?tab=settings')
  await p.getByText('Who approves what').scrollIntoViewIfNeeded()
  t.check('admin edits who approves what', await p.getByText('Who approves what').isVisible())
  await t.shot(p, 'a4-approval-rules')
  await p.locator('button', { hasText: 'From ₦20,000' }).first().click()
  await p.waitForTimeout(500)
  await t.shot(p, 'a5-rule-editor', false)
  await p.keyboard.press('Escape')
  await go(p, env, `/admin/members/${state.members.femi}`)
  t.check('member page explains the officer role', await p.getByText(/Keeps the books/).isVisible())
  await t.shot(p, 'a6-member-accountant')
  await p.context().close()
}

// 4. Treasurer: approves the offline cash payment, sends the approved money
{
  const p = await as('tunde')
  await go(p, env, '/admin?tab=reviews')
  await t.shot(p, 'a7-treasurer-review')
  const cash = p.locator('.card', { hasText: 'Offline payment to check' })
  t.check('treasurer sees the cash payment Femi recorded', await cash.getByText('Femi Okon').isVisible())
  await cash.getByRole('button', { name: 'Approve' }).click()
  await p.waitForTimeout(1200)
  const ready = p.locator('.card', { hasText: 'Amaka Eze' }).filter({ hasText: 'Loan approved' })
  t.check('Amaka’s approved loan is ready to send', await ready.isVisible())
  await ready.getByRole('button', { name: 'Send' }).click()
  await p.locator('#send-ref').fill('TRF-DEMO-77')
  await t.shot(p, 'a8-send-sheet', false)
  await p.getByRole('button', { name: 'I’ve sent it' }).click()
  await p.waitForTimeout(1200)
  t.check('sent', !(await p.locator('.card', { hasText: 'Loan approved' }).filter({ hasText: 'Amaka Eze' }).count()))
  await p.context().close()
}

// 5. Accountant records a payment (the sheet), Ify sees her cash payment counted
{
  const p = await as('femi')
  await go(p, env, '/admin?tab=reviews')
  await p.getByRole('button', { name: /Record an offline payment/ }).click()
  await p.waitForTimeout(600)
  await t.shot(p, 'a9-record-sheet', false)
  await p.context().close()
  const ify = await as('ify')
  await go(ify, env, '/home')
  t.check('Ify’s cash payment is in her savings', await ify.getByText('₦10,000').first().isVisible())
  await t.shot(ify, 'a10-ify-home')
  await ify.context().close()
}

await b.close()
t.done()
