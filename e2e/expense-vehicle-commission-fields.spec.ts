/**
 * Client item #10 — Fuel, Vehicle Repair & Maintenance and Sales Commission
 * expense lines carry extra fields, decided by the line's own account
 * (Account.expenseKind). They are columns of the line table, as on the client's
 * form: Plate Number / Liters, Repair/Service Type / Service Detail, and Sales
 * Invoice No. / Sales Agent — each there when any line needs it and blank on the
 * lines that don't.
 *
 * Also guards the form's shape (the four numbered sections; Paid from replacing the
 * payment method rows; Division required on every line).
 *
 * UI contract only: the rules the server enforces (plate required, service type
 * required, the sale must be the agent's, a sale is released once) are proven in
 * backend/src/accounting/expenses/expenses-vehicle-commission.spec.ts. Needs the
 * seeded fleet roster, which prisma/seed.ts loads. The Sales Agent → pick-a-sale
 * path needs an agent with a sale, which the seed does not create, so it stops at
 * "pick the agent first".
 *
 * Self-cleaning: never submits the form (the Save draft clicks below are all stopped
 * by validation), so nothing is created.
 */

import { test, expect, type Page } from '@playwright/test'
import { fillStable, gotoReady } from './utils'

async function pickPayee(page: Page, label: string) {
  // The payee dropdown reads "— Select —" until chosen, then shows its value.
  const trigger = page
    .getByText(/^(— Select —|Customer|Supplier|Employee|Sales Agent|Other)$/)
    .first()
  const option = page.getByRole('option', { name: label, exact: true })
  // A click can land before the page has hydrated (a cold dev compile), so keep
  // opening the list until the option is actually on screen.
  await expect(async () => {
    await trigger.click()
    await expect(option).toBeVisible({ timeout: 2_000 })
  }).toPass({ timeout: 20_000 })
  await option.click()
}

async function pickAccount(page: Page, typed: string, full: string) {
  const account = page.locator('[aria-label="Account"]').first()
  await account.click()
  await account.fill('')
  await page.keyboard.type(typed)
  await page.getByText(full, { exact: true }).first().click()
}

/** One line of the table, by what its account is for (the row carries `data-kind`). */
const kindRow = (page: Page, kind: string) =>
  page.locator(`[data-testid="expense-line"][data-kind="${kind}"]`)

// Tall enough that a line's dropdown opens inside the window however long the header
// above it grows (it now carries an Attachments card); a fixed popup cannot be
// scrolled into view.
test.use({ viewport: { width: 1440, height: 1100 } })

test.describe('Expense lines — Fuel, Vehicle Repair, Commission', () => {
  test.beforeEach(async ({ page }) => {
    await gotoReady(page, '/accounting/expenses/new')
    await expect(page.getByText('Payee *').first()).toBeVisible()
  })

  test('a Fuel line gets plate and liters — and no driver is tied to the plate', async ({
    page,
  }) => {
    await pickPayee(page, 'Supplier')
    await pickAccount(page, 'Fuel and', '6-04-010 — Fuel and Lubricants')

    const fuel = kindRow(page, 'FUEL')
    await expect(fuel).toBeVisible()
    await expect(page.getByText('Plate Number *', { exact: true })).toBeVisible()
    await expect(page.getByText('Liters (optional)', { exact: true })).toBeVisible()
    // The type is part of the plate's label (`<plate> - <type>`), not a box of its own.
    await expect(page.getByText('Vehicle Type')).toHaveCount(0)
    // The client's mockup had a "Vehicle (Auto)" column; it was left out on purpose.
    await expect(page.getByText(/Vehicle \(Auto\)/)).toHaveCount(0)
    // The roster lists a driver per vehicle; an expense line is not tied to one.
    await expect(page.locator('form').getByText(/driver/i)).toHaveCount(0)
    // Only Fuel's columns: nothing for repairs or commissions.
    await expect(page.getByText('Service Type *')).toHaveCount(0)
    await expect(page.getByText('Sales Invoice No. *')).toHaveCount(0)
    await expect(page.getByTestId('expense-kind-chip')).toHaveText(/fuel expense/i)

    // Any roster vehicle will do — take the first real option (the first button in
    // the open list is the "— Select —" placeholder).
    const plate = fuel.locator('[aria-label="Plate number"]')
    // Plate and Liters sit side by side on one row, in that order.
    const liters = fuel.locator('[aria-label="Liters"]')
    const [px, lx] = await Promise.all([plate, liters].map(async (l) => (await l.boundingBox())!))
    expect(Math.abs(px.y - lx.y)).toBeLessThan(8)
    expect(px.x).toBeLessThan(lx.x)
    await plate.click()
    const firstOption = page.locator('body > div.fixed button').nth(1)
    await expect(firstOption).toBeVisible({ timeout: 10_000 })
    const plateText = (await firstOption.innerText()).trim()
    // `<plate number> - <vehicle type>`: the roster has no make/model, so the Vehicle
    // Type (what the Drivers screen used to call Tag / Area) is the only description
    // it holds; a vehicle without one reads as its plate. Never the category.
    expect(plateText).not.toMatch(/Delivery|Service|Collector/)
    await firstOption.click()
    await expect(plate).toHaveValue(plateText)
    await expect(page.locator('form').getByText(/driver/i)).toHaveCount(0)
  })

  test('a plate the roster lists twice shows as two distinguishable vehicles', async ({ page }) => {
    await pickPayee(page, 'Supplier')
    await pickAccount(page, 'Fuel and', '6-04-010 — Fuel and Lubricants')
    const plate = kindRow(page, 'FUEL').locator('[aria-label="Plate number"]')
    await plate.click()
    await page.keyboard.type('60109')
    // The seeded roster lists 60109 as a Delivery TOP DOWN, a Service AIRCOOL and a
    // Collector — three vehicles — so wait for at least two and demand they differ.
    const options = page.locator('body > div.fixed button')
    await expect(options.nth(1)).toBeVisible({ timeout: 10_000 })
    const labels = (await options.allInnerTexts()).map((t) => t.trim())
    expect(labels.length).toBeGreaterThanOrEqual(2)
    expect(new Set(labels).size).toBe(labels.length)
    for (const label of labels) expect(label).toMatch(/^60109/)
    // A plate with a Vehicle Type reads `<plate> - <type>`.
    expect(labels).toContain('60109 - TOP DOWN')
  })

  test('the Vehicles screen calls the roster tag "Vehicle Type", not "Tag / Area"', async ({
    page,
  }) => {
    await gotoReady(page, '/accounting/vehicles')
    await expect(page.getByRole('columnheader', { name: 'Vehicle Type' })).toBeVisible({
      timeout: 15_000,
    })
    await expect(page.getByText('Tag / Area')).toHaveCount(0)
  })

  test('the Drivers screen no longer shows a plate, category or vehicle type', async ({ page }) => {
    await gotoReady(page, '/accounting/drivers')
    await expect(page.getByRole('columnheader', { name: 'Driver', exact: true })).toBeVisible({
      timeout: 15_000,
    })
    for (const name of ['Plate No.', 'Category', 'Vehicle Type']) {
      await expect(page.getByRole('columnheader', { name })).toHaveCount(0)
    }
  })

  test('moving the line to Vehicle Repairs swaps the columns and asks for the kind of job', async ({
    page,
  }) => {
    await pickPayee(page, 'Supplier')
    await pickAccount(page, 'Fuel and', '6-04-010 — Fuel and Lubricants')
    await expect(kindRow(page, 'FUEL')).toBeVisible()
    await expect(page.getByText('Liters (optional)', { exact: true })).toBeVisible()

    await pickAccount(page, 'Vehicle Rep', '6-04-030 — Vehicle Repairs and Maintenance')
    const repair = kindRow(page, 'VEHICLE_REPAIR')
    await expect(repair).toBeVisible()
    await expect(kindRow(page, 'FUEL')).toHaveCount(0)
    await expect(page.getByText('Service Type *')).toBeVisible()
    await expect(page.getByText('Service Detail', { exact: true })).toBeVisible()
    // Liters is Fuel's; with no Fuel line left its column goes.
    await expect(page.getByText('Liters (optional)', { exact: true })).toHaveCount(0)
    await expect(page.getByTestId('expense-kind-chip')).toHaveText(/repair & maintenance expense/i)

    await repair.getByText('— Select —').last().click()
    for (const type of ['Oil Change', 'Tires', 'Battery', 'Others']) {
      await expect(page.getByRole('option', { name: type, exact: true })).toBeVisible()
    }
  })

  test('an account with no kind gets no extra columns', async ({ page }) => {
    await pickPayee(page, 'Supplier')
    await pickAccount(page, 'Rent', '6-03-010 — Rent Expense')
    await expect(page.locator('[data-testid="expense-line"]')).toHaveAttribute('data-kind', '')
    await expect(page.getByText('Plate Number *')).toHaveCount(0)
    await expect(page.getByText('Sales Invoice No. *')).toHaveCount(0)
    await expect(page.getByTestId('expense-kind-chip')).toHaveCount(0)
  })

  test('the form follows the client layout: four sections, Paid from, no payment-method rows', async ({
    page,
  }) => {
    for (const heading of ['Header Information', 'Expense Details', 'Attachments', 'Notes']) {
      await expect(page.getByRole('heading', { name: new RegExp(heading, 'i') })).toBeVisible()
    }
    await expect(page.getByText('Paid from (Bank/Cash) *')).toBeVisible()
    await expect(page.getByText('Reference Number')).toBeVisible()
    // The voucher number is issued on save — nothing to type on a new entry.
    await expect(page.getByText('Voucher #')).toHaveCount(0)
    await expect(page.getByText('Total Amount')).toBeVisible()
    // The method, the amount and splitting a payment across several are gone: one
    // payment, the total less any withholding, from the fund chosen above.
    await expect(page.locator('form').getByText(/payment method/i)).toHaveCount(0)
    await expect(page.getByRole('button', { name: /add payment/i })).toHaveCount(0)
    await expect(page.getByLabel('Notes')).toBeVisible()
  })

  test('Save draft waits for Paid from, then for a Division on every line — nothing is sent', async ({
    page,
  }) => {
    const writes: string[] = []
    page.on('request', (r) => {
      if (r.method() === 'POST' && r.url().endsWith('/api/expenses')) writes.push(r.url())
    })
    await pickPayee(page, 'Supplier')
    await pickAccount(page, 'Rent', '6-03-010 — Rent Expense')
    await fillStable(page.locator('input[aria-label="Amount"]').first(), '100')

    await page.getByRole('button', { name: 'Save draft' }).click()
    await expect(page.getByText('Pick where this is paid from (Bank/Cash).')).toBeVisible()

    await page.locator('[aria-label="Select source of fund"]').click()
    await page.locator('body > div.fixed button').nth(1).click()
    await page.getByRole('button', { name: 'Save draft' }).click()
    await expect(page.getByText('Every line needs a Division.')).toBeVisible()
    expect(writes).toEqual([])
  })

  test('Sales Agent payee: a commission line reads its agent from the payee', async ({ page }) => {
    await pickPayee(page, 'Sales Agent')
    await expect(page.getByText('Sales Agent *').first()).toBeVisible()
    // Only the agent's own picker — not the customer / employee / supplier ones.
    await expect(page.getByText('Customer *')).toHaveCount(0)
    await expect(page.getByText('Employee *')).toHaveCount(0)

    await pickAccount(page, 'Commissions - S', '6-01-040 — Commissions - Sales')
    const commission = kindRow(page, 'AGENT_COMMISSION')
    await expect(commission).toBeVisible()
    await expect(page.getByText('Sales Invoice No. *')).toBeVisible()
    await expect(page.getByTestId('expense-kind-chip')).toHaveText(/sales commission expense/i)
    // The invoice picker is there from the start; the agent column reads the payee.
    await expect(commission.locator('[aria-label="Sales agent"]')).toHaveText('—')
    // No plate / liters / repair columns on a commission-only entry.
    await expect(page.getByText('Plate Number *')).toHaveCount(0)
  })

  test("Sales Agent payee: the line's Sales Agent column is the payee, read-only", async ({
    page,
  }) => {
    await pickPayee(page, 'Sales Agent')
    await pickAccount(page, 'Commissions - S', '6-01-040 — Commissions - Sales')
    const commission = kindRow(page, 'AGENT_COMMISSION')
    await expect(commission.locator('[aria-label="Sales agent"]')).toHaveText('—')

    await page.locator('[aria-label="Select sales agent"]').click()
    const firstAgent = page.locator('body > div.fixed button').nth(1)
    await expect(firstAgent).toBeVisible({ timeout: 10_000 })
    const agent = (await firstAgent.innerText()).trim()
    await firstAgent.click()
    // Whoever the payee is, the column names — one cheque pays one agent, so a line
    // cannot credit another.
    await expect(commission.locator('[aria-label="Sales agent"]')).toHaveText(agent)
  })

  test('Payee Other: no Special Account column for a Fuel line, back as soon as another line needs it', async ({
    page,
  }) => {
    const header = page.getByText('Special Account', { exact: true })
    const box = page.locator('input[aria-label="Special Account"]')

    await pickPayee(page, 'Other')
    await pickAccount(page, 'Rent', '6-03-010 — Rent Expense')
    // An ordinary line keeps its (inert) Special Account column.
    await expect(header).toHaveCount(1)
    await expect(box).toHaveCount(1)

    // A Fuel line has no use for one — no such ledger, and the detail row says
    // what it is for. With nothing else on the entry, the column goes entirely.
    await pickAccount(page, 'Fuel and', '6-04-010 — Fuel and Lubricants')
    await expect(kindRow(page, 'FUEL')).toBeVisible()
    await expect(header).toHaveCount(0)
    await expect(box).toHaveCount(0)

    // Another (still blank) line needs it, so the column comes back for the table;
    // the Fuel line's own cell stays empty.
    await page.getByRole('button', { name: 'Add Line' }).click()
    await expect(header).toHaveCount(1)
    await expect(box).toHaveCount(1)
  })

  test('Commissions - Sales is a commission on any payee: Sales Invoice No. and its own Sales Agent, payee untouched', async ({
    page,
  }) => {
    await pickPayee(page, 'Supplier')
    await pickAccount(page, 'Commissions - S', '6-01-040 — Commissions - Sales')
    const commission = kindRow(page, 'AGENT_COMMISSION')
    await expect(commission).toBeVisible()
    await expect(page.getByText('Sales Invoice No. *')).toBeVisible()
    await expect(page.getByText('Sales Agent *')).toBeVisible()
    await expect(page.getByTestId('expense-kind-chip')).toHaveText(/sales commission expense/i)
    // The payee is still a Supplier — nothing moved the entry to a Sales Agent.
    await expect(page.locator('[aria-label="Select supplier"]')).toBeVisible()
    await expect(page.locator('[aria-label="Select sales agent"]')).toHaveCount(0)

    // The line's own agent is picked on the line.
    const lineAgent = commission.locator('[aria-label="Line sales agent"]')
    await expect(lineAgent).toBeVisible()
    await lineAgent.click()
    const firstAgent = page.locator('body > div.fixed button').nth(1)
    await expect(firstAgent).toBeVisible({ timeout: 10_000 })
    const agent = (await firstAgent.innerText()).trim()
    await firstAgent.click()
    await expect(lineAgent).toHaveValue(agent)
  })

  test('a payroll run can still name Commissions - Sales as an ordinary line', async ({ page }) => {
    await pickPayee(page, 'Other')
    await page.getByRole('checkbox', { name: 'Payroll' }).check()
    await pickAccount(page, 'Commissions - S', '6-01-040 — Commissions - Sales')
    await expect(kindRow(page, 'AGENT_COMMISSION')).toHaveCount(0)
    await expect(page.getByText('Sales Invoice No. *')).toHaveCount(0)
    await expect(page.locator('[aria-label="Select sales agent"]')).toHaveCount(0)
  })
})
