import { test, expect } from '@playwright/test'
import { gotoReady } from './utils'

/**
 * Scenario 61 Part 3 — the Daily Sales Monitoring sheet, the second tab on the
 * Daily Collection page.
 *
 * Read-only: opens a branch from the owner's roll-up, switches to the sales
 * tab and checks the sheet reproduces the client's form — the category
 * table and the two cuts that tie to total sales. No sign-offs: those are
 * the collection report's. Nothing is created, so there is nothing to clean up.
 *
 * Unlike the collection report, the owner sees this sheet whether or not the
 * branch has filed its Daily Collection form.
 *
 * Figures and their tie-outs are covered by
 * backend/test/daily-sales-monitoring.e2e-spec.ts.
 */
test.describe('POS — Daily Sales Monitoring sheet', () => {
  test('switches to the sales sheet and lays it out like the paper form', async ({ page }) => {
    await gotoReady(page, '/pos/daily-collection')

    await page.getByRole('button', { name: 'Bago', exact: true }).first().click()
    const salesTab = page.getByRole('tab', { name: 'Sales monitoring' })
    await expect(salesTab).toBeVisible()
    await salesTab.click()

    await expect(
      page.getByRole('heading', { name: 'Daily Sales & Collection Monitoring' })
    ).toBeVisible()
    await expect(salesTab).toHaveAttribute('aria-selected', 'true')

    // No "Not submitted yet" here: the owner reads this sheet before the
    // branch files.
    await expect(page.getByRole('heading', { name: 'Not submitted yet' })).toHaveCount(0)
    const sheet = page.locator('.print-sheet')
    await expect(sheet).toBeVisible()
    // Sales only — the collections are the Daily Collection Report's.
    await expect(sheet.getByText('For accounting', { exact: false })).toHaveCount(0)

    // Text is uppercased by CSS, so match the DOM text, not the rendering.
    for (const label of [
      'For sales · per category',
      'Appliances',
      'Furniture',
      '3E',
      'Non-3E',
      'Small items',
      'IT products',
      'Computers, laptops & accessories',
      'Cellphones',
      'Split type',
      'Total sales',
      'By channel',
      'Office sales',
      'Agent sales',
      'By invoice type',
      'Cash invoice (COD)',
      'Charge invoice',
    ]) {
      await expect(sheet.getByText(label, { exact: true })).toBeVisible()
    }
    // No sign-offs on this sheet — Prepared by / Checked by are the
    // collection report's.
    await expect(sheet.getByText('Equals total sales', { exact: true })).toHaveCount(0)
    await expect(sheet.getByText('Prepared by', { exact: false })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Print' })).toBeVisible()

    // Back to the collection report: the tab switch is a view change, not a
    // navigation, so the ledger is one click away.
    await page.getByRole('tab', { name: 'Collection report' }).click()
    await expect(page.getByRole('heading', { name: 'Daily Collection Report' })).toBeVisible()
  })
})
