import path from 'path'
import { test, expect } from '@playwright/test'
import { deleteCustomers, fillAllStable, fillPhoneStable, gotoReady, sweepE2ECustomers } from './utils'

const NAME_PREFIX = 'E2E IdConsent'

// CRM — Customer ID & Consent (scenario-02, 2026-07-31 update): capture a
// scanned ID + type/number + consent on the profile, reusing the same
// central Files store as UDS's RFS form upload.
test.describe('CRM — Customer ID & Consent', () => {
  let createdIds: string[] = []

  test.beforeAll(async ({ request }) => {
    await sweepE2ECustomers(request, NAME_PREFIX)
  })

  test.afterEach(async ({ request }) => {
    await deleteCustomers(request, createdIds)
    createdIds = []
  })

  test('uploads an ID document, fills type/number, gives consent, and shows it on the profile', async ({
    page,
  }) => {
    const uniqueSuffix = Date.now()
    const lastName = `IdConsent${uniqueSuffix}`
    const fullName = `E2E ${lastName}`

    await gotoReady(page, '/crm/customers/new')

    // File upload and the checkbox go first — both are their own async/state
    // interactions that can trigger a hydration reconciliation. Text fields
    // are filled+re-verified together as the LAST step before submit (see
    // fillAllStable's own doc comment on the hydration-wipe race), so
    // anything the earlier steps disturb gets caught by this final pass
    // rather than by an earlier check that's no longer true by submit time.
    const idFileInput = page
      .getByText('ID Document', { exact: true })
      .locator('..')
      .locator('input[type="file"]')
    const idFileFixture = path.join(__dirname, 'fixtures', 'rfs-form-sample.txt')
    // Upload goes through a server action (a POST back to this same page
    // URL), not a plain XHR/fetch the browser makes directly — polling the
    // resulting text with a short per-attempt timeout (as elsewhere in this
    // file's `.toPass()` retries) can time out before that round trip
    // finishes and re-fire setInputFiles while the first upload is still in
    // flight, double-submitting and aborting one of the two requests. Wait
    // on the actual network response instead so there's only ever one
    // upload in flight per attempt. Still wrapped in its own retry, though —
    // if the input's change handler isn't attached yet (dev-mode hydration
    // race), setInputFiles fires into the void and no POST ever happens;
    // retrying re-fires the event once hydration has caught up, and each
    // attempt's own waitForResponse means a retry never collides with an
    // in-flight request from a previous attempt.
    await expect(async () => {
      const uploadResponse = page.waitForResponse(
        (res) => res.request().method() === 'POST' && res.url() === page.url(),
        { timeout: 8_000 }
      )
      await idFileInput.setInputFiles(idFileFixture)
      expect((await uploadResponse).ok()).toBeTruthy()
    }).toPass({ timeout: 20_000 })
    await expect(page.getByText('rfs-form-sample.txt')).toBeVisible({ timeout: 10_000 })

    await page
      .getByLabel('Customer has given consent to store their ID information on file.')
      .check()

    // ID Type is a <select> — fillAllStable's .fill() doesn't apply to
    // selects, so it gets its own stable-retry pick, still positioned late
    // (right before the final text-field pass) for the same anti-race reason.
    const idTypeSelect = page.getByText('ID Type', { exact: true }).locator('..').locator('select')
    await expect(async () => {
      await idTypeSelect.selectOption("Driver's License")
      await expect(idTypeSelect).toHaveValue("Driver's License")
    }).toPass({ timeout: 10_000 })

    // ID Number has no placeholder — scope by the nearby label text instead,
    // same pattern already used for the RFS file input in
    // repair-transfer-uds.spec.ts.
    const idNumberInput = page
      .getByText('ID Number', { exact: true })
      .locator('..')
      .locator('input')

    await fillAllStable([
      { locator: page.getByLabel('First name *'), value: 'E2E' },
      { locator: page.getByLabel('Last name *'), value: lastName },
      { locator: idNumberInput, value: 'N01-23-456789' },
    ])
    await fillPhoneStable(
      page.locator('.phone-input-field'),
      `9${uniqueSuffix.toString().slice(-9)}`
    )

    await expect(async () => {
      await page.getByRole('button', { name: 'Create customer' }).click()
      await expect(page).toHaveURL(/\/crm\/customers\/[a-f0-9-]+$/, { timeout: 8_000 })
    }).toPass({ timeout: 20_000 })

    await expect(page.getByRole('heading', { name: fullName })).toBeVisible()
    await expect(page.getByText('ID & Consent')).toBeVisible()
    await expect(page.getByText("Driver's License")).toBeVisible()
    await expect(page.getByText('N01-23-456789')).toBeVisible()
    await expect(page.getByText('rfs-form-sample.txt')).toBeVisible()
    await expect(page.getByText(/Consent given/)).toBeVisible()

    const customerId = page.url().match(/\/crm\/customers\/([a-f0-9-]+)$/)?.[1]
    if (customerId) createdIds.push(customerId)
  })
})
