import { test, expect } from '@playwright/test'
import { gotoReady, fillAllStable, fillStable, fillPhoneStable } from './utils'

// CRM — Add Customer (scenario step 1: "find or create the customer ... a
// customer can exist without buying").
test.describe('CRM — Add Customer', () => {
  test('creates a customer with no prior sale, then deletes it (cleanup)', async ({ page }) => {
    const uniqueSuffix = Date.now()
    const firstName = 'E2E'
    const lastName = `TestCustomer${uniqueSuffix}`
    const fullName = `${firstName} ${lastName}`
    const streetAddress = `Unit ${uniqueSuffix} Test Street`

    await gotoReady(page, '/crm/customers/new')

    await fillAllStable([
      { locator: page.getByLabel('First name *'), value: firstName },
      { locator: page.getByLabel('Last name *'), value: lastName },
      { locator: page.getByLabel('Email'), value: `e2e.${uniqueSuffix}@example.com` },
      // Only the free-text line is needed — PhilippineAddressPicker composes
      // its output from whichever parts are non-empty, no need to drive the
      // cascading Region/Province/City/Barangay selects for this.
      {
        locator: page.getByPlaceholder('e.g. Blk 3 Lot 12, Mabuhay St.'),
        value: streetAddress,
      },
    ])
    // Phone is a PhoneInput (react-phone-number-input) — it reformats
    // whatever's typed, so it can't go through fillAllStable's exact-value
    // check and gets its own stable-fill helper instead.
    await fillPhoneStable(
      page.locator('.phone-input-field'),
      `9${uniqueSuffix.toString().slice(-9)}`
    )

    // Part 3 (scenario-02): co-maker capture.
    const coMakerName = `E2E Co-maker ${uniqueSuffix}`
    await page.getByRole('button', { name: 'Add co-maker' }).click()
    await fillAllStable([
      { locator: page.getByPlaceholder('e.g. Juan Dela Cruz'), value: coMakerName },
      { locator: page.getByPlaceholder('e.g. Spouse'), value: 'Spouse' },
      { locator: page.getByPlaceholder('e.g. 0917 000 1111'), value: '09171234567' },
    ])

    // The submit button can be un-hydrated (dead onClick) the instant navigation
    // finishes — same hydration race fillStable/fillAllStable work around for
    // inputs. Retries the click (generous 8s per attempt, so an in-flight but
    // slow submission is never mistaken for a no-op and double-submitted)
    // until the redirect to the new customer's detail page actually happens.
    await expect(async () => {
      await page.getByRole('button', { name: 'Create customer' }).click()
      await expect(page).toHaveURL(/\/crm\/customers\/[a-f0-9-]+$/, { timeout: 8_000 })
    }).toPass({ timeout: 20_000 })
    await expect(page.getByRole('heading', { name: fullName })).toBeVisible()

    // Part 2 (scenario-02): billingAddress should mirror shippingAddress —
    // Customer360 doesn't render billingAddress at all (it's an
    // Accounting-side display concern), so check the API response directly.
    const customerId = page.url().match(/\/crm\/customers\/([a-f0-9-]+)$/)?.[1]
    const detailRes = await page.request.get(`/api/crm/customers/${customerId}`)
    const detail = await detailRes.json()
    expect(detail.shippingAddress).toContain(streetAddress)
    expect(detail.billingAddress).toBe(detail.shippingAddress)

    // Co-maker shows in the profile's read-only display.
    await expect(page.getByText('Co-maker (Guarantor)')).toBeVisible()
    await expect(page.getByText(`${coMakerName} — Spouse`)).toBeVisible()

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
