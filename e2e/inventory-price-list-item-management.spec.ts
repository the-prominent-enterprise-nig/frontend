import { test, expect } from '@playwright/test'
import { gotoReady, fillStable, sweepE2EPriceLists, sweepE2EPriceUseTypes } from './utils'

// Scenario 34 Part 3 — the old "Manage Items" modal (unpaginated, single-item
// add) is now a dedicated page: paginated/searchable items table with
// checkbox bulk-remove, and a multi-select "Add Items" panel with an
// apply-to-all pricing shortcut.

const NAME_PREFIX = 'E2E Item Mgmt Page — '
const ITEM_NAME = 'Universal Remote Control'

async function createPriceListAndOpenPage(
  request: import('@playwright/test').APIRequestContext,
  page: import('@playwright/test').Page,
  status: 'pending_approval' | 'active' = 'pending_approval'
) {
  const typeRes = await request.post('/api/inventory/price-use-types', {
    data: { name: `${NAME_PREFIX}${Date.now()}` },
  })
  const typeId = (await typeRes.json()).id as string

  const listName = `${NAME_PREFIX}${Date.now()}`
  const listRes = await request.post('/api/inventory/price-lists', {
    data: { name: listName, priceUseTypeId: typeId },
  })
  const listId = (await listRes.json()).id as string

  if (status === 'active') {
    await request.post(`/api/inventory/price-lists/${listId}/approve`, { data: {} })
  }

  await gotoReady(page, `/inventory/price-lists/${listId}`)
  await expect(page.getByRole('heading', { name: listName })).toBeVisible({ timeout: 10_000 })

  return { listId, listName, typeId }
}

test.describe('Inventory — Price List item management page', () => {
  test.beforeAll(async ({ request }) => {
    await sweepE2EPriceLists(request, NAME_PREFIX)
    await sweepE2EPriceUseTypes(request, NAME_PREFIX)
  })

  test.afterEach(async ({ request }) => {
    await sweepE2EPriceLists(request, NAME_PREFIX)
    await sweepE2EPriceUseTypes(request, NAME_PREFIX)
  })

  test('adds multiple items in one batch using apply-to-all pricing, then searches and bulk-removes them', async ({
    page,
    request,
  }) => {
    const { listId } = await createPriceListAndOpenPage(request, page)

    // A second real item, fetched via API rather than hardcoded — the
    // catalog search matches Item.name, which doesn't necessarily equal
    // whatever composite label another page (e.g. POS) displays for it.
    const secondItemRes = await request.get('/api/inventory/items', {
      params: { search: 'Whirlpool', limit: '1' },
    })
    const secondItem = ((await secondItemRes.json()).data ?? [])[0] as { name: string } | undefined
    expect(secondItem).toBeTruthy()

    // ─── Multi-select add with apply-to-all ──────────────────────────────
    await fillStable(page.getByLabel('Search items to add'), 'Universal Remote')
    const firstResult = page.getByRole('button', { name: new RegExp(ITEM_NAME) })
    // The search dropdown's fetch is debounced 300ms — toBeVisible()'s own
    // retry (not a one-shot isVisible() check) is what actually waits for it.
    await expect(firstResult).toBeVisible({ timeout: 10_000 })
    await firstResult.first().click()

    await fillStable(page.getByLabel('Search items to add'), secondItem!.name)
    // Plain string (not RegExp) — item names can contain characters like
    // quotes/parens that aren't safe to splice into a regex literal.
    const secondResult = page.getByRole('button', { name: secondItem!.name })
    await expect(secondResult).toBeVisible({ timeout: 10_000 })
    await secondResult.first().click()

    // Apply-to-all: set one Price value and stamp it across every staged row.
    const applyAllRow = page.locator('tr', { hasText: 'Apply to all' })
    await fillStable(applyAllRow.getByPlaceholder('0.00').first(), '99.00')
    await applyAllRow.getByRole('button', { name: 'Apply', exact: true }).first().click()

    await page.getByRole('button', { name: /^Add \d Items?$/ }).click()
    await expect(page.getByText(/item.*added/i)).toBeVisible({ timeout: 10_000 })

    // Staged review table clears after a successful add — the real items
    // table (searchable/paginated) now shows what was just added.
    await expect(page.getByLabel('Search items to add')).toHaveValue('', { timeout: 10_000 })
    const remoteRow = page.locator('tbody tr').filter({ hasText: ITEM_NAME })
    await expect(remoteRow).toBeVisible({ timeout: 10_000 })
    await expect(remoteRow).toContainText('99')

    // ─── Search filters the items table ──────────────────────────────────
    await fillStable(page.getByPlaceholder('Search items by name or SKU…'), 'Nonexistent Zzz Item')
    await expect(page.getByText(/No items match/)).toBeVisible({ timeout: 10_000 })
    await fillStable(page.getByPlaceholder('Search items by name or SKU…'), ITEM_NAME)
    await expect(page.locator('tbody tr').filter({ hasText: ITEM_NAME })).toBeVisible({
      timeout: 10_000,
    })

    // ─── Bulk remove via row checkboxes ───────────────────────────────────
    page.once('dialog', (dialog) => dialog.accept())
    await page
      .locator('tbody tr')
      .filter({ hasText: ITEM_NAME })
      .getByRole('checkbox', { name: `Select ${ITEM_NAME}` })
      .check()
    await page.getByRole('button', { name: /Remove 1 item/ }).click()
    await expect(page.locator('tbody tr').filter({ hasText: ITEM_NAME })).toHaveCount(0, {
      timeout: 10_000,
    })

    await request.delete(`/api/inventory/price-lists/${listId}`)
  })

  test('locks the page read-only for a non-editable status, and shows a paginated total for a large item set', async ({
    page,
    request,
  }) => {
    const { listId } = await createPriceListAndOpenPage(request, page)

    // Seed 21 items via the API (batch upsert already supports arrays) to
    // exercise real pagination without a slow 21-click UI flow.
    const itemsRes = await request.get('/api/inventory/items', { params: { limit: '25' } })
    const items = ((await itemsRes.json()).data ?? []) as { id: string }[]
    expect(items.length).toBeGreaterThanOrEqual(21)
    await request.post(`/api/inventory/price-lists/${listId}/items`, {
      data: { items: items.slice(0, 21).map((i) => ({ itemId: i.id, price: 10 })) },
    })

    await page.reload({ waitUntil: 'domcontentloaded' })
    await expect(page.getByText(/Page 1 of 2 \(21 total\)/)).toBeVisible({ timeout: 10_000 })
    // exact: true — Next.js's own dev-tools button ("Open Next.js Dev
    // Tools") otherwise substring-matches "Next" too.
    await page.getByRole('button', { name: 'Next', exact: true }).click()
    await expect(page.getByText(/Page 2 of 2 \(21 total\)/)).toBeVisible({ timeout: 10_000 })

    // Deactivate the list (the only genuinely non-editable status —
    // pending_approval/rejected/active are all still editable), then confirm
    // the page locks read-only: no Add panel, no checkboxes.
    const deactivateRes = await request.delete(`/api/inventory/price-lists/${listId}`)
    expect(deactivateRes.ok()).toBeTruthy()
    await page.reload({ waitUntil: 'domcontentloaded' })

    await expect(page.getByText(/items are read-only/)).toBeVisible({ timeout: 10_000 })
    await expect(page.getByLabel('Search items to add')).not.toBeVisible()
    await expect(page.getByRole('checkbox').first()).not.toBeVisible()
  })

  test('reverts an active list to pending_approval when adding an item, with a banner and toast', async ({
    page,
    request,
  }) => {
    const { listId } = await createPriceListAndOpenPage(request, page, 'active')

    await expect(page.getByText(/currently active/)).toBeVisible({ timeout: 10_000 })

    await fillStable(page.getByLabel('Search items to add'), ITEM_NAME)
    await page
      .getByRole('button', { name: new RegExp(ITEM_NAME) })
      .first()
      .click()
    await fillStable(page.getByLabel(`Price for ${ITEM_NAME}`, { exact: true }), '50')
    await page.getByRole('button', { name: /^Add 1 Item$/ }).click()

    await expect(page.getByText(/back in Pending Approval/)).toBeVisible({ timeout: 10_000 })
    await expect(page.getByText('Pending', { exact: true })).toBeVisible({ timeout: 10_000 })

    await request.delete(`/api/inventory/price-lists/${listId}`)
  })
})
