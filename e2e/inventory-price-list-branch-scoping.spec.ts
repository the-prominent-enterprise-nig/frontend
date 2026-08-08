import { test, expect } from '@playwright/test'
import {
  gotoReady,
  clickStable,
  fillStable,
  findPriceListIdByName,
  sweepE2EPriceLists,
  pickFromCustomSelect,
} from './utils'

const NAME_PREFIX = 'E2E Price List — '

test.describe('Inventory — Price List Branch Scoping', () => {
  test.beforeAll(async ({ request }) => {
    await sweepE2EPriceLists(request, NAME_PREFIX)
  })

  test('creates a branch-scoped price list, then edits its branches', async ({ page, request }) => {
    const name = `${NAME_PREFIX}${Date.now()}`
    await gotoReady(page, '/inventory/price-lists')

    await clickStable(
      page.getByRole('button', { name: 'New Price List' }),
      page.getByRole('heading', { name: 'New Price List' })
    )

    await fillStable(page.getByPlaceholder('e.g. Retail Standard 2026'), name)
    await pickFromCustomSelect(page, 'Select price use type…', 'SSC')
    await page.getByLabel('Manila HQ').check()
    await page.getByRole('button', { name: 'Create Price List' }).click()
    await expect(page.getByRole('heading', { name: 'New Price List' })).not.toBeVisible({
      timeout: 10_000,
    })

    const row = page.getByRole('row').filter({ hasText: name })
    await expect(row).toBeVisible()
    await expect(row).toContainText('Manila HQ')
    await expect(row).not.toContainText('All branches')

    // Edit lives in the row's overflow menu now, not as a direct button. Not
    // clickStable for the trigger: it toggles open/closed on every click.
    await row.getByRole('button', { name: 'More actions' }).click()
    await clickStable(
      page.getByRole('button', { name: 'Edit' }),
      page.getByRole('heading', { name: 'Edit Price List' })
    )
    await page.getByLabel('Cebu Office').check()
    await page.getByRole('button', { name: 'Save Changes' }).click()
    await expect(page.getByRole('heading', { name: 'Edit Price List' })).not.toBeVisible({
      timeout: 10_000,
    })

    const updatedRow = page.getByRole('row').filter({ hasText: name })
    await expect(updatedRow).toContainText('Manila HQ')
    await expect(updatedRow).toContainText('Cebu Office')

    const id = await findPriceListIdByName(request, name)
    await request.delete(`/api/inventory/price-lists/${id}`)
  })
})
