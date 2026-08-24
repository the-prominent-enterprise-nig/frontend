import { test, expect } from '@playwright/test'
import {
  gotoReady,
  clickStable,
  fillStable,
  loginAs,
  sweepE2EPriceUseTypes,
  openCustomSelect,
} from './utils'

const NAME_PREFIX = 'E2E Price Use Type — '

// Price Use Types no longer has its own route (Scenario 34) — it's a drawer
// opened from the Price Lists page, so every test starts there and opens it.
// Returns the drawer's own dialog locator: the underlying Price Lists table
// stays mounted (just backdrop-covered) while the drawer is open, and a price
// list referencing the same category renders that category's name in its own
// row too — an unscoped page-wide row query can match both, so callers that
// look up a category's row must search within this scope, not the whole page.
async function openPriceUseTypesDrawer(page: import('@playwright/test').Page) {
  await gotoReady(page, '/inventory/price-lists')
  // The drawer anchors its content to the right edge of the screen, which
  // lands on top of the React Query Devtools toggle button's oversized
  // hover-glow hit region (dev-mode only, bottom-right corner) — hide it so
  // it can't swallow clicks meant for the drawer's row actions.
  await page.addStyleTag({ content: '.tsqd-parent-container { display: none !important; }' })
  const heading = page.getByRole('heading', { name: 'Price Use Types' })
  await clickStable(page.getByRole('button', { name: 'Price Use Types' }), heading)
  // The drawer's panel stays mounted off-screen (translate-x-full) even while
  // closed, so its heading reads as toBeVisible() before the slide-in
  // transition actually brings it on screen — confirm real position too.
  await expect(heading).toBeInViewport({ timeout: 10_000 })
  return page.getByRole('dialog', { name: 'Price Use Types' })
}

test.describe('Inventory — Price Use Types', () => {
  test.beforeAll(async ({ request }) => {
    await sweepE2EPriceUseTypes(request, NAME_PREFIX)
  })

  test.afterEach(async ({ request }) => {
    await sweepE2EPriceUseTypes(request, NAME_PREFIX)
  })

  test('creates, renames, and deletes a price use type', async ({ page }) => {
    const name = `${NAME_PREFIX}${Date.now()}`
    const drawer = await openPriceUseTypesDrawer(page)

    await clickStable(
      page.getByRole('button', { name: 'New Price Use Type' }),
      page.getByRole('heading', { name: 'New Price Use Type' })
    )
    await fillStable(page.getByPlaceholder('e.g. SSC'), name)
    await page.getByRole('button', { name: 'Create', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'New Price Use Type' })).not.toBeVisible({
      timeout: 10_000,
    })

    const row = drawer.getByRole('row').filter({ hasText: name })
    await expect(row).toBeVisible()

    const renamed = `${name} (renamed)`
    await clickStable(
      row.getByRole('button', { name: 'Edit' }),
      page.getByRole('heading', { name: 'Edit Price Use Type' })
    )
    await fillStable(page.getByPlaceholder('e.g. SSC'), renamed)
    await page.locator('form').getByRole('button', { name: 'Save Changes' }).click()
    await expect(page.getByRole('heading', { name: 'Edit Price Use Type' })).not.toBeVisible({
      timeout: 10_000,
    })

    const renamedRow = drawer.getByRole('row').filter({ hasText: renamed })
    await expect(renamedRow).toBeVisible()

    await clickStable(
      renamedRow.getByRole('button', { name: 'Delete' }),
      page.getByRole('heading', { name: 'Delete price use type?' })
    )
    // .last(): the confirmation modal's submit button shares the accessible
    // name "Delete" with the row's own trash-icon button (same convention as
    // Approve/Reject in inventory-price-list-approval-workflow.spec.ts).
    await page.getByRole('button', { name: 'Delete', exact: true }).last().click()
    await expect(drawer.getByRole('row').filter({ hasText: renamed })).toHaveCount(0, {
      timeout: 10_000,
    })
  })

  test('blocks creating a duplicate name with a clear inline error', async ({ page, request }) => {
    const name = `${NAME_PREFIX}${Date.now()}`
    const create = await request.post('/api/inventory/price-use-types', {
      data: { name },
    })
    expect(create.ok()).toBeTruthy()

    await openPriceUseTypesDrawer(page)
    await clickStable(
      page.getByRole('button', { name: 'New Price Use Type' }),
      page.getByRole('heading', { name: 'New Price Use Type' })
    )
    await fillStable(page.getByPlaceholder('e.g. SSC'), name)
    await page.getByRole('button', { name: 'Create', exact: true }).click()
    await expect(page.getByText('A price use type with that name already exists.')).toBeVisible({
      timeout: 10_000,
    })
  })

  test('a newly created price use type appears in the price list form dropdown', async ({
    page,
  }) => {
    const name = `${NAME_PREFIX}${Date.now()}`
    await openPriceUseTypesDrawer(page)
    await clickStable(
      page.getByRole('button', { name: 'New Price Use Type' }),
      page.getByRole('heading', { name: 'New Price Use Type' })
    )
    await fillStable(page.getByPlaceholder('e.g. SSC'), name)
    await page.getByRole('button', { name: 'Create', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'New Price Use Type' })).not.toBeVisible({
      timeout: 10_000,
    })

    // The drawer's backdrop covers the underlying Price Lists page — close it
    // before reaching for "New Price List". Same toBeInViewport() caveat as
    // openPriceUseTypesDrawer: the panel stays mounted off-screen when
    // closed, so position (not plain visibility) is what proves it's shut.
    await page.keyboard.press('Escape')
    await expect(page.getByRole('heading', { name: 'Price Use Types' })).not.toBeInViewport({
      timeout: 10_000,
    })

    await clickStable(
      page.getByRole('button', { name: 'New Price List' }),
      page.getByRole('heading', { name: 'New Price List' })
    )
    // The dropdown's own async fetch can still be in flight right after the
    // modal's heading appears — open it and poll for the option instead of
    // taking a one-shot snapshot.
    await openCustomSelect(page.getByRole('combobox', { name: 'Select price use type…' }))
    await expect(page.getByRole('option', { name, exact: true })).toHaveCount(1, {
      timeout: 10_000,
    })
  })

  test('creates a price use type inline from the price list form, without losing what was already typed', async ({
    page,
    request,
  }) => {
    const listName = `E2E PL Inline Type Test ${Date.now()}`
    const typeName = `${NAME_PREFIX}${Date.now()}`

    await gotoReady(page, '/inventory/price-lists')
    await clickStable(
      page.getByRole('button', { name: 'New Price List' }),
      page.getByRole('heading', { name: 'New Price List' })
    )
    await fillStable(page.getByPlaceholder('e.g. Retail Standard 2026'), listName)

    await openCustomSelect(page.getByRole('combobox', { name: 'Select price use type…' }))
    await page.getByRole('button', { name: 'Add new price use type…' }).click()
    await expect(page.getByRole('heading', { name: 'New Price Use Type' })).toBeVisible({
      timeout: 10_000,
    })

    await fillStable(page.getByPlaceholder('e.g. SSC'), typeName)
    await page.getByRole('button', { name: 'Create', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'New Price Use Type' })).not.toBeVisible({
      timeout: 10_000,
    })

    // Back on the New Price List modal: the name typed earlier survived, and
    // the dropdown now shows the type just created as selected — not reset
    // to the empty placeholder. The combobox's accessible name IS its
    // current selection, so this alone proves both.
    await expect(page.getByRole('heading', { name: 'New Price List' })).toBeVisible()
    await expect(page.getByPlaceholder('e.g. Retail Standard 2026')).toHaveValue(listName)
    await expect(page.getByRole('combobox', { name: typeName, exact: true })).toBeVisible()

    await page.getByRole('button', { name: 'Create Price List' }).click()
    await expect(page.getByRole('heading', { name: 'New Price List' })).not.toBeVisible({
      timeout: 10_000,
    })
    const row = page.getByRole('row').filter({ hasText: listName })
    await expect(row).toBeVisible()
    await expect(row).toContainText(typeName)

    // Cleanup: the price list has to go before the type it references can
    // be deleted (same FK restriction the in-use-delete-block test covers).
    const listsRes = await request.get(
      `/api/inventory/price-lists?search=${encodeURIComponent(listName)}`
    )
    const lists = (await listsRes.json()) as { id: string; name: string }[]
    const match = lists.find((l) => l.name === listName)
    if (match) await request.delete(`/api/inventory/price-lists/${match.id}`)
  })

  test('shows a clear error when deleting a price use type still referenced by a price list', async ({
    page,
    request,
  }) => {
    const name = `${NAME_PREFIX}${Date.now()}`
    const type = await request.post('/api/inventory/price-use-types', { data: { name } })
    expect(type.ok()).toBeTruthy()
    const typeId = (await type.json()).id as string

    const list = await request.post('/api/inventory/price-lists', {
      data: { name: `E2E PL References Type ${Date.now()}`, priceUseTypeId: typeId },
    })
    expect(list.ok()).toBeTruthy()
    const listId = (await list.json()).id as string

    const drawer = await openPriceUseTypesDrawer(page)
    const row = drawer.getByRole('row').filter({ hasText: name })
    await clickStable(
      row.getByRole('button', { name: 'Delete' }),
      page.getByRole('heading', { name: 'Delete price use type?' })
    )
    await page.getByRole('button', { name: 'Delete', exact: true }).last().click()

    await expect(
      page.getByText(
        'This price use type is still used by one or more price lists — reassign or remove those first.'
      )
    ).toBeVisible({ timeout: 10_000 })
    // The row must still be there — the failed delete didn't optimistically remove it.
    await expect(row).toBeVisible()

    // Cleanup: the price list has to go before afterEach's type sweep can
    // succeed (the same FK restriction this test is exercising).
    await request.delete(`/api/inventory/price-lists/${listId}`)
  })

  test('toggles a price use type inactive/active via the Status switch (Scenario 37)', async ({
    page,
    request,
  }) => {
    const name = `${NAME_PREFIX}${Date.now()}`
    const created = await request.post('/api/inventory/price-use-types', { data: { name } })
    expect(created.ok()).toBeTruthy()

    const drawer = await openPriceUseTypesDrawer(page)
    const row = drawer.getByRole('row').filter({ hasText: name })
    await expect(row).toBeVisible()

    const toggle = row.getByRole('switch')
    await expect(toggle).toHaveAttribute('aria-checked', 'true')

    await toggle.click()
    await expect(toggle).toHaveAttribute('aria-checked', 'false', { timeout: 10_000 })

    await toggle.click()
    await expect(toggle).toHaveAttribute('aria-checked', 'true', { timeout: 10_000 })
  })
})

test.describe('Inventory — Price Use Types — RBAC', () => {
  // A user with zero inventory permissions must never even reach the Price
  // Lists page the categories drawer lives in — opts out of the shared
  // Business Owner storageState every other test in this file inherits, same
  // convention as cit-monitor.spec.ts.
  test.use({ storageState: { cookies: [], origins: [] } })

  const ACCOUNTANT_EMAIL = process.env.E2E_ACCOUNTANT_EMAIL ?? 'technova.b1.accounting@test.com'
  const PASSWORD = process.env.E2E_ROLE_PASSWORD ?? 'dev-prominent-enterprise-2026'

  test('a user with no inventory permissions is redirected away from the Price Lists page', async ({
    page,
  }) => {
    await loginAs(page, ACCOUNTANT_EMAIL, PASSWORD)
    await gotoReady(page, '/inventory/price-lists')
    await expect(page).toHaveURL(/\/403$/, { timeout: 10_000 })
  })
})
