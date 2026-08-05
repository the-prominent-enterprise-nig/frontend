import { test, expect, type Page, type Locator } from '@playwright/test'
import {
  gotoReady,
  clickStable,
  fillStable,
  findPriceListIdByName,
  sweepE2EPriceLists,
} from './utils'

const NAME_PREFIX = 'E2E Price List Versioning — '

function rowByExactName(page: Page, exactName: string): Locator {
  // Plain `hasText` would also match "<name> (new version)" against the
  // original <name> row, since hasText is a substring check — exact-match
  // on the name cell's own text is the only way to tell them apart.
  return page.locator('tbody tr').filter({ has: page.getByText(exactName, { exact: true }) })
}

async function createPendingPriceList(page: Page, name: string) {
  await gotoReady(page, '/inventory/price-lists')
  await clickStable(
    page.getByRole('button', { name: 'New Price List' }),
    page.getByRole('heading', { name: 'New Price List' })
  )
  await fillStable(page.getByPlaceholder('e.g. Retail Standard 2026'), name)
  // 'ZI', not the seeded 'WIP'/'CR-BR' — the seeded/ambient data already has
  // real active WIP/CR-BR lists pricing common items like TV Stand, which
  // Part 4's date-overlap check would (correctly) reject a second one of.
  await page.locator('select[name="priceUseTypeId"]').selectOption({ label: 'ZI' })
  await page.locator('select[name="currency"]').selectOption({ value: 'PHP' })
  await page.getByRole('button', { name: 'Create Price List' }).click()
  await expect(page.getByRole('heading', { name: 'New Price List' })).not.toBeVisible({
    timeout: 10_000,
  })
}

async function addItemToList(
  page: Page,
  row: Locator,
  opts: { price: string; floorPrice?: string }
) {
  await clickStable(
    row.getByRole('button', { name: 'Manage Items' }),
    page.getByRole('heading', { name: 'Manage Items' })
  )
  await clickStable(
    page.getByRole('button', { name: 'Add Item' }),
    page.getByPlaceholder('Search item by name or SKU…')
  )
  await page.getByPlaceholder('Search item by name or SKU…').fill('TV Stand')
  await page
    .getByRole('button', { name: /TV Stand/ })
    .first()
    .click()
  await fillStable(page.getByPlaceholder('0.00').first(), opts.price)
  if (opts.floorPrice) {
    await fillStable(page.getByPlaceholder('0.00').nth(1), opts.floorPrice)
  }
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  const itemRow = page.locator('tbody tr').filter({ hasText: 'TV Stand' })
  await expect(itemRow).toContainText(opts.price, { timeout: 10_000 })
  await page.getByRole('button', { name: 'Close' }).click()
  await expect(page.getByRole('heading', { name: 'Manage Items' })).not.toBeVisible()
}

test.describe('Inventory — Price List Floor Price & Versioning', () => {
  test.beforeAll(async ({ request }) => {
    await sweepE2EPriceLists(request, NAME_PREFIX)
  })

  test('blocks approval below floor price, allows it once the price is raised', async ({
    page,
    request,
  }) => {
    const name = `${NAME_PREFIX}Floor ${Date.now()}`
    await createPendingPriceList(page, name)

    const row = rowByExactName(page, name)
    await addItemToList(page, row, { price: '10', floorPrice: '50' })

    await clickStable(
      row.getByRole('button', { name: 'Approve' }),
      page.getByRole('heading', { name: 'Approve Price List' })
    )
    await page.getByRole('button', { name: 'Approve', exact: true }).last().click()
    await expect(page.getByRole('heading', { name: 'Approve Price List' })).not.toBeVisible({
      timeout: 10_000,
    })
    await expect(row).toContainText('Pending')

    await addItemToList(page, row, { price: '60', floorPrice: '50' })

    await clickStable(
      row.getByRole('button', { name: 'Approve' }),
      page.getByRole('heading', { name: 'Approve Price List' })
    )
    await page.getByRole('button', { name: 'Approve', exact: true }).last().click()
    await expect(page.getByRole('heading', { name: 'Approve Price List' })).not.toBeVisible({
      timeout: 10_000,
    })
    await expect(row).toContainText('Active')

    const id = await findPriceListIdByName(request, name)
    await request.delete(`/api/inventory/price-lists/${id}`)
  })

  test('creating a new version and approving it auto-expires the version it supersedes', async ({
    page,
    request,
  }) => {
    const name = `${NAME_PREFIX}Version ${Date.now()}`
    await createPendingPriceList(page, name)

    const row = rowByExactName(page, name)
    await clickStable(
      row.getByRole('button', { name: 'Approve' }),
      page.getByRole('heading', { name: 'Approve Price List' })
    )
    await page.getByRole('button', { name: 'Approve', exact: true }).last().click()
    await expect(row).toContainText('Active')

    await clickStable(
      row.getByRole('button', { name: 'New Version' }),
      page.getByRole('heading', { name: 'New Version' })
    )
    await expect(page.getByText(`This will supersede ${name}`, { exact: false })).toBeVisible()
    await page.getByRole('button', { name: 'Create New Version' }).click()
    await expect(page.getByRole('heading', { name: 'New Version' })).not.toBeVisible({
      timeout: 10_000,
    })

    const newVersionName = `${name} (new version)`
    const newRow = rowByExactName(page, newVersionName)
    await expect(newRow).toContainText('Pending')

    await clickStable(
      newRow.getByRole('button', { name: 'Approve' }),
      page.getByRole('heading', { name: 'Approve Price List' })
    )
    await page.getByRole('button', { name: 'Approve', exact: true }).last().click()
    await expect(newRow).toContainText('Active')

    await expect(row).toContainText('Expired')

    const id1 = await findPriceListIdByName(request, name)
    const id2 = await findPriceListIdByName(request, newVersionName)
    await request.delete(`/api/inventory/price-lists/${id1}`)
    await request.delete(`/api/inventory/price-lists/${id2}`)
  })
})
