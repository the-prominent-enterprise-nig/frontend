import { test, expect } from '@playwright/test'
import { gotoReady } from './utils'

// Scenario 08 (Caravan) Part 2 — "Caravan" view. Runs as Business
// Owner (only seeded storage state), who has no own branch — so this
// exercises the "must explicitly pick a branch first" path, the more
// involved of the two (a branch-restricted Stock Controller/Branch Manager
// never sees the picker at all; their own branch is forced server-side).
// No UI exists yet to actually consign a serial (Part 1 is API-only, by
// design — see the plan doc), so this covers structure/gating, not rendered
// consigned rows; see the scenario doc's manual test steps for that.
test.describe('Inventory — Caravan view', () => {
  test('tab switch reveals a branch picker for an unrestricted caller and gates the list until one is picked', async ({
    page,
  }) => {
    await gotoReady(page, '/inventory/serial-numbers')

    const allSerialsTab = page.getByRole('button', { name: 'All Serials' })
    const caravanTab = page.getByRole('button', { name: 'Caravan' })
    await expect(allSerialsTab).toBeVisible({ timeout: 15_000 })
    await expect(caravanTab).toBeVisible()

    await caravanTab.click()

    // Business Owner has no own branch — the view must gate on an explicit
    // pick rather than silently querying with no branch at all.
    await expect(
      page.getByText("Select a branch above to see what's consigned to it.")
    ).toBeVisible({ timeout: 10_000 })

    // Regression: the query is disabled until a branch is picked, but
    // `keepPreviousData` still holds whatever the All Serials tab's own
    // query last returned — without gating the table on this too, that
    // stale, unrelated list rendered right alongside this prompt, and no
    // filter could ever change it since the query itself wasn't running.
    await expect(page.locator('table')).toHaveCount(0)

    const branchPicker = page.getByPlaceholder('Select a branch…')
    await expect(branchPicker).toBeVisible()

    await branchPicker.click()
    const firstOption = page
      .locator('[role="option"], li, button')
      .filter({ hasText: /HQ|Office|Branch/ })
    await expect(firstOption.first()).toBeVisible({ timeout: 10_000 })
    await firstOption.first().click()

    // Once a branch is picked, the gating prompt clears — either the table
    // or the "nothing consigned" empty state renders, never the prompt.
    await expect(
      page.getByText("Select a branch above to see what's consigned to it.")
    ).toHaveCount(0, { timeout: 10_000 })

    const emptyState = page.getByText('Nothing currently consigned to this branch')
    const table = page.locator('table')
    await expect(emptyState.or(table)).toBeVisible({ timeout: 10_000 })

    // Switching back to All Serials restores the normal warehouse filter and
    // drops the branch picker entirely.
    await allSerialsTab.click()
    await expect(branchPicker).toHaveCount(0)
  })

  // Regression for the bug above: once a branch IS picked and the Caravan
  // query is genuinely running, search/status/item filters must actually
  // narrow the result set — not just render whatever the last-enabled query
  // happened to return. Self-cleaning: returns both fixtures to origin.
  test('search, status, and item filters narrow the Caravan tab once a branch is picked', async ({
    page,
  }) => {
    const branchesRes = await page.request.get('/api/branches?limit=200')
    const branches = (await branchesRes.json()).data as { id: string; name: string }[]
    const [origin, host] = branches

    const serialsRes = await page.request.get(
      `/api/inventory/serial-numbers?branchId=${origin.id}&status=in_stock&limit=50`
    )
    const serials = (await serialsRes.json()).data as {
      id: string
      serialNumber: string
      item: { id: string; sku: string; name: string }
    }[]
    const serialA = serials[0]
    const found = serials.find((s) => s.item.id !== serialA.item.id)
    expect(serialA).toBeTruthy()
    expect(found).toBeTruthy()
    const serialB = found!

    const consignRes = await page.request.post('/api/inventory/serial-numbers/consign', {
      data: { serialNumberIds: [serialA.id, serialB.id], hostBranchId: host.id },
    })
    expect(consignRes.ok()).toBe(true)

    try {
      await gotoReady(page, '/inventory/serial-numbers')
      await page.getByRole('button', { name: 'Caravan' }).click()

      const branchPicker = page.getByPlaceholder('Select a branch…')
      if (await branchPicker.isVisible().catch(() => false)) {
        await branchPicker.click()
        await page.getByText(host.name, { exact: true }).click()
      }

      await expect(page.locator('tbody tr', { hasText: serialA.serialNumber })).toBeVisible({
        timeout: 15_000,
      })
      await expect(page.locator('tbody tr', { hasText: serialB.serialNumber })).toBeVisible()

      // Item filter is a SearchableSelect (native <select> would size its
      // closed state to its widest option — see SerialNumberList.tsx), not a
      // plain <select>.
      const itemPicker = page.getByPlaceholder('All Items')
      await itemPicker.click()
      await page.getByText(`${serialA.item.sku} — ${serialA.item.name}`, { exact: true }).click()
      await expect(page.locator('tbody tr', { hasText: serialA.serialNumber })).toBeVisible({
        timeout: 10_000,
      })
      await expect(page.locator('tbody tr', { hasText: serialB.serialNumber })).toHaveCount(0)

      await page.getByRole('button', { name: 'Clear selection' }).click()
      await expect(page.locator('tbody tr', { hasText: serialB.serialNumber })).toBeVisible({
        timeout: 10_000,
      })

      const searchBox = page.getByPlaceholder('Search serial numbers…')
      await expect(async () => {
        await searchBox.fill(serialA.serialNumber)
        await expect(page.locator('tbody tr', { hasText: serialB.serialNumber })).toHaveCount(0, {
          timeout: 3_000,
        })
      }).toPass({ timeout: 20_000 })
      await expect(page.locator('tbody tr', { hasText: serialA.serialNumber })).toBeVisible()
    } finally {
      await page.request.post('/api/inventory/serial-numbers/close-consignment', {
        data: { serialNumberIds: [serialA.id, serialB.id] },
      })
    }
  })
})
