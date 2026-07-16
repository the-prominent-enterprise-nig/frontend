import { test, expect } from '@playwright/test'
import { gotoReady, clickStable } from './utils'

test.describe('Inventory — Item Master', () => {
  test('create form offers a Dual Serial (Indoor + Outdoor) toggle', async ({ page }) => {
    await gotoReady(page, '/inventory/items')
    await clickStable(
      page.getByRole('button', { name: 'Add Item' }),
      page.getByRole('heading', { name: 'Add New Item' })
    )
    await expect(page.getByText('Dual Serial (Indoor + Outdoor)')).toBeVisible()
  })
})
