// Loan products, guarantors and the loan book on staging (after dev/stage.sh and `node serve.mjs`).
import fs from 'node:fs'
import { STAGE as env, suite, page, go, launch } from './lib.mjs'

const state = JSON.parse(fs.readFileSync('/home/ubuntu/start-paymnet/backend/apps/coopvault/dev/tests/.state/demo_stage.json', 'utf8'))
const t = suite(process.argv[2] || 'shots/loans')
const b = await launch()
const as = (key, opts) => page(b, env, t, key, { cooperative: state.coop, ...opts })

// 1. Choosing a loan: products, live quote, guarantors, eligibility
{
  const p = await as('amaka')
  await go(p, env, '/loans/new', 1200)
  t.check('both loan products are offered', await p.getByText('Emergency loan').isVisible() && await p.getByText('Standard loan').isVisible())
  await p.getByText('Emergency loan').click()
  await p.locator('input[inputmode="decimal"]').first().fill('10000')
  await p.waitForTimeout(1200)
  t.check('reducing-balance terms explained', await p.getByText('2% a month on the reducing balance').first().isVisible())
  t.check('processing fee and what you receive shown', await p.getByText(/You receive/).isVisible() && await p.getByText(/Processing fee/).isVisible())
  t.check('guarantor needed', await p.getByText(/needs 1 member to guarantee/).isVisible())
  await p.getByRole('button', { name: /Repayment plan/ }).click()
  await p.waitForTimeout(300)
  await t.shot(p, 'l1-apply-emergency')
  await p.context().close()
}

// 2. Ngozi is asked to guarantee Musa's loan
{
  const p = await as('ngozi')
  await go(p, env, '/home', 1200)
  const card = p.getByText(/Musa Bello asked you to be a guarantor/)
  t.check('guarantee request on Home', await card.isVisible())
  await t.shot(p, 'l2-ngozi-home')
  await card.click()
  await p.waitForTimeout(1200)
  await t.shot(p, 'l3-guarantee-request')
  await p.getByRole('button', { name: 'I’ll guarantee it' }).click()
  await p.waitForTimeout(400)
  await p.getByRole('button', { name: 'Yes, I’ll guarantee it' }).click()
  await p.waitForTimeout(1200)
  t.check('accepted', await p.getByText(/You’re guaranteeing/).isVisible())
  await p.context().close()
}

// 3. Loan officer approves; the loan book
{
  const p = await as('lola')
  await go(p, env, '/admin?tab=reviews', 1200)
  const card = p.locator('.card', { hasText: 'Musa Bello' }).filter({ hasText: 'Emergency loan' })
  t.check('review card shows product, rate and guarantor', await card.getByText(/Ngozi Adeyemi .*agreed/).isVisible())
  await t.shot(p, 'l4-review-loan')
  await card.getByRole('button', { name: 'Approve' }).click()
  await p.waitForTimeout(1200)
  await go(p, env, '/admin?tab=overview', 1000)
  await p.getByText('Loan book').click()
  await p.waitForTimeout(1200)
  t.check('loan book opens', await p.getByText('Out on loan').isVisible())
  await t.shot(p, 'l5-loan-book')
  await p.context().close()
}

// 4. Musa's loan page: the plan and the guarantor
{
  const p = await as('musa')
  await go(p, env, `/loans/${state.loan_musa}`, 1200)
  t.check('standard loan shows its instalments', await p.getByText('Repayment plan').isVisible())
  await t.shot(p, 'l6-musa-loan')
  await p.context().close()
}

// 5. Admin: loan products in Settings
{
  const p = await as('amaka')
  await go(p, env, '/admin?tab=settings', 1200)
  await p.getByText('Loan products').scrollIntoViewIfNeeded()
  await p.locator('button', { hasText: 'Emergency loan' }).first().click()
  await p.waitForTimeout(500)
  t.check('product editor opens', await p.getByText('Save loan product').isVisible())
  await t.shot(p, 'l7-product-editor', false)
  await p.context().close()
}

await b.close()
t.done()
