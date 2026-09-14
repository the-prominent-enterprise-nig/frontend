import { test, expect, type Page, type Locator } from '@playwright/test'
import {
  gotoReady,
  clickStable,
  fillStable,
  findPriceListIdByName,
  sweepE2EPriceLists,
  pickPriceUseType,
  submitPriceListForm,
  openAddItemsPanel,
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
  await fillStable(page.getByPlaceholder('e.g. Credit Card — Reference Price 2026'), name)
  // 'ZI', not the seeded 'WIP'/'CR-BR' — the seeded/ambient data already has
  // real active WIP/CR-BR lists pricing common items like TV Stand, which
  // Part 4's date-overlap check would (correctly) reject a second one of.
  await pickPriceUseType(page, 'ZI')
  await submitPriceListForm(page, 'Create Price List')
  await expect(page.getByRole('heading', { name: 'New Price List' })).not.toBeVisible({
    timeout: 10_000,
  })
}

// Scenario 34 — "Manage Items" now navigates to a dedicated page instead of
// opening a modal.
async function addItemToList(
  page: Page,
  row: Locator,
  opts: { price: string; floorPrice?: string }
) {
  // Plain click, not clickStable — these are real <a href> Links, so a
  // single click always navigates even pre-hydration; clickStable's retry
  // would re-click a link that's no longer there once the first click
  // already navigated away, and just hang out the rest of its budget.
  await row.getByRole('link', { name: 'Manage Items' }).click()
  await openAddItemsPanel(page)

  await fillStable(page.getByLabel('Search items to add'), 'TV Stand')
  const result = page.getByRole('button', { name: /TV Stand/ })
  await expect(result.first()).toBeVisible({ timeout: 10_000 })
  await result.first().click()

  // Scoped to the Add panel's own table (identified by its always-present
  // "Apply to all" row) rather than page-wide "tbody tr" — once the list
  // already has an item, the (separate, non-editable) items table also has
  // rows, and a page-wide .last() can land there instead. Within the Add
  // panel's table specifically, the last row is always the just-staged item.
  const stagedRow = page
    .locator('table')
    .filter({ hasText: 'Apply to all' })
    .locator('tbody tr')
    .last()
  await fillStable(stagedRow.getByPlaceholder('0.00').first(), opts.price)
  if (opts.floorPrice) {
    await fillStable(stagedRow.getByPlaceholder('0.00').nth(1), opts.floorPrice)
  }
  await page.getByRole('button', { name: /^Add 1 Item$/ }).click()
  // Wait for the Add panel's own staged table to clear (it unmounts on a
  // successful add) before inspecting the items table — a toast isn't a
  // reliable signal here since sonner toasts stack/linger, so the "1 item
  // added" toast from THIS add can't be told apart from one left over from
  // the previous add still fading out. Until this clears, the still-staged
  // row and the items table's own row (from the earlier add) both match "TV
  // Stand" at once, a transient strict-mode violation.
  await expect(page.locator('table').filter({ hasText: 'Apply to all' })).not.toBeVisible({
    timeout: 15_000,
  })

  const itemRow = page.locator('tbody tr').filter({ hasText: 'TV Stand' })
  // Inline-editable table: the saved price is an input value, not row text.
  await expect(itemRow.getByLabel(/^Price for .* in this list$/)).toHaveValue(
    new RegExp(`^${opts.price}(\\.0+)?$`),
    { timeout: 10_000 }
  )

  await page.getByRole('link', { name: 'Back to Price Lists' }).click()
  await expect(page.getByRole('heading', { name: 'Price Lists' })).toBeVisible({
    timeout: 10_000,
  })
  await expect(page).toHaveURL('/inventory/price-lists', { timeout: 10_000 })
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

  // Covers the Price Use Type picker — a grid of cards, one per type, with
  // a trailing "New use type" tile that has to open a *different* modal
  // without disturbing whatever was already picked.
  test('Price Use Type picker marks the picked card and its "New use type" tile opens the nested modal', async ({
    page,
  }) => {
    await gotoReady(page, '/inventory/price-lists')
    await clickStable(
      page.getByRole('button', { name: 'New price list' }),
      page.getByRole('heading', { name: 'New price list' })
    )

    // Every seeded Price Use Type gets a card, and nothing starts picked.
    for (const label of ['CR-BR', 'PROMO', 'SSC', 'WIP', 'ZI']) {
      const card = page.getByRole('radio', { name: label, exact: true })
      await expect(card).toBeVisible()
      await expect(card).toHaveAttribute('aria-checked', 'false')
    }

    await pickPriceUseType(page, 'ZI')

    // Picking one card unpicks the rest — the grid is a radio group, not a
    // set of independent toggles.
    await expect(page.getByRole('radio', { name: 'PROMO', exact: true })).toHaveAttribute(
      'aria-checked',
      'false'
    )

    await clickStable(
      page.getByRole('button', { name: 'New use type', exact: true }),
      page.getByRole('heading', { name: 'New Price Use Type' })
    )
    // Both surfaces render a "Cancel" button while nested — the New Price
    // Use Type modal renders after (and visually on top of) the price list
    // drawer, so it's the last one in DOM order.
    await page.getByRole('button', { name: 'Cancel' }).last().click()
    await expect(page.getByRole('heading', { name: 'New Price Use Type' })).not.toBeVisible()

    // Cancelling the nested modal must not have cleared the outer selection.
    await expect(page.getByRole('radio', { name: 'ZI', exact: true })).toHaveAttribute(
      'aria-checked',
      'true'
    )

    await page.getByRole('button', { name: 'Cancel' }).click()
    await expect(page.getByRole('heading', { name: 'New price list' })).not.toBeVisible()
  })
})
