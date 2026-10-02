import { test, expect, type Locator, type Page } from '@playwright/test'
import { gotoReady, loginAs, clickStable, fillPhoneStable, openCustomSelect } from './utils'

// Scenario 17, Part 3 — Cashier intake UI for a formal NIG in-house
// financing application. Backend CRUD/documents/submit workflow itself is
// covered by backend/test/credit-application*.e2e-spec.ts; this spec
// exercises the actual UI: applicant and co-maker selection, the required
// purchase/paper-record block, document upload, and submitting it on.
//
// Rewritten for the Simplified Credit Application v2 (Scenario 64 item 27):
// the co-maker is the first Related People row (picked from the customer's
// co-makers on file), Price Use / term / LCP / PPD / paper record are
// required, and saving lands on the application's own page. The document gate
// on "Submit for Investigation" is gone (Scenario 64 item 20 — an application
// can go forward without an ID and is flagged instead), so the old "disabled
// until a document is attached" assertion now asserts the opposite.
//
// The applicant customer + co-maker are created directly via the API so the
// spec can focus on the credit-application UI itself.
//
// No afterAll cleanup: CreditApplication rows are never hard-deleted by this
// app (terminal statuses only — see credit-application.service.ts), so the
// fixture customer/co-maker can never be deleted either once an application
// references them (onDelete: Restrict).

const DEV_PASSWORD = 'dev-prominent-enterprise-2026'
const CASHIER_EMAIL = 'technova.b1.cashier@test.com'
// On the WIP price list with no down payment of its own, so the form's
// 10% minimum applies and is pre-filled.
const ITEM_QUERY = 'STF3238'

const fieldBox = (scope: Page | Locator, label: RegExp) =>
  scope.locator('label', { hasText: label }).locator('..')

async function pick(page: Page, trigger: Locator, option: string | RegExp) {
  await openCustomSelect(trigger)
  await page
    .getByRole(
      'option',
      typeof option === 'string' ? { name: option, exact: true } : { name: option }
    )
    .first()
    .click()
}

test.describe('Credit Applications — Cashier intake', () => {
  test.use({ storageState: { cookies: [], origins: [] } })
  test.describe.configure({ timeout: 150_000 })

  test('raises an application, attaches a document, and submits it for investigation', async ({
    page,
  }) => {
    await loginAs(page, CASHIER_EMAIL, DEV_PASSWORD)

    const applicantName = `E2E Credit Applicant ${Date.now()}`
    // POS, not CRM: a cashier does not hold crm:customers:create. POST
    // /pos/customers is gated on pos:customers:create, takes the same
    // CreateCustomerDto and delegates to the same CustomerService.create().
    const createCustomerRes = await page.request.post('/api/pos/customers', {
      data: {
        name: applicantName,
        customerType: 'individual',
        phone: '+639170001234',
        coMakers: [
          { name: 'E2E Intake Co-Maker', relationship: 'Sibling', contactNumber: '+639171112222' },
        ],
      },
    })
    expect(createCustomerRes.ok()).toBeTruthy()

    await gotoReady(page, '/pos/credit-applications')
    await clickStable(
      page.getByRole('link', { name: 'New Application' }),
      page.getByRole('heading', { name: 'New Credit Application' })
    )

    // The applicant picker renders closed as a button and swaps to an input
    // on click; the search is debounced, so type-and-expect retries together.
    const applicantBox = page.getByPlaceholder('Search customer by name or phone…')
    await clickStable(
      page.getByRole('button', { name: 'Search customer by name or phone…' }),
      applicantBox
    )
    const applicantResult = page.getByRole('button', { name: new RegExp(applicantName) })
    await expect(async () => {
      await applicantBox.fill(applicantName)
      await expect(applicantResult).toBeVisible({ timeout: 3_000 })
    }).toPass({ timeout: 20_000 })
    await applicantResult.click()

    // The co-maker on file fills the first Related People row.
    const coMakerRow = page.locator('div.rounded-lg', { has: page.getByText(/^Role/) }).first()
    await pick(page, coMakerRow.getByRole('combobox', { name: /on file/ }), /E2E Intake Co-Maker/)
    await expect(fieldBox(coMakerRow, /^First name/).locator('input')).toHaveValue(/E2E/)

    // Item, Price Use (WIP is pre-selected) and term.
    const itemRow = page
      .getByText('Item / Model', { exact: false })
      .first()
      .locator('xpath=ancestor::div[contains(@class,"rounded-lg")][1]')
    await itemRow.getByRole('button').first().click()
    const itemResult = page.getByRole('button', { name: new RegExp(ITEM_QUERY) }).first()
    await expect(async () => {
      await itemRow.locator('input').first().fill(ITEM_QUERY)
      await expect(itemResult).toBeVisible({ timeout: 3_000 })
    }).toPass({ timeout: 20_000 })
    await itemResult.click()
    await pick(page, fieldBox(page, /^Financing Term/).getByRole('combobox'), '3 months')
    await expect(fieldBox(page, /^Down Payment\s*\*?$/).locator('input')).not.toHaveValue('', {
      timeout: 15_000,
    })

    // A character reference.
    const reference = page
      .locator('div.rounded-lg', { has: page.getByText('Mobile number', { exact: true }) })
      .first()
    await fieldBox(reference, /^Name$/)
      .locator('input')
      .fill('Ana Reyes')
    await fillPhoneStable(reference.locator('.phone-input-field'), '9171234561')
    await pick(page, fieldBox(reference, /^Relationship$/).getByRole('combobox'), 'Neighbor')

    // The paper record. LCP and first due date fill themselves; this item has
    // no rate card, so its PPD rebate is entered as 0 — what the form asks for.
    await expect(fieldBox(page, /^LCP/).locator('input')).not.toHaveValue('', { timeout: 15_000 })
    await fieldBox(page, /^PPD rebate/)
      .locator('input')
      .fill('0')
    await pick(page, fieldBox(page, /^Down payment collection/).getByRole('combobox'), 'Branch')
    await fieldBox(page, /^POS draft/)
      .locator('input')
      .fill(`QT-E2E-${Date.now()}`)
    await pick(page, fieldBox(page, /^Applicant is unit user/).getByRole('combobox'), 'Yes')
    await page.getByRole('checkbox', { name: /Paper form fully complete and signed/ }).check()

    await expect(async () => {
      await page.getByRole('button', { name: 'Submit Application' }).click()
      await expect(page).toHaveURL(/\/pos\/credit-applications\/[a-f0-9-]{36}$/, { timeout: 8_000 })
    }).toPass({ timeout: 40_000 })
    await expect(page.getByText('Draft', { exact: true }).first()).toBeVisible({ timeout: 15_000 })

    // No document gate any more: it can go forward without one.
    const submitButton = page.getByRole('button', { name: 'Submit for Investigation' })
    await expect(submitButton).toBeEnabled({ timeout: 10_000 })

    // Attaching one still works.
    await page.locator('input[type="file"]').setInputFiles({
      name: 'applicant-id.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('fake applicant id scan'),
    })
    await page.getByRole('button', { name: 'Attach' }).click()
    await expect(page.getByText('applicant-id.txt')).toBeVisible({ timeout: 10_000 })

    await submitButton.click()
    await expect(page.getByText('Submitted', { exact: true }).first()).toBeVisible({
      timeout: 15_000,
    })
  })
})
