import { test, expect } from '@playwright/test'
import { gotoReady, loginAs } from './utils'

// Scenario 74 review, ownership answers B, C and F: a page opens on the
// permission of the module that owns it. The Finance Head holds Accounting
// only (no Inventory supplier or driver rights), and the Inventory Manager
// holds Inventory only (no Accounting debit memo rights).

const PASSWORD = process.env.E2E_ROLE_PASSWORD ?? 'dev-prominent-enterprise-2026'
const FINANCE_HEAD = 'technova.al-finance-head@test.com'
const INVENTORY_MANAGER = 'technova.al-inventory-manager@test.com'

test.describe('Pages open on the owning module’s permission', () => {
  test.use({ storageState: { cookies: [], origins: [] } })

  test('B: the Finance Head adds suppliers with Accounting’s permission', async ({ page }) => {
    await loginAs(page, FINANCE_HEAD, PASSWORD)
    await gotoReady(page, '/accounting/suppliers')
    await expect(page).not.toHaveURL(/\/403/)
    await expect(page.getByRole('button', { name: /New supplier/ })).toBeVisible()
  })

  test('C: the Finance Head opens Drivers and can add one', async ({ page }) => {
    await loginAs(page, FINANCE_HEAD, PASSWORD)
    const res = await page.request.get('/api/inventory/drivers')
    expect(res.status()).toBe(200)
    await gotoReady(page, '/accounting/drivers')
    await expect(page).not.toHaveURL(/\/403/)
    await expect(page.getByRole('link', { name: /Add Driver/ })).toBeVisible()
  })

  test('F: the Inventory Manager opens Inventory Debit Memos', async ({ page }) => {
    await loginAs(page, INVENTORY_MANAGER, PASSWORD)
    const res = await page.request.get('/api/inventory-debit-memos')
    expect(res.status()).toBe(200)
    await gotoReady(page, '/accounting/debit-memos')
    await expect(page).not.toHaveURL(/\/403/)
    await expect(page.getByRole('heading', { name: 'Debit Memos' })).toBeVisible()
  })
})
