import { test, expect } from '@playwright/test'
import { gotoReady, clickStable, sweepE2EPriceLists, pickPriceUseType } from './utils'

const NAME_PREFIX = 'E2E Price List Versioning — '

test.describe('Inventory — Price Use Type Selector', () => {
  test.beforeAll(async ({ request }) => {
    await sweepE2EPriceLists(request, NAME_PREFIX)
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
