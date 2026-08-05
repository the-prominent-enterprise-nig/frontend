import { test, expect } from '@playwright/test'
import {
  gotoReady,
  clickStable,
  fillStable,
  findPriceListIdByName,
  sweepE2EPriceLists,
} from './utils'

const NAME_PREFIX = 'E2E Price List Approval — '

test.describe('Inventory — Price List Approval Workflow', () => {
  test.beforeAll(async ({ request }) => {
    await sweepE2EPriceLists(request, NAME_PREFIX)
  })

  async function createDraftPriceList(page: import('@playwright/test').Page, name: string) {
    await gotoReady(page, '/inventory/price-lists')
    await clickStable(
      page.getByRole('button', { name: 'New Price List' }),
      page.getByRole('heading', { name: 'New Price List' })
    )
    await fillStable(page.getByPlaceholder('e.g. Retail Standard 2026'), name)
    await page.locator('select[name="priceUseTypeId"]').selectOption({ label: 'PROMO' })
    await page.locator('select[name="currency"]').selectOption({ value: 'PHP' })
    await page.getByRole('button', { name: 'Create Price List' }).click()
    await expect(page.getByRole('heading', { name: 'New Price List' })).not.toBeVisible({
      timeout: 10_000,
    })
  }

  test('creates a pending price list and approves it', async ({ page, request }) => {
    const name = `${NAME_PREFIX}Approve ${Date.now()}`
    await createDraftPriceList(page, name)

    const row = page.getByRole('row').filter({ hasText: name })
    await expect(row).toContainText('Pending')

    await clickStable(
      row.getByRole('button', { name: 'Approve' }),
      page.getByRole('heading', { name: 'Approve Price List' })
    )
    // .last(): the modal's submit button shares the accessible name "Approve"
    // with the row's own trigger button, which stays in the DOM underneath.
    await page.getByRole('button', { name: 'Approve', exact: true }).last().click()
    await expect(page.getByRole('heading', { name: 'Approve Price List' })).not.toBeVisible({
      timeout: 10_000,
    })

    await expect(row).toContainText('Active')

    const id = await findPriceListIdByName(request, name)
    await request.delete(`/api/inventory/price-lists/${id}`)
  })

  test('rejects a pending price list, then resubmits it', async ({ page, request }) => {
    const name = `${NAME_PREFIX}Reject ${Date.now()}`
    await createDraftPriceList(page, name)

    const row = page.getByRole('row').filter({ hasText: name })
    await clickStable(
      row.getByRole('button', { name: 'Reject' }),
      page.getByRole('heading', { name: 'Reject Price List' })
    )
    await fillStable(
      page.getByPlaceholder('Provide a reason for rejection…'),
      'Floor price too low'
    )
    // .last(): same DOM-overlap reasoning as the approve button above.
    await page.getByRole('button', { name: 'Reject', exact: true }).last().click()
    await expect(page.getByRole('heading', { name: 'Reject Price List' })).not.toBeVisible({
      timeout: 10_000,
    })

    await expect(row).toContainText('Rejected')

    await clickStable(row.getByRole('button', { name: 'Resubmit' }), row.getByText('Pending'))
    await expect(row).toContainText('Pending')

    const id = await findPriceListIdByName(request, name)
    await request.delete(`/api/inventory/price-lists/${id}`)
  })
})
