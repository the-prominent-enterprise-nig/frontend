import { test, expect } from '@playwright/test'
import { gotoReady } from './utils'

// Scenario 62 Part 1 — Inventory sidebar regroup. Five top-level tabs, each a
// plain link like Item Master: Item Master, Stock Ledger, Stock Transaction
// (hub), Master Data (hub), Stock Report. Business Owner storage state sees
// every entry; role-based visibility is covered by the manual steps in the
// scenario doc, not here.

test.describe('Scenario 62 Part 1 — inventory sidebar', () => {
  test('shows the five inventory tabs with their targets', async ({ page }) => {
    await gotoReady(page, '/inventory/stock')

    const expected: Record<string, string> = {
      'Item Master': '/inventory/catalog',
      'Stock Ledger': '/inventory/stock',
      'Stock Transaction': '/inventory/stock-transaction',
      'Master Data': '/inventory/master-data',
      'Stock Report': '/inventory/reports',
    }

    for (const [label, href] of Object.entries(expected)) {
      await expect(page.getByRole('link', { name: label, exact: true }).first()).toHaveAttribute(
        'href',
        href
      )
    }
  })

  test('Stock Transaction hub lists its tabs', async ({ page }) => {
    await gotoReady(page, '/inventory/stock-transaction')

    const tabs = page.getByRole('navigation', { name: 'Module tabs' })
    for (const label of [
      'Receiving Report',
      'Stock Transfer',
      'Returns',
      'Quality Hold',
      'Backorders',
      'Stock Adjustments',
      'Purchase Order',
      'Stock Request',
      'Debit Memos',
      'Unit Documents',
    ]) {
      await expect(tabs.getByRole('link', { name: label, exact: true })).toBeVisible()
    }
  })

  test('Master Data hub lists its tabs', async ({ page }) => {
    await gotoReady(page, '/inventory/master-data')

    const tabs = page.getByRole('navigation', { name: 'Module tabs' })
    for (const label of ['Warehouses', 'Suppliers', 'Price Lists', 'Settings']) {
      await expect(tabs.getByRole('link', { name: label, exact: true })).toBeVisible()
    }
  })

  test('Stock Transaction sidebar link opens the hub, and a tab switches it', async ({ page }) => {
    await gotoReady(page, '/inventory/stock')
    await page.getByRole('link', { name: 'Stock Transaction', exact: true }).first().click()
    await expect(page).toHaveURL(/\/inventory\/stock-transaction/)

    await page
      .getByRole('navigation', { name: 'Module tabs' })
      .getByRole('link', { name: 'Stock Adjustments', exact: true })
      .click()
    await expect(page).toHaveURL(/\/inventory\/stock-transaction\?tab=adjustments/)
  })
})
