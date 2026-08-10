import { test, expect } from '@playwright/test'
import {
  gotoReady,
  clickStable,
  fillStable,
  sweepE2EPriceLists,
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
    await fillStable(page.getByPlaceholder('e.g. Retail Standard 2026'), name)
    await pickFromCustomSelect(page, 'Select price use type…', 'SKYRO')
    await page.getByRole('button', { name: 'Create Price List' }).click()
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
    await fillStable(page.getByPlaceholder('e.g. Retail Standard 2026'), nameB)
    await pickFromCustomSelect(page, 'Select price use type…', 'SKYRO')
    await pickFromCustomSelect(page, 'None — this is a new list, not a replacement', nameA)
    await page.getByRole('button', { name: 'Create Price List' }).click()
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

    // Expired lists are hidden by default (Scenario 15 follow-up — the page
    // now hides retired statuses so old test/production data doesn't clutter
    // the working view); reveal them to confirm A actually expired.
    await page.getByLabel('Show inactive/expired').check()
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
    await fillStable(page.getByPlaceholder('e.g. Retail Standard 2026'), `${NAME_PREFIX}Promo`)
    await pickFromCustomSelect(page, 'Select price use type…', 'PROMO')

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
