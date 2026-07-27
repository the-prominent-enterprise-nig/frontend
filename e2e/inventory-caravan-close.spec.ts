import { test, expect } from '@playwright/test'
import { gotoReady } from './utils'

// Scenario 08 (Caravan) Part 4 — event close (return to origin / move onward).
// No UI exists yet to CREATE a consignment (Part 1's consign endpoint is
// API-only, by design — see the plan doc), so setup uses page.request
// (shares the already-authenticated browser session's authToken cookie via
// the Next.js API proxy) to consign a real serial before exercising the
// actual feature under test — selecting it and closing the consignment —
// through the real UI. Self-cleaning: "Return to Origin" reverses the setup.
test.describe('Inventory — Caravan event close', () => {
  test('selecting a consigned row and clicking Return to Origin clears the consignment', async ({
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

    const consignRes = await page.request.post('/api/inventory/serial-numbers/consign', {
      data: { serialNumberIds: [serial.id], hostBranchId: host.id },
    })
    expect(consignRes.ok()).toBe(true)

    await gotoReady(page, '/inventory/serial-numbers')
    await page.getByRole('button', { name: 'Caravan' }).click()

    const branchPicker = page.getByPlaceholder('Select a branch…')
    if (await branchPicker.isVisible().catch(() => false)) {
      await branchPicker.click()
      await page.getByText(host.name, { exact: true }).click()
    }

    const row = page.locator('tbody tr', { hasText: serial.serialNumber })
    await expect(row).toBeVisible({ timeout: 15_000 })

    await row.getByRole('checkbox').check()
    await expect(page.getByText('1 selected')).toBeVisible()

    await page.getByRole('button', { name: 'Return to Origin' }).click()

    await expect(page.getByText('Consignment returned to origin')).toBeVisible({
      timeout: 10_000,
    })
    await expect(row).toHaveCount(0, { timeout: 10_000 })
  })
})
