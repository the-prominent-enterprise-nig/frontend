import { test, expect } from '@playwright/test'
import { gotoReady, clickStable, fillStable } from './utils'

// Scenario 16, Part 3 — near-duplicate warning (pg_trgm trigram similarity).
// "ERP flags duplicate SKU/model" per the PDF — a non-blocking warning on the
// Add Item form, not a hard stop (the hard stop stays the SKU unique
// constraint, unaffected by this). Backend coverage:
// backend/test/item-duplicate-check.e2e-spec.ts.
//
// Uses the default Business Owner session (playwright.config.ts storageState)
// — no persona-switching needed since this isn't testing role-gating.

test.describe('Inventory — Item Master Near-Duplicate Warning (Scenario 16, Part 3)', () => {
  const createdItemIds: string[] = []

  test.afterEach(async ({ page }) => {
    for (const id of createdItemIds.splice(0)) {
      await page.request.delete(`/api/inventory/items/${id}`).catch(() => {})
    }
  })

  test('typing a near-identical name shows a non-blocking duplicate warning', async ({ page }) => {
    const marker = Date.now()
    const originalName = `Split-Type Aircon 2.0HP E2E ${marker}`
    const listRes = await page.request.get('/api/inventory/items?limit=1')
    const listJson = await listRes.json()
    const baseUnitId = listJson.data[0].baseUnit.id

    const seedRes = await page.request.post('/api/inventory/items', {
      data: { sku: `E2E-DUPWARN-${marker}`, name: originalName, baseUnitId },
    })
    const seeded = await seedRes.json()
    createdItemIds.push(seeded.id)

    await gotoReady(page, '/inventory/items')
    await clickStable(
      page.getByRole('button', { name: 'Add Item' }),
      page.getByRole('heading', { name: 'Add New Item' })
    )
    // The list page's own table sits behind the modal overlay and can contain
    // the same seeded item's name/SKU text — scope everything to the dialog
    // so assertions don't collide with it (same class of ambiguity as the
    // governance spec's badge-vs-filter-option collision).
    const dialog = page.getByRole('dialog', { name: 'Add New Item' })

    // Debounced (400ms) — retry the whole fill+check cycle together, since a
    // later hydration reconciliation can wipe the field before the debounce
    // fires (same race documented on the CRM duplicate-warning spec).
    const nameInput = dialog.getByPlaceholder('e.g. Wireless Mouse')
    await expect(async () => {
      await fillStable(nameInput, `Split Type Aircon 2.0 HP E2E ${marker}`)
      await expect(dialog.getByText(/similar item.*found/)).toBeVisible({ timeout: 3_000 })
    }).toPass({ timeout: 15_000 })
    await expect(dialog.getByText(originalName)).toBeVisible()

    // Changing to an unrelated name clears the warning — non-blocking, live.
    await expect(async () => {
      await fillStable(nameInput, `Totally Unrelated Product ${marker}-xyz`)
      await expect(dialog.getByText(/similar item.*found/)).not.toBeVisible({ timeout: 3_000 })
    }).toPass({ timeout: 15_000 })
  })
})
