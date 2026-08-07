import { test, expect } from '@playwright/test'
import { gotoReady, fillStable, clickStable } from './utils'

// Scenario 08 (Caravan) — "Consign to Branch" UI + event name/dates. Runs as
// Business Owner (only seeded storage state) — has no own branch, so the
// consign endpoint accepts any explicit hostBranchId with no own-branch
// restriction. Self-cleaning: closes the consignment via a direct API call
// (this spec is about consigning, not event close — that's covered by
// inventory-caravan-close.spec.ts) so it doesn't leave a stray consigned
// serial behind for other specs/manual QA to trip over.
test.describe('Inventory — Consign to Branch', () => {
  test('selecting an in-stock serial and consigning it to a host branch with an event name/dates shows up on the Caravan tab', async ({
    page,
  }) => {
    const branchesRes = await page.request.get('/api/branches?limit=200')
    expect(branchesRes.ok()).toBe(true)
    const branches = (await branchesRes.json()).data as { id: string; name: string }[]
    expect(branches.length).toBeGreaterThanOrEqual(2)
    const [origin, host] = branches

    const serialsRes = await page.request.get(
      `/api/inventory/serial-numbers?branchId=${origin.id}&status=in_stock&limit=1`
    )
    expect(serialsRes.ok()).toBe(true)
    const serials = (await serialsRes.json()).data as { id: string; serialNumber: string }[]
    expect(serials.length).toBeGreaterThanOrEqual(1)
    const serial = serials[0]

    await gotoReady(page, '/inventory/serial-numbers')

    const row = page.locator('tbody tr', { hasText: serial.serialNumber })
    // Bundled fill+check retry, same pattern as auth.setup.ts/loginAs() — a
    // hydration reconciliation that lands after fillStable's own value check
    // passes can still silently wipe this controlled search input before the
    // resulting filtered query ever renders.
    await expect(async () => {
      await fillStable(page.getByPlaceholder('Search serial numbers…'), serial.serialNumber)
      await expect(row).toBeVisible({ timeout: 3_000 })
    }).toPass({ timeout: 20_000 })

    await row.getByRole('checkbox').check()
    await expect(page.getByText('1 selected')).toBeVisible()

    await clickStable(
      page.getByRole('button', { name: 'Consign to Branch' }),
      page.getByRole('heading', { name: 'Consign to Branch' })
    )

    const hostPicker = page.getByPlaceholder('Search host branch…')
    await hostPicker.click()
    await page.getByText(host.name, { exact: true }).click()

    // Regression: reopening the picker after a selection must keep showing
    // the picked branch's name, not blank back to an empty search box (the
    // underlying value was never actually cleared, only the display was).
    await expect(hostPicker).toHaveValue(host.name)
    await hostPicker.click()
    await expect(hostPicker).toHaveValue(host.name)

    await fillStable(page.getByPlaceholder(/Summer Caravan/), 'E2E Consign Test Event')
    await page.locator('input[type="date"]').first().fill('2026-08-15')
    await page.locator('input[type="date"]').nth(1).fill('2026-08-17')

    await expect(async () => {
      await page.getByRole('button', { name: /Consign 1 Serial/ }).click()
      await expect(page.getByText('Consigned to branch')).toBeVisible({ timeout: 3_000 })
    }).toPass({ timeout: 20_000 })

    await page.getByRole('button', { name: 'Caravan' }).click()

    const branchPicker = page.getByPlaceholder('Select a branch…')
    if (await branchPicker.isVisible().catch(() => false)) {
      await branchPicker.click()
      await page.getByText(host.name, { exact: true }).click()
    }

    const caravanRow = page.locator('tbody tr', { hasText: serial.serialNumber })
    await expect(caravanRow).toBeVisible({ timeout: 15_000 })
    await expect(caravanRow).toContainText('E2E Consign Test Event')

    const closeRes = await page.request.post('/api/inventory/serial-numbers/close-consignment', {
      data: { serialNumberIds: [serial.id] },
    })
    expect(closeRes.ok()).toBe(true)
  })
})
