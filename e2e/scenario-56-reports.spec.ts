import { test, expect } from '@playwright/test'
import { gotoReady } from './utils'

// Scenario 56 Part 7 — Receiving Reports list shows each receipt's delivery
// state and supplier-invoice state. The partial-invoicing 3-way match, the
// SI/DR search and deliveryStatus itself are covered server-side in
// backend/test/receiving-partial-invoicing.e2e-spec.ts. Read-only.

test.describe('Scenario 56 Part 7 — Receiving Reports', () => {
  test('Reports table has a Delivery / SI column', async ({ page }) => {
    await gotoReady(page, '/inventory/stock?tab=reports')
    const table = page.getByRole('table', { name: 'Receiving reports' })
    await expect(table.getByRole('columnheader', { name: 'Delivery / SI' })).toBeVisible({
      timeout: 20_000,
    })
  })
})
