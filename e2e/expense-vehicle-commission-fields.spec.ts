/**
 * Client item #10 — Fuel, Vehicle Repair & Maintenance and Sales Commission
 * expense lines carry extra fields, decided by the line's own account
 * (Account.expenseKind), shown on a detail row under the line.
 *
 * UI contract only: the rules the server enforces (plate required, service type
 * required, the sale must be the agent's, a sale is released once) are proven in
 * backend/src/accounting/expenses/expenses-vehicle-commission.spec.ts. Needs the
 * seeded fleet roster, which prisma/seed.ts loads. The Sales Agent → pick-a-sale
 * path needs an agent with a sale, which the seed does not create, so it stops at
 * "pick the agent first".
 *
 * Self-cleaning: never submits the form, so nothing is created.
 */

import { test, expect, type Page } from '@playwright/test'
import { gotoReady } from './utils'

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

    const fuel = page.locator('[data-testid="line-kind-fuel"]')
    await expect(fuel).toBeVisible()
    await expect(fuel.getByText('Plate No. *')).toBeVisible()
    // The type is part of the plate's label (`<plate> - <type>`), not a box of its own.
    await expect(fuel.getByText('Vehicle Type')).toHaveCount(0)
    await expect(fuel.getByText('Liters (optional)')).toBeVisible()
    // The roster lists a driver per vehicle; an expense line is not tied to one.
    await expect(fuel.getByText(/driver/i)).toHaveCount(0)

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
    await expect(fuel.getByText(/driver/i)).toHaveCount(0)
  })

  test('a plate the roster lists twice shows as two distinguishable vehicles', async ({ page }) => {
    await pickPayee(page, 'Supplier')
    await pickAccount(page, 'Fuel and', '6-04-010 — Fuel and Lubricants')
    const plate = page.locator('[data-testid="line-kind-fuel"] [aria-label="Plate number"]')
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

  test('the Drivers screen calls the roster tag "Vehicle Type", not "Tag / Area"', async ({
    page,
  }) => {
    await gotoReady(page, '/inventory/master-data?tab=drivers')
    await expect(page.getByRole('columnheader', { name: 'Vehicle Type' })).toBeVisible({
      timeout: 15_000,
    })
    await expect(page.getByText('Tag / Area')).toHaveCount(0)
  })

  test('moving the line to Vehicle Repairs swaps the row and asks for the kind of job', async ({
    page,
  }) => {
    await pickPayee(page, 'Supplier')
    await pickAccount(page, 'Fuel and', '6-04-010 — Fuel and Lubricants')
    await expect(page.locator('[data-testid="line-kind-fuel"]')).toBeVisible()

    await pickAccount(page, 'Vehicle Rep', '6-04-030 — Vehicle Repairs and Maintenance')
    const repair = page.locator('[data-testid="line-kind-vehicle_repair"]')
    await expect(repair).toBeVisible()
    await expect(page.locator('[data-testid="line-kind-fuel"]')).toHaveCount(0)
    await expect(repair.getByText('Repair/Service Type *')).toBeVisible()
    await expect(repair.getByText('Service detail / remarks')).toBeVisible()

    await repair.getByText('— Select —').last().click()
    for (const type of ['Oil Change', 'Tires', 'Battery', 'Others']) {
      await expect(page.getByRole('option', { name: type, exact: true })).toBeVisible()
    }
  })

  test('an account with no kind gets no detail row', async ({ page }) => {
    await pickPayee(page, 'Supplier')
    await pickAccount(page, 'Rent', '6-03-010 — Rent Expense')
    await expect(page.locator('[data-testid^="line-kind-"]')).toHaveCount(0)
  })

  test('Sales Agent payee: a commission line asks for the agent before an invoice', async ({
    page,
  }) => {
    await pickPayee(page, 'Sales Agent')
    await expect(page.getByText('Sales Agent *').first()).toBeVisible()

    await pickAccount(page, 'Commissions - S', '6-01-040 — Commissions - Sales')
    const commission = page.locator('[data-testid="line-kind-agent_commission"]')
    await expect(commission).toBeVisible()
    await expect(commission.getByText(/Pick the Sales Agent above first/)).toBeVisible()
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
    await expect(page.locator('[data-testid="line-kind-fuel"]')).toBeVisible()
    await expect(header).toHaveCount(0)
    await expect(box).toHaveCount(0)

    // Another (still blank) line needs it, so the column comes back for the table;
    // the Fuel line's own cell stays empty.
    await page.getByText('Add line').click()
    await expect(header).toHaveCount(1)
    await expect(box).toHaveCount(1)
  })

  test('Commissions - Sales is an ordinary line on any other payee', async ({ page }) => {
    await pickPayee(page, 'Supplier')
    await pickAccount(page, 'Commissions - S', '6-01-040 — Commissions - Sales')
    await expect(page.locator('[data-testid="line-kind-agent_commission"]')).toHaveCount(0)
  })
})
