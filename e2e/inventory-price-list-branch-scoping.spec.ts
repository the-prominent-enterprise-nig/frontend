import { test, expect } from '@playwright/test'
import {
  gotoReady,
  clickStable,
  fillStable,
  findPriceListIdByName,
  sweepE2EPriceLists,
  pickPriceUseType,
  submitPriceListForm,
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

    await fillStable(page.getByPlaceholder('e.g. Credit Card — Reference Price 2026'), name)
    await pickPriceUseType(page, 'SSC')
    await submitPriceListForm(page, 'Create Price List', async () => {
      // Branch pickers only appear once the scope is switched off
      // company-wide — an empty branch list is what "all branches" means.
      await page.getByRole('button', { name: 'Specific branches' }).click()
      await page.getByLabel('Bago').check()
    })
    await expect(page.getByRole('heading', { name: 'New Price List' })).not.toBeVisible({
      timeout: 10_000,
    })

    const row = page.getByRole('row').filter({ hasText: name })
    await expect(row).toBeVisible()
    await expect(row).toContainText('Bago')
    await expect(row).not.toContainText('All branches')

    // Edit lives in the row's overflow menu now, not as a direct button. Not
    // clickStable for the trigger: it toggles open/closed on every click.
    await row.getByRole('button', { name: 'More actions' }).click()
    await clickStable(
      page.getByRole('button', { name: 'Edit' }),
      page.getByRole('heading', { name: 'Edit Price List' })
    )
    await submitPriceListForm(page, 'Save Changes', async () => {
      await page.getByLabel('Binalbagan').check()
    })
    await expect(page.getByRole('heading', { name: 'Edit Price List' })).not.toBeVisible({
      timeout: 10_000,
    })

    const updatedRow = page.getByRole('row').filter({ hasText: name })
    await expect(updatedRow).toContainText('Bago')
    await expect(updatedRow).toContainText('Binalbagan')

    const id = await findPriceListIdByName(request, name)
    await request.delete(`/api/inventory/price-lists/${id}`)
  })
})
