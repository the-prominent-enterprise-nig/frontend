import { test, expect } from '@playwright/test'
import { gotoReady, clickStable } from './utils'

test.describe('Inventory — item model & serial provenance UI', () => {
  test('Create Item form offers Model Number and an optional Initial Stock section', async ({
    page,
  }) => {
    await gotoReady(page, '/inventory/items')
    await clickStable(
      page.getByRole('button', { name: 'Add Item' }),
      page.getByRole('heading', { name: 'Add New Item' })
    )

    await expect(page.getByText('Model Number')).toBeVisible()

    // Initial Stock section is collapsed by default — open it.
    await clickStable(page.getByRole('button', { name: /Initial Stock/ }), page.getByText('RR #'))
    await expect(page.getByText('Date In')).toBeVisible()
    await expect(page.getByPlaceholder('Supplier name, or WHSE')).toBeVisible()
    await expect(page.getByPlaceholder('e.g. RR#163451S')).toBeVisible()
  })

  test('Category picker is searchable', async ({ page }) => {
    await gotoReady(page, '/inventory/items')
    await clickStable(
      page.getByRole('button', { name: 'Add Item' }),
      page.getByRole('heading', { name: 'Add New Item' })
    )

    await clickStable(
      page.getByRole('button', { name: 'Select category…' }),
      page.getByPlaceholder('Search categories…')
    )
  })

  test('Serial Numbers page offers a CSV import entry point describing the RR/group/subgroup columns', async ({
    page,
  }) => {
    await gotoReady(page, '/inventory/serial-numbers')
    await clickStable(
      page.getByRole('button', { name: 'Import CSV' }),
      page.getByRole('heading', { name: 'Import Serialized Inventory' })
    )

    await expect(
      page.getByText('dateIn, rr, brand, type, group, subgroup, model, serialNumber, price')
    ).toBeVisible()
    await expect(page.getByLabel('Warehouse')).toBeVisible()
    await expect(page.getByText('Preview only (validate without writing anything)')).toBeVisible()
  })
})
