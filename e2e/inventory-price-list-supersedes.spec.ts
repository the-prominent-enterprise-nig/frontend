import { test, expect } from '@playwright/test'
import {
  gotoReady,
  clickStable,
  fillStable,
  sweepE2EPriceLists,
  pickPriceUseType,
  submitPriceListForm,
  pickFromCustomSelect,
} from './utils'

// Scenario 15, Part 4 — the backend's version-history mechanism
// (PriceList.supersedesId, auto-expiring the prior version on approval) was
// already live and tested, but had no UI to actually set it. Uses SKYRO
// (Scenario 15 Part 1) since it's guaranteed to have no other active price
// list anywhere in this suite.

const NAME_PREFIX = 'E2E Price List Supersedes — '

test.describe('Inventory — Price List Supersedes picker', () => {
  test.beforeAll(async ({ request }) => {
    await sweepE2EPriceLists(request, NAME_PREFIX)
  })

  async function createAndApprove(page: import('@playwright/test').Page, name: string) {
    await gotoReady(page, '/inventory/price-lists')
    await clickStable(
      page.getByRole('button', { name: 'New Price List' }),
      page.getByRole('heading', { name: 'New Price List' })
    )
    await fillStable(page.getByPlaceholder('e.g. Credit Card — Reference Price 2026'), name)
    await pickPriceUseType(page, 'SKYRO')
    await submitPriceListForm(page, 'Create Price List')
    await expect(page.getByRole('heading', { name: 'New Price List' })).not.toBeVisible({
      timeout: 10_000,
    })

    const row = page.getByRole('row').filter({ hasText: name })
    await clickStable(
      row.getByRole('button', { name: 'Approve' }),
      page.getByRole('heading', { name: 'Approve Price List' })
    )
    await page.getByRole('button', { name: 'Approve', exact: true }).last().click()
    await expect(page.getByRole('heading', { name: 'Approve Price List' })).not.toBeVisible({
      timeout: 10_000,
    })
    await expect(row).toContainText('Active')
  }

  test('picking a same-type prior list as "Supersedes" auto-expires it once the new one is approved', async ({
    page,
    request,
  }) => {
    const nameA = `${NAME_PREFIX}A ${Date.now()}`
    await createAndApprove(page, nameA)

    // ─── Create B, superseding A ────────────────────────────────────────
    const nameB = `${NAME_PREFIX}B ${Date.now()}`
    await gotoReady(page, '/inventory/price-lists')
    await clickStable(
      page.getByRole('button', { name: 'New Price List' }),
      page.getByRole('heading', { name: 'New Price List' })
    )
    await fillStable(page.getByPlaceholder('e.g. Credit Card — Reference Price 2026'), nameB)
    await pickPriceUseType(page, 'SKYRO')
    await submitPriceListForm(page, 'Create Price List', async () => {
      await pickFromCustomSelect(page, 'None — this is a new list, not a replacement', nameA)
    })
    await expect(page.getByRole('heading', { name: 'New Price List' })).not.toBeVisible({
      timeout: 10_000,
    })

    const rowB = page.getByRole('row').filter({ hasText: nameB })
    await clickStable(
      rowB.getByRole('button', { name: 'Approve' }),
      page.getByRole('heading', { name: 'Approve Price List' })
    )
    await page.getByRole('button', { name: 'Approve', exact: true }).last().click()
    await expect(page.getByRole('heading', { name: 'Approve Price List' })).not.toBeVisible({
      timeout: 10_000,
    })

    await expect(rowB).toContainText('Active')

    // Every status is loaded now (the redesign's status pills and coverage
    // tiles count across all of them), so A's row is on screen without a
    // reveal step — only its status had to change.
    const rowA = page.getByRole('row').filter({ hasText: nameA })
    await expect(rowA).toContainText('Expired', { timeout: 10_000 })

    await sweepE2EPriceLists(request, NAME_PREFIX)
  })

  test('the Supersedes picker only offers lists under the same Price Use Type', async ({
    page,
    request,
  }) => {
    // A live under SKYRO, unrelated to this test's own PROMO-typed list —
    // confirms cross-type lists never leak into the candidate dropdown.
    const nameSkyro = `${NAME_PREFIX}Skyro ${Date.now()}`
    await createAndApprove(page, nameSkyro)

    await gotoReady(page, '/inventory/price-lists')
    await clickStable(
      page.getByRole('button', { name: 'New Price List' }),
      page.getByRole('heading', { name: 'New Price List' })
    )
    await fillStable(
      page.getByPlaceholder('e.g. Credit Card — Reference Price 2026'),
      `${NAME_PREFIX}Promo`
    )
    await pickPriceUseType(page, 'PROMO')
    // Supersedes sits further down the same page, under Where it applies.
    await expect(page.getByRole('heading', { name: 'Where it applies' })).toBeVisible({
      timeout: 10_000,
    })

    const supersedesCombobox = page.getByRole('combobox', {
      name: 'None — this is a new list, not a replacement',
    })
    await supersedesCombobox.click()
    await expect(page.getByRole('option', { name: nameSkyro })).toHaveCount(0)
    await page.keyboard.press('Escape')

    await page.getByRole('button', { name: 'Cancel' }).click()
    await sweepE2EPriceLists(request, NAME_PREFIX)
  })
})
