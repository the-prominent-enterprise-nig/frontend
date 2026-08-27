import { test, expect } from '@playwright/test'
import { gotoReady } from './utils'

// Scenario 29 (Accounting section), missing widget — Cash Flow Forecast has
// a real backend module and frontend page, both fully built, but was never
// linked from the dashboard's Module Navigation grid at all.

test.describe('Accounting Dashboard — Cash Flow Forecast Link', () => {
  test('Module Navigation links to the real Cash Flow Forecast page', async ({ page }) => {
    await gotoReady(page, '/accounting')

    const link = page.getByRole('link', { name: 'Cash Flow Forecast', exact: true })
    await expect(link).toBeVisible({ timeout: 15_000 })
    await link.click()

    await expect(page).toHaveURL(/\/accounting\/cash-forecast$/)
    // Confirm it's a real page, not a 404/blank route.
    await expect(page.getByText(/not found/i)).toHaveCount(0)
  })
})
