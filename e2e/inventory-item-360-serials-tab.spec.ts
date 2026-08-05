import { test, expect } from '@playwright/test'
import { gotoReady, clickStable } from './utils'

test.describe('Inventory — Item 360 Serials tab', () => {
  test('drawer offers a Serials tab and splits Category/Subcategory in Overview', async ({
    page,
  }) => {
    await gotoReady(page, '/inventory/items')
    const searchInput = page.getByPlaceholder('Search by name or SKU…')
    await expect(searchInput).toBeVisible({ timeout: 15_000 })

    const firstRow = page.locator('tbody tr').first()
    await expect(firstRow).toBeVisible({ timeout: 10_000 })
    await firstRow.click()

    await expect(page.getByRole('button', { name: 'Overview' })).toBeVisible({ timeout: 10_000 })
    await expect(page.getByText('Category', { exact: true })).toBeVisible()
    await expect(page.getByText('Subcategory', { exact: true })).toBeVisible()

    await clickStable(
      page.getByRole('button', { name: 'Serials' }),
      page.getByText(/No serial numbers yet|Serial #/).first()
    )
  })
})
