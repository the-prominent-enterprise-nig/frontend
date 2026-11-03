import { test, expect } from '@playwright/test'
import { gotoReady } from './utils'

// Scenario 56 Part 11 — Add Item on the slimmed form. Opened from the Item Master
// hub: Scenario 80 (UAT WH-03) moved the button there from the Stock page.
// Costing method, Item Type and the accounting overrides live on Edit only.
// Opened and closed — nothing is created. The sidebar staying visible is a
// manual check (layout, not behaviour).

test.describe('Scenario 56 Part 11 — Add Item', () => {
  test('Item Master hub opens the slimmed Add New Item form', async ({ page }) => {
    await gotoReady(page, '/inventory/catalog')
    await page.getByRole('button', { name: 'Add Item' }).click()
    const form = page.getByRole('dialog', { name: 'Add New Item' })
    await expect(form.getByRole('heading', { name: 'Add New Item' })).toBeVisible({
      timeout: 20_000,
    })
    await expect(form.getByText('Costing Method', { exact: true })).toHaveCount(0)
    await expect(form.getByText('Item Type', { exact: true })).toHaveCount(0)
    await expect(form.getByText('Accounting (optional)')).toHaveCount(0)
    await form.getByRole('button', { name: 'Cancel' }).click()
    await expect(form).toHaveCount(0)
  })
})
