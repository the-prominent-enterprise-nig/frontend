import { test, expect } from '@playwright/test'
import { gotoReady } from './utils'

/**
 * Ticket #27 — Repair and Return are separate on Create Receiving Report.
 *
 * Return uses Repair's own fields (Location, Invoice #, Returned by /
 * Customer ID / Sold at, unit checkboxes) plus a "What happens" choice per
 * checked unit, and Record return posts the POS customer return itself — stock
 * back, customer credited, RRC # issued, one record. Repair-only fields
 * (Origin, Repair Type) stay off it, and a return is one invoice. The posting
 * rules and the Receiving list rows are covered server-side in the backend's
 * repair-intake-sales.e2e-spec.ts.
 */

test.describe('Inventory — Create RR, Return reason (ticket #27)', () => {
  test("Return uses Repair's fields and posts with Record return", async ({ page }) => {
    await gotoReady(page, '/inventory/stock-transaction?tab=receiving&new=1')
    await expect(page.getByRole('button', { name: /create receiving report/i })).toBeVisible({
      timeout: 30_000,
    })

    // Reason is a SearchableSelect: its value sits in a text input, and its
    // options are buttons.
    await page.locator('input[value="Regular Supplier Delivery"]').click()
    await page
      .getByTestId('searchable-select-option')
      .filter({ hasText: /^Return$/ })
      .click()

    await expect(page.getByText('Units for Return')).toBeVisible()
    await expect(page.getByText('Invoice #', { exact: true }).first()).toBeVisible()
    await expect(page.getByText('Repair Type', { exact: true })).toBeHidden()
    await expect(page.getByText('Origin', { exact: true })).toBeHidden()
    await expect(page.getByRole('button', { name: /add another invoice/i })).toBeHidden()

    const record = page.getByRole('button', { name: 'Record return' })
    await expect(record).toBeVisible()
    await expect(page.getByRole('button', { name: /create receiving report/i })).toBeHidden()

    // Nothing checked: refused, with the reason on screen.
    await record.click()
    await expect(page.getByText('Check at least one unit.')).toBeVisible()
  })
})
