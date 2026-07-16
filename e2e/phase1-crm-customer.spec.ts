import { test, expect } from '@playwright/test'
import { gotoReady, fillStable } from './utils'

// Phase 1 — CRM Add Customer (scenario step 1: "find or create the customer
// ... a customer can exist without buying").
test.describe('Phase 1 — CRM Add Customer', () => {
  test('creates a customer with no prior sale, then deletes it (cleanup)', async ({ page }) => {
    const uniqueSuffix = Date.now()
    const firstName = 'E2E'
    const lastName = `TestCustomer${uniqueSuffix}`
    const fullName = `${firstName} ${lastName}`

    await gotoReady(page, '/crm/customers/new')

    await fillStable(page.getByLabel('First name *'), firstName)
    await fillStable(page.getByLabel('Last name *'), lastName)
    await fillStable(page.getByLabel('Email'), `e2e.${uniqueSuffix}@example.com`)

    await page.getByRole('button', { name: 'Create customer' }).click()

    // Redirects straight to the new customer's detail page — no sale involved.
    await expect(page).toHaveURL(/\/crm\/customers\/[a-f0-9-]+$/, { timeout: 15_000 })
    await expect(page.getByRole('heading', { name: fullName })).toBeVisible()

    // Confirm it's findable by search from the customers list (also exercises
    // the search-by-name path the POS checkout customer picker relies on).
    await gotoReady(page, '/crm/customers')
    await fillStable(page.getByPlaceholder(/search code, name, email/i), lastName)
    await expect(page.getByText(fullName)).toBeVisible({ timeout: 10_000 })

    // Cleanup via the Danger Zone delete action so repeated runs don't pile
    // up test customers in the shared dev database.
    await page.getByText(fullName).click()
    await expect(page).toHaveURL(/\/crm\/customers\/[a-f0-9-]+$/, { timeout: 15_000 })
    page.once('dialog', (dialog) => dialog.accept())
    await page.getByRole('button', { name: 'Delete customer' }).click()
    await expect(page).toHaveURL(/\/crm\/customers$/, { timeout: 15_000 })
  })
})
