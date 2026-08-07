import { test, expect, type Page, type Locator } from '@playwright/test'
import {
  gotoReady,
  clickStable,
  fillStable,
  findPriceListIdByName,
  sweepE2EPriceLists,
  openCustomSelect,
  pickFromCustomSelect,
} from './utils'

const NAME_PREFIX = 'E2E Price List Versioning — '

function rowByExactName(page: Page, exactName: string): Locator {
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
  await pickFromCustomSelect(page, 'Select price use type…', 'ZI')
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

test.describe('Inventory — Price List Floor Price & Price Use Type Selector', () => {
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

  // Covers the custom-rendered Price Use Type dropdown (src/components/ui/
  // Select.tsx) that replaced the native <select> — its own open/close,
  // selected-value display, and the "Add new price use type…" trailing
  // action, which used to be just another <option> and is now a distinct
  // row with its own click handler that has to open a *different* modal
  // without disturbing whatever was already picked.
  test('Price Use Type selector shows the picked value and its "Add new" action opens the nested modal', async ({
    page,
  }) => {
    await gotoReady(page, '/inventory/price-lists')
    await clickStable(
      page.getByRole('button', { name: 'New Price List' }),
      page.getByRole('heading', { name: 'New Price List' })
    )

    // The combobox's accessible name IS its current label — "Select price
    // use type…" before picking anything, "ZI" after — so it has to be
    // re-queried by whatever name is current at each step, not held as one
    // locator across the whole test.
    const placeholderTrigger = page.getByRole('combobox', { name: 'Select price use type…' })
    await openCustomSelect(placeholderTrigger)

    // Every seeded Price Use Type is offered, plus the trailing action, and
    // nothing starts pre-selected.
    for (const label of ['CR-BR', 'PROMO', 'SSC', 'WIP', 'ZI']) {
      const option = page.getByRole('option', { name: label, exact: true })
      await expect(option).toBeVisible()
      await expect(option).toHaveAttribute('aria-selected', 'false')
    }
    await expect(page.getByRole('button', { name: 'Add new price use type…' })).toBeVisible()

    await page.getByRole('option', { name: 'ZI', exact: true }).click()

    // The trigger now reads the picked label instead of the placeholder.
    const ziTrigger = page.getByRole('combobox', { name: 'ZI', exact: true })
    await expect(ziTrigger).toBeVisible()
    await expect(ziTrigger).toHaveAttribute('aria-expanded', 'false')

    // Reopening shows the same option now marked selected, not just picked.
    await openCustomSelect(ziTrigger)
    await expect(page.getByRole('option', { name: 'ZI', exact: true })).toHaveAttribute(
      'aria-selected',
      'true'
    )

    await clickStable(
      page.getByRole('button', { name: 'Add new price use type…' }),
      page.getByRole('heading', { name: 'New Price Use Type' })
    )
    // Both modals render a "Cancel" button while nested — the New Price Use
    // Type modal renders after (and visually on top of) New Price List's own,
    // so it's the last one in DOM order.
    await page.getByRole('button', { name: 'Cancel' }).last().click()
    await expect(page.getByRole('heading', { name: 'New Price Use Type' })).not.toBeVisible()

    // Cancelling the nested modal must not have cleared the outer selection.
    await expect(ziTrigger).toBeVisible()

    await page.getByRole('button', { name: 'Cancel' }).click()
    await expect(page.getByRole('heading', { name: 'New Price List' })).not.toBeVisible()
  })
})
