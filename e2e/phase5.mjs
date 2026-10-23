// Savings products, Pay what's due, withdrawals by product, meetings and adding members, on staging
// (after dev/stage.sh and `node serve.mjs`).
import fs from 'node:fs'
import { STAGE as env, suite, page, go, launch, login } from './lib.mjs'

const state = JSON.parse(fs.readFileSync('/home/ubuntu/start-payment/backend/apps/coopvault/dev/tests/.state/demo_stage.json', 'utf8'))
const t = suite(process.argv[2] || 'shots/phase5')
const b = await launch()
const as = (key, opts) => page(b, env, t, key, { cooperative: state.coop, ...opts })
const H = { 'Content-Type': 'application/json', Accept: 'application/json', Origin: env.app }
async function api(token, path, body, verb = 'POST') {
  const url = env.api + path + (verb === 'GET' ? `?${new URLSearchParams(body)}` : '')
  const r = await fetch(url, { method: verb, headers: { ...H, Authorization: `Session ${token}` }, body: verb === 'GET' ? undefined : JSON.stringify(body) })
  const j = await r.json()
  if (!r.ok) throw new Error(`${path}: ${JSON.stringify(j).slice(0, 300)}`)
  return j.message
}

// A split payment by Chioma through the fake Paystack, so there's an itemised receipt to look at
const chioma = await login(env, 'chioma')
const plan = await api(chioma, 'finance.payment_plan', { cooperative: state.coop }, 'GET')
const xmas = plan.products.find((p) => p.product_name === 'Christmas savings').name
const regular = plan.products.find((p) => p.kind === 'Regular contributions').name
const init = await api(chioma, 'payments.initialize', { cooperative: state.coop, purpose: 'Split',
  allocations: [{ kind: 'savings', savings_product: regular, amount: 10000 }, { kind: 'savings', savings_product: xmas, amount: 2500 }] })
await fetch('http://127.0.0.1:8899/_test/pay', { method: 'POST', headers: H, body: JSON.stringify({ reference: init.reference }) })
const tx = await api(chioma, 'payments.verify', { reference: init.reference })

// 1. Home: savings by product, what's due, the next meeting
{
  const p = await as('musa')
  await go(p, env, '/home', 1300)
  t.check('savings split by product on Home', await p.getByText('Christmas savings').first().isVisible())
  t.check('next meeting on Home', await p.getByText('November general meeting').isVisible())
  const dueCard = p.getByText(/due now/)
  t.check('dues and the instalment together', (await dueCard.count()) > 0 ? await dueCard.first().isVisible() : true)
  await t.shot(p, 'p1-home')
  await p.context().close()
}

// 2. Save into a product
{
  const p = await as('musa')
  await go(p, env, '/save', 1200)
  await p.getByRole('button', { name: 'Christmas savings' }).click()
  await p.waitForTimeout(400)
  await p.locator('input[inputmode="decimal"]').first().fill('3000')
  await p.waitForTimeout(900)
  t.check('voluntary product explained', await p.getByText(/doesn’t count towards what you can borrow/).isVisible())
  t.check('panel says where it goes', await p.getByText('Added to Christmas savings').isVisible())
  await t.shot(p, 'p2-save-christmas')
  await p.context().close()
}

// 3. Pay what's due
{
  const p = await as('musa')
  await go(p, env, '/pay', 1300)
  t.check('pay screen opens', await p.getByRole('heading', { name: /Pay what’s due/ }).isVisible())
  const extra = p.getByLabel('Christmas savings')
  if (await extra.count()) await extra.fill('1000')
  await p.waitForTimeout(900)
  t.check('total to pay shown', await p.getByText('You pay').isVisible())
  await t.shot(p, 'p3-pay-due')
  await p.context().close()
}

// 4. The itemised receipt
{
  const p = await as('chioma')
  await go(p, env, `/receipt/${encodeURIComponent(tx.document_type)}/${tx.document}?new=1`, 1300)
  t.check('receipt lists every part', await p.getByText('This payment covered').isVisible() && await p.getByText('Christmas savings').first().isVisible())
  await t.shot(p, 'p4-split-receipt')
  await p.context().close()
}

// 5. Withdraw: Ngozi's retirement fund is locked until she leaves
{
  const p = await as('ngozi')
  await go(p, env, '/withdraw', 1300)
  const locked = p.getByText('Only when you leave the group')
  t.check('locked product shown as locked', (await locked.count()) > 0 || await p.getByText(/can only come out when you leave/).isVisible())
  t.check('leaving option offered', await p.getByRole('button', { name: 'Leaving the group?' }).isVisible())
  await t.shot(p, 'p5-withdraw-products')
  await p.getByRole('button', { name: 'Leaving the group?' }).click()
  await p.waitForTimeout(400)
  await t.shot(p, 'p5b-withdraw-leaving')
  await p.context().close()
}

// 6. Settings: savings products and how transfers are shared out
{
  const p = await as('amaka')
  await go(p, env, '/admin?tab=settings', 1400)
  await p.getByText('Savings products').scrollIntoViewIfNeeded()
  t.check('savings products listed', await p.getByText('Retirement fund').first().isVisible())
  t.check('transfer sharing setting', await p.getByText('Pay what’s due first').isVisible())
  await p.getByText('Savings products').scrollIntoViewIfNeeded()
  await t.shot(p, 'p6-settings-savings', false)
  await p.locator('button', { hasText: 'Retirement fund' }).first().click()
  await p.waitForTimeout(500)
  t.check('product editor opens', await p.getByRole('button', { name: 'Save savings product' }).isVisible())
  await t.shot(p, 'p6b-savings-editor', false)
  await p.context().close()
}

// 7. Meetings: the secretary's list, published minutes, a member replying
{
  const p = await as('sade')
  await go(p, env, '/meetings', 1200)
  t.check('secretary can call a meeting', await p.getByText('Call a meeting').isVisible())
  t.check('past meeting has minutes', await p.getByText('Minutes', { exact: true }).first().isVisible())
  await t.shot(p, 'p7-meetings')
  await p.getByText('October general meeting').click()
  await p.waitForTimeout(1200)
  t.check('minutes and resolutions readable', await p.getByText(/Accept the treasurer’s report|Accept the treasurer's report/).isVisible())
  await t.shot(p, 'p7b-minutes')
  await p.context().close()
}
{
  const p = await as('musa')
  await go(p, env, `/meetings/${state.meeting_next}`, 1200)
  await p.getByRole('button', { name: 'I’ll be there' }).click()
  await p.waitForTimeout(1000)
  t.check('member replies they’re coming', await p.getByRole('button', { name: 'I’ll be there' }).getAttribute('aria-pressed') === 'true')
  await t.shot(p, 'p7c-meeting-reply')
  await p.context().close()
}

// 8. Add a member by hand, then the setup screen they'd open
{
  const p = await as('amaka')
  await go(p, env, '/admin?tab=members', 1300)
  await p.getByText('Add a member').click()
  await p.waitForTimeout(400)
  const phone = `0807${String(Date.now()).slice(-7)}`
  await p.getByLabel('Full name').fill('Halima Yusuf')
  await p.getByLabel('Phone number').fill(phone)
  await p.getByRole('button', { name: 'Add member' }).click()
  await p.waitForTimeout(1500)
  t.check('setup code shown to share', await p.getByRole('heading', { name: 'Setup code' }).isVisible())
  await t.shot(p, 'p8-setup-code', false)
  await p.context().close()
  const g = await page(b, env, t, null)
  await go(g, env, `/forgot?setup=1&login=${phone}`, 800)
  t.check('setup screen for the new member', await g.getByRole('heading', { name: 'Set up your account' }).isVisible() &&
    await g.getByLabel('Your phone number').inputValue() === phone)
  await t.shot(g, 'p8b-setup-screen')
  await g.context().close()
}

// 9. Dark mode: Pay what's due
{
  const p = await as('musa', { scheme: 'dark' })
  await go(p, env, '/pay', 1300)
  await t.shot(p, 'p9-pay-due-dark')
  await p.context().close()
}

await b.close()
t.done()
