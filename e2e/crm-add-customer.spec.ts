import { test, expect, type Page } from '@playwright/test'
import {
  deleteCustomers,
  fillAllStable,
  fillPhoneStable,
  fillStable,
  gotoReady,
  sweepE2ECustomers,
} from './utils'

const NAME_PREFIX = 'E2E TestCustomer'

// A real, stable Region → Province → City → Barangay chain from the
// self-hosted PH address dataset (public/data/ph-address) — used to drive
// PhilippineAddressPicker's cascading SearchableSelects end to end so the
// test proves the actual brgy_code round-trips, not just the free-text
// street line (which the original version of this test only covered).
const PH_CHAIN = {
  region: 'National Capital Region (NCR)',
  province: 'Ncr, Second District',
  city: 'Quezon City',
  barangay: 'Alicia',
  barangayCode: '137404001',
}

/** Drives PhilippineAddressPicker's SearchableSelect (type-ahead combobox,
 * not a native <select>) — types the option's own label to narrow the list,
 * then clicks the matching option button. Wrapped in toPass: selecting a
 * parent level (e.g. Region) resets and reloads the next level's option
 * list, so the child combobox isn't interactive until that settles. */
async function pickAddressLevel(page: Page, fieldLabel: string, optionLabel: string) {
  const combobox = page.getByPlaceholder(new RegExp(`Type to search ${fieldLabel}`, 'i'))
  await expect(async () => {
    await combobox.click()
    await combobox.fill(optionLabel)
    const option = page.getByRole('button', { name: optionLabel, exact: true })
    await expect(option).toBeVisible({ timeout: 2_000 })
    await option.click()
    await expect(combobox).toHaveValue(optionLabel, { timeout: 2_000 })
  }).toPass({ timeout: 15_000 })
}

// CRM — Add Customer (scenario step 1: "find or create the customer ... a
// customer can exist without buying").
test.describe('CRM — Add Customer', () => {
  let createdIds: string[] = []

  test.beforeAll(async ({ request }) => {
    await sweepE2ECustomers(request, NAME_PREFIX)
  })

  test.afterEach(async ({ request }) => {
    await deleteCustomers(request, createdIds)
    createdIds = []
  })

  test('creates a customer with no prior sale', async ({ page }) => {
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
      {
        locator: page.getByPlaceholder('e.g. Blk 3 Lot 12, Mabuhay St.'),
        value: streetAddress,
      },
    ])
    // Scenario 24 Part 2: drive the cascading Region/Province/City/Barangay
    // selects so the picker emits a real brgy_code, not just the free-text
    // street line — proves the code actually round-trips end to end.
    await pickAddressLevel(page, 'region', PH_CHAIN.region)
    await pickAddressLevel(page, 'province', PH_CHAIN.province)
    await pickAddressLevel(page, 'city', PH_CHAIN.city)
    // Once a city is chosen but before a barangay is picked, the ambiguity
    // warning shows — proves a typed street value can't be mistaken for an
    // actual barangay pick (found live, 2026-08-10: a customer ended up with
    // a complete-looking address but no barangayCode this exact way).
    await expect(page.getByText('No barangay picked yet')).toBeVisible()
    await pickAddressLevel(page, 'barangay', PH_CHAIN.barangay)
    await expect(page.getByText(`Barangay selected: ${PH_CHAIN.barangay}`)).toBeVisible()
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

    // Scenario 24 Part 1: billingAddress/shippingAddress collapsed into one
    // `address` column. Found live (2026-08-09): Customer360's Contact
    // section never rendered it at all (even under the old field names) —
    // fixed alongside the collapse, so check it shows on the profile, not
    // just in the raw API response.
    const customerId = page.url().match(/\/crm\/customers\/([a-f0-9-]+)$/)?.[1]
    if (customerId) createdIds.push(customerId)
    const detailRes = await page.request.get(`/api/crm/customers/${customerId}`)
    const detail = await detailRes.json()
    expect(detail.address).toContain(streetAddress)
    expect(detail.address).toContain(PH_CHAIN.barangay)
    expect(detail.barangayCode).toBe(PH_CHAIN.barangayCode)
    await expect(page.getByText(streetAddress, { exact: false })).toBeVisible()

    // Co-maker shows in the profile's read-only display.
    await expect(page.getByText('Co-maker (Guarantor)')).toBeVisible()
    await expect(page.getByText(`${coMakerName} — Spouse`)).toBeVisible()

    // Confirm it's findable by search from the customers list (also exercises
    // the search-by-name path the POS checkout customer picker relies on).
    await gotoReady(page, '/crm/customers')
    await fillStable(page.getByPlaceholder(/search code, name, email/i), lastName)
    await expect(page.getByText(fullName)).toBeVisible({ timeout: 10_000 })
  })
})
