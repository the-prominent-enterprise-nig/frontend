import { test, expect, type Page } from '@playwright/test'
import { gotoReady } from './utils'

// Scenario 73 Part 4 — Create RR, Reason = Repair/Return, gains an Origin
// field. From Customer keeps today's form (Repair Type, invoice blocks).
// From Service Center replaces Repair Type with a Service Center picker
// (repair providers holding units) and the invoice blocks with the units out
// at that service center, plus a search-by-serial fallback. Posting itself is
// covered by backend/test/scenario-73-service-center-receipt.e2e-spec.ts;
// this spec creates nothing, so there is nothing to clean up.

/** SearchableSelect has no role of its own; each sits in a labelled Field. */
function fieldInput(page: Page, label: string) {
  return page.locator('label', { hasText: label }).locator('input').first()
}

async function pick(page: Page, label: string, option: string): Promise<void> {
  await expect(async () => {
    await fieldInput(page, label).click()
    await page.getByText(option, { exact: true }).last().click({ timeout: 2_000 })
    await expect(fieldInput(page, label)).toHaveValue(option)
  }).toPass({ timeout: 15_000 })
}

test.describe('Scenario 73 — Create RR from a service center', () => {
  test('Origin swaps Repair Type for the Service Center picker and its units', async ({ page }) => {
    await gotoReady(page, '/inventory/stock-transaction?tab=receiving&new=1')
    await expect(page.getByText('Delivery details')).toBeVisible({ timeout: 30_000 })

    await pick(page, 'Reason', 'Repair/Return')

    // From Customer is the default: today's form, unchanged.
    await expect(fieldInput(page, 'Origin')).toHaveValue('From Customer')
    await expect(page.locator('label', { hasText: 'Repair Type' })).toBeVisible()
    await expect(page.getByText('Units for Repair/Return')).toBeVisible()
    await expect(page.getByPlaceholder('Select service center…')).toHaveCount(0)
    await expect(page.getByPlaceholder('Select location…')).toHaveCount(0)

    await pick(page, 'Origin', 'From Service Center')

    await expect(page.locator('label', { hasText: 'Repair Type' })).toHaveCount(0)
    await expect(page.getByPlaceholder('Select service center…')).toBeVisible()
    // Where the unit lands is the custodian's call, prefilled with their own.
    await expect(page.locator('label', { hasText: 'Location' })).toBeVisible()
    await expect(page.locator('label', { hasText: 'Service Center DR #' })).toBeVisible()
    await expect(page.getByText('Units for Repair/Return')).toHaveCount(0)
    await expect(
      page.getByText('Pick the service center above to list the units out there.')
    ).toBeVisible()
    // No UDS/RFS scans for a unit coming back from a service center.
    await expect(page.getByText('RFS — Repair Form Sheet')).toHaveCount(0)

    // Posting without a service center names what is missing.
    await page.getByRole('button', { name: 'Create Receiving Report' }).click()
    await expect(
      page.getByText('Pick the service center the units came back from.').first()
    ).toBeVisible()

    // Back to From Customer restores Repair Type and the invoice blocks.
    await pick(page, 'Origin', 'From Customer')
    await expect(page.locator('label', { hasText: 'Repair Type' })).toBeVisible()
    await expect(page.getByText('Units for Repair/Return')).toBeVisible()
  })

  test('Part 5 — Home Service asks for its service center', async ({ page }) => {
    await gotoReady(page, '/inventory/stock-transaction?tab=receiving&new=1')
    await expect(page.getByText('Delivery details')).toBeVisible({ timeout: 30_000 })
    await pick(page, 'Reason', 'Repair/Return')

    await pick(page, 'Repair Type', 'In-Store')
    await expect(
      page.getByText('Who services the unit at the customer’s home', { exact: false })
    ).toHaveCount(0)

    await pick(page, 'Repair Type', 'Home Service')
    await expect(
      page.getByText('Who services the unit at the customer’s home', { exact: false })
    ).toBeVisible()

    await page.getByRole('button', { name: 'Create Receiving Report' }).click()
    await expect(
      page.getByText('Pick the service center handling this Home Service.').first()
    ).toBeVisible()
  })

  test('Part 5 — the UDS list filters by service center', async ({ page }) => {
    await gotoReady(page, '/inventory/uds')
    await expect(page.getByPlaceholder('All service centers')).toBeVisible({ timeout: 30_000 })
  })
})
