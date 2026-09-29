import { test, expect } from '@playwright/test'
import { gotoReady } from './utils'

// The Serial Numbers list is where people look for a unit, so a row opens
// that unit's Serial History panel directly — no detour through its item.
test.describe('Inventory — Serial Numbers list opens a unit’s history', () => {
  test('clicking a serial number opens its Serial History panel', async ({ page }) => {
    await gotoReady(page, '/inventory/stock?tab=serials')

    const serialLink = page.getByTestId('serial-link').first()
    await expect(serialLink).toBeVisible({ timeout: 15_000 })
    const serialNumber = (await serialLink.innerText()).trim()
    await serialLink.click()

    const history = page.getByRole('dialog', { name: 'Serial History' })
    await expect(history).toBeVisible({ timeout: 10_000 })
    await expect(history.getByText(serialNumber, { exact: true })).toBeVisible()
    // Every unit has at least its start — a receipt, or "Added to inventory".
    await expect(history.getByTestId('serial-history-entry').first()).toBeVisible({
      timeout: 10_000,
    })

    await history.getByRole('button', { name: 'Close' }).click()
    await expect(history).toBeHidden()
  })
})
