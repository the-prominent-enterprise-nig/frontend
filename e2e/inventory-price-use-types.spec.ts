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

test.describe('Inventory — Price Use Types', () => {
  test.beforeAll(async ({ request }) => {
    await sweepE2EPriceUseTypes(request, NAME_PREFIX)
  })

  test.afterEach(async ({ request }) => {
    await sweepE2EPriceUseTypes(request, NAME_PREFIX)
  })

  test('creates, renames, and deletes a price use type', async ({ page }) => {
    const name = `${NAME_PREFIX}${Date.now()}`
    await gotoReady(page, '/inventory/price-use-types')

    await clickStable(
      page.getByRole('button', { name: 'New Price Use Type' }),
      page.getByRole('heading', { name: 'New Price Use Type' })
    )
    await fillStable(page.getByPlaceholder('e.g. SSC'), name)
    await page.getByRole('button', { name: 'Create', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'New Price Use Type' })).not.toBeVisible({
      timeout: 10_000,
    })

    const row = page.getByRole('row').filter({ hasText: name })
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

    const renamedRow = page.getByRole('row').filter({ hasText: renamed })
    await expect(renamedRow).toBeVisible()

    await clickStable(
      renamedRow.getByRole('button', { name: 'Delete' }),
      page.getByRole('heading', { name: 'Delete price use type?' })
    )
    // .last(): the confirmation modal's submit button shares the accessible
    // name "Delete" with the row's own trash-icon button (same convention as
    // Approve/Reject in inventory-price-list-approval-workflow.spec.ts).
    await page.getByRole('button', { name: 'Delete', exact: true }).last().click()
    await expect(page.getByRole('row').filter({ hasText: renamed })).toHaveCount(0, {
      timeout: 10_000,
    })
  })

  test('blocks creating a duplicate name with a clear inline error', async ({ page, request }) => {
    const name = `${NAME_PREFIX}${Date.now()}`
    const create = await request.post('/api/inventory/price-use-types', {
      data: { name },
    })
    expect(create.ok()).toBeTruthy()

    await gotoReady(page, '/inventory/price-use-types')
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
    await gotoReady(page, '/inventory/price-use-types')
    await clickStable(
      page.getByRole('button', { name: 'New Price Use Type' }),
      page.getByRole('heading', { name: 'New Price Use Type' })
    )
    await fillStable(page.getByPlaceholder('e.g. SSC'), name)
    await page.getByRole('button', { name: 'Create', exact: true }).click()
    await expect(page.getByRole('heading', { name: 'New Price Use Type' })).not.toBeVisible({
      timeout: 10_000,
    })

    await gotoReady(page, '/inventory/price-lists')
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

    await gotoReady(page, '/inventory/price-use-types')
    const row = page.getByRole('row').filter({ hasText: name })
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
})

test.describe('Inventory — Price Use Types — RBAC', () => {
  // A user with zero inventory permissions must never even see this page —
  // opts out of the shared Business Owner storageState every other test in
  // this file inherits, same convention as cit-monitor.spec.ts.
  test.use({ storageState: { cookies: [], origins: [] } })

  const ACCOUNTANT_EMAIL = process.env.E2E_ACCOUNTANT_EMAIL ?? 'technova.b1.accounting@test.com'
  const PASSWORD = process.env.E2E_ROLE_PASSWORD ?? 'dev-prominent-enterprise-2026'

  test('a user with no inventory permissions is redirected away from the page', async ({
    page,
  }) => {
    await loginAs(page, ACCOUNTANT_EMAIL, PASSWORD)
    await gotoReady(page, '/inventory/price-use-types')
    await expect(page).toHaveURL(/\/403$/, { timeout: 10_000 })
  })
})
