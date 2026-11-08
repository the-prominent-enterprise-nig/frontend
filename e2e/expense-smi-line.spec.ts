/**
 * Scenario 78 Part 2 — a line on 6-01-041 Commissions - SMI behaves exactly like
 * one on 6-01-040 Commissions - Sales: a Sales Invoice No. picker and, unless the
 * entry is paid to a Sales Agent (whose name is already above), a Sales Agent
 * pick of its own, the amount typed, and the entry labelled "SMI Expense".
 *
 * UI contract only: what the server enforces (the sale must be a completed one
 * credited to the entry's agent, each sale's SMI released once and separately
 * from its commission) is proven in
 * backend/src/accounting/expenses/expenses-vehicle-commission.spec.ts.
 * Needs 6-01-041 tagged SMI — migration 20261026120000_scenario_78_smi_expense_kind,
 * or the COA seed on a fresh database.
 *
 * Self-cleaning: never submits the form, so nothing is created.
 */

import { test, expect, type Page } from '@playwright/test'
import { gotoReady } from './utils'

async function pickPayee(page: Page, label: string) {
  const trigger = page
    .getByText(/^(— Select —|Customer|Supplier|Employee|Sales Agent|Other)$/)
    .first()
  const option = page.getByRole('option', { name: label, exact: true })
  await expect(async () => {
    await trigger.click()
    await expect(option).toBeVisible({ timeout: 2_000 })
  }).toPass({ timeout: 20_000 })
  await option.click()
}

async function pickAccount(page: Page, typed: string, full: string, nth = 0) {
  const account = page.locator('[aria-label="Account"]').nth(nth)
  await account.click()
  await account.fill('')
  await page.keyboard.type(typed)
  await page.getByText(full, { exact: true }).first().click()
}

const kindRow = (page: Page, kind: string) =>
  page.locator(`[data-testid="expense-line"][data-kind="${kind}"]`)

const SMI = '6-01-041 — Commissions - SMI'
const COMMISSION = '6-01-040 — Commissions - Sales'

test.use({ viewport: { width: 1440, height: 1100 } })

test.describe('Expense lines — Commissions - SMI (Scenario 78)', () => {
  test.beforeEach(async ({ page }) => {
    await gotoReady(page, '/accounting/expenses/new')
    await expect(page.getByRole('heading', { name: 'New Expense' })).toBeVisible()
  })

  test('an SMI line asks for the Sales Invoice No. and its Sales Agent, like a commission line', async ({
    page,
  }) => {
    await pickPayee(page, 'Other')
    await page.getByPlaceholder('e.g. NIG EMPLOYEES').fill('Sales Manager')
    await pickAccount(page, 'Commissions - SM', SMI)

    const smi = kindRow(page, 'SMI')
    await expect(smi).toBeVisible()
    await expect(smi.getByText('Sales Invoice No. *')).toBeVisible()
    await expect(smi.getByText('Sales Agent *')).toBeVisible()
    // Not a Sales Agent entry, so the line carries its own agent to pick.
    await expect(smi.locator('[aria-label="Line sales agent"]')).toBeVisible()
    await expect(page.getByTestId('expense-kind-chip')).toHaveText(/smi expense/i)
    await expect(
      page.getByText(
        'Use the “Sales Invoice No.” to select invoices assigned to the chosen Sales Agent.',
        {
          exact: false,
        }
      )
    ).toBeVisible()
  })

  test("on a Sales Agent entry the SMI line has no Sales Agent column and searches the payee's sales", async ({
    page,
  }) => {
    await pickPayee(page, 'Sales Agent')
    await pickAccount(page, 'Commissions - SM', SMI)
    const smi = kindRow(page, 'SMI')
    // The agent is the payee, named once above — the same as a commission line.
    await expect(smi.getByText('Sales Agent *')).toHaveCount(0)

    await page.locator('[aria-label="Select sales agent"]').click()
    const firstAgent = page.locator('body > div.fixed button').nth(1)
    await expect(firstAgent).toBeVisible({ timeout: 10_000 })
    await firstAgent.click()
    await expect(smi.getByText('Sales Agent *')).toHaveCount(0)

    const lookup = page.waitForRequest(
      (r) =>
        r.url().includes('/expenses/lookups/sales') &&
        r.url().includes('kind=SMI') &&
        r.url().includes('agentId=')
    )
    await smi.getByText('— Select —').first().click()
    await page.keyboard.type('SI')
    await lookup
  })

  test('a commission line and an SMI line sit on one entry, with the same columns', async ({
    page,
  }) => {
    await pickPayee(page, 'Other')
    await page.getByPlaceholder('e.g. NIG EMPLOYEES').fill('Sales Manager')
    await pickAccount(page, 'Commissions - S', COMMISSION)
    await page.getByRole('button', { name: 'Add Line' }).click()
    await pickAccount(page, 'Commissions - SM', SMI, 1)

    await expect(kindRow(page, 'AGENT_COMMISSION')).toBeVisible()
    await expect(kindRow(page, 'SMI')).toBeVisible()
    // Both lines carry a Sales Invoice No. and a Sales Agent.
    await expect(kindRow(page, 'AGENT_COMMISSION').getByText('Sales Agent *')).toBeVisible()
    await expect(kindRow(page, 'SMI').getByText('Sales Agent *')).toBeVisible()
    await expect(page.getByText('Sales Invoice No. *')).toHaveCount(2)
  })

  test('Save draft refuses an SMI line without its sale — nothing is sent', async ({ page }) => {
    await pickPayee(page, 'Other')
    await page.getByPlaceholder('e.g. NIG EMPLOYEES').fill('Sales Manager')
    await pickAccount(page, 'Commissions - SM', SMI)
    await page.locator('[aria-label="Amount"]').first().fill('50')

    let posted = false
    page.on('request', (r) => {
      if (r.method() === 'POST' && /\/expenses(\?|$)/.test(r.url())) posted = true
    })
    await page.getByRole('button', { name: 'Save draft' }).click()
    // Paid from / Division are checked first; whichever message shows, the
    // entry must not be sent.
    await expect(
      page.getByText(
        /Pick where this is paid from|Every line needs a Division|Pick the Sales Invoice No\. on every SMI line/
      )
    ).toBeVisible()
    expect(posted).toBe(false)
  })

  test('a payroll run names Commissions - SMI as an ordinary line', async ({ page }) => {
    await pickPayee(page, 'Other')
    await page.getByRole('checkbox', { name: 'Payroll' }).check()
    await pickAccount(page, 'Commissions - SM', SMI)
    await expect(kindRow(page, 'SMI')).toHaveCount(0)
    await expect(page.getByText('Sales Invoice No. *')).toHaveCount(0)
  })
})
