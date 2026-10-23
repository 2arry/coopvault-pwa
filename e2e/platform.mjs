// The platform console and what groups see of it, on staging (after dev/stage.sh and `node serve.mjs`).
import fs from 'node:fs'
import { STAGE as env, suite, page, go, launch, login } from './lib.mjs'

const state = JSON.parse(fs.readFileSync('/home/ubuntu/start-payment/backend/apps/coopvault/dev/tests/.state/demo_stage.json', 'utf8'))
const t = suite(process.argv[2] || 'shots/platform')
const b = await launch()
const H = { 'Content-Type': 'application/json', Accept: 'application/json', Origin: env.app }
async function api(token, path, body, verb = 'POST') {
  const url = env.api + path + (verb === 'GET' ? `?${new URLSearchParams(body)}` : '')
  const r = await fetch(url, { method: verb, headers: { ...H, Authorization: `Session ${token}` }, body: verb === 'GET' ? undefined : JSON.stringify(body) })
  const j = await r.json()
  if (!r.ok) throw new Error(`${path}: ${JSON.stringify(j).slice(0, 300)}`)
  return j.message
}
const ops = await login(env, 'ops')
const kunleGroup = (await api(ops, 'platform.list_groups', { q: 'Computer Village' }, 'GET'))[0]

// 1. The operator lands on the console
{
  const p = await page(b, env, t, 'ops')
  await go(p, env, '/home', 1500)
  t.check('an operator with no group lands on the console', p.url().includes('/platform') && await p.getByRole('heading', { name: 'Platform console' }).isVisible())
  const queued = p.getByRole('link', { name: /Computer Village Traders Thrift Kunle Adeyemi/ })
  t.check('the review queue shows the new group', await queued.isVisible())
  await t.shot(p, 'c1-overview')
  await queued.click()
  await p.waitForTimeout(1300)
  t.check('group page: where, registration, who runs it', await p.getByText('LSC/2026/1182').isVisible() && await p.getByText('Kunle Adeyemi').first().isVisible())
  await t.shot(p, 'c2-group-review')
  await p.getByRole('button', { name: 'Decline' }).click()
  await p.waitForTimeout(400)
  t.check('declining needs a reason', await p.getByRole('button', { name: 'Confirm' }).isDisabled())
  await t.shot(p, 'c3-decline-sheet', false)
  await p.keyboard.press('Escape')
  await go(p, env, '/platform?tab=groups', 1300)
  await p.getByLabel('Search groups').fill('Owerri')
  await p.waitForTimeout(1000)
  t.check('search finds a group on the free plan', await p.getByText('Owerri Market Women').isVisible() && await p.getByText('Free', { exact: true }).first().isVisible())
  await t.shot(p, 'c4-groups')
  await go(p, env, '/platform?tab=plans', 1200)
  t.check('plans listed', await p.getByText('Enterprise').first().isVisible())
  await p.getByText('Growth').first().click()
  await p.waitForTimeout(500)
  t.check('plan editor opens', await p.getByRole('button', { name: 'Save plan' }).isVisible())
  await t.shot(p, 'c5-plan-editor', false)
  await p.context().close()
}

// 2. The founder of a group under review
{
  const p = await page(b, env, t, 'kunle', { cooperative: kunleGroup.name })
  await go(p, env, '/home', 1300)
  t.check('the founder sees the group is being checked', await p.getByText(/Cooperative360 is checking/).isVisible())
  await t.shot(p, 'c6-founder-review')
  await p.context().close()
}

// 3. An admin's plan and billing
{
  const p = await page(b, env, t, 'amaka', { cooperative: state.coop })
  await go(p, env, '/admin/plan', 1300)
  t.check('plan, limits and usage', await p.getByText('Cooperative360 plan').isVisible() && await p.getByText('Members', { exact: true }).first().isVisible())
  await t.shot(p, 'c7-plan')
  await p.getByRole('button', { name: 'Pay for more months' }).click()
  await p.waitForTimeout(400)
  t.check('pay ahead sheet with a total', await p.getByText('Total').isVisible())
  await t.shot(p, 'c8-pay-ahead', false)
  await p.context().close()
}

// 4. A paused group, as its admin sees it (then opened again)
{
  const owerri = state.platform_group || (await api(ops, 'platform.list_groups', { q: 'Owerri' }, 'GET'))[0].name
  await api(ops, 'platform.suspend_group', { name: owerri, reason: 'We’re checking a complaint about a missing payout. Your money is safe.' })
  const p = await page(b, env, t, 'adaeze', { cooperative: owerri })
  await go(p, env, '/home', 1300)
  t.check('a paused group sees why', await p.getByText('Paused by Cooperative360').isVisible() && await p.getByText(/missing payout/).isVisible())
  await t.shot(p, 'c9-paused')
  await p.context().close()
  await api(ops, 'platform.reinstate_group', { name: owerri, note: 'Checked: the payout was made' })
}

await b.close()
t.done()
