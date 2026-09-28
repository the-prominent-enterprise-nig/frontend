import { test, expect } from '@playwright/test'
import { gotoReady, loginAs, fillStable, clickStable, openCustomSelect } from './utils'

// Scenario 17, Part 3 — Cashier intake UI for a formal NIG in-house
// financing application. Backend CRUD/documents/submit workflow itself is
// covered by backend/test/credit-application*.e2e-spec.ts; this spec
// exercises the actual UI: applicant/co-maker selection, document upload,
// and the submit gate.
//
// The applicant customer + co-maker are created directly via the API (no
// seeded customer has a co-maker on file) so this spec can focus on the
// credit-application UI itself, mirroring
// inventory-stock-adjustment-approval-chain.spec.ts's same "create fixture
// via API, exercise UI" split.
//
// No afterAll cleanup: CreditApplication rows are never hard-deleted by this
// app (same "terminal status instead of deletion" convention as
// StockAdjustment/PosReleaseFormRequest — see credit-application.service.ts),
// so the fixture customer/co-maker this test creates can never be deleted
// either once a CreditApplication references them (onDelete: Restrict).
// inventory-stock-adjustment-approval-chain.spec.ts accepts the same
// permanent-fixture tradeoff for the same structural reason.

const DEV_PASSWORD = 'dev-prominent-enterprise-2026'
const CASHIER_EMAIL = 'technova.b1.cashier@test.com'

test.describe('Credit Applications — Cashier intake', () => {
  test.use({ storageState: { cookies: [], origins: [] } })

  test('opens a draft application, attaches a document, and submits it', async ({ page }) => {
    await loginAs(page, CASHIER_EMAIL, DEV_PASSWORD)

    const applicantName = `E2E Credit Applicant ${Date.now()}`
    // POS, not CRM. This spec deliberately throws away the shared Business
    // Owner storage state above to run as a cashier, and a cashier does not
    // hold crm:customers:create — so setting the fixture up through the CRM
    // route 403'd and killed the test before it reached what it tests.
    // POST /pos/customers is gated on pos:customers:create (held via the POS
    // module wildcard), takes the same CreateCustomerDto, and delegates to
    // the same CustomerService.create() — so this is also how a real cashier
    // would create this applicant.
    const createCustomerRes = await page.request.post('/api/pos/customers', {
      data: {
        name: applicantName,
        customerType: 'individual',
        phone: '09170001234',
        coMakers: [
          { name: 'E2E Intake Co-Maker', relationship: 'Sibling', contactNumber: '09171112222' },
        ],
      },
    })
    expect(createCustomerRes.ok()).toBeTruthy()

    await gotoReady(page, '/pos/credit-applications')
    await clickStable(
      page.getByRole('link', { name: 'New Application' }),
      page.getByRole('heading', { name: 'New Credit Application' })
    )

    // SearchCombobox renders closed as a button carrying the placeholder as
    // its text, swapping to a real input only once clicked — see the "Closed
    // state is a button, not the search <input>, on purpose" note in that
    // component. Matching the result by name also drops the old
    // `div.fixed.z-100` container selector, which was tied to its styling.
    // Wrapped in toPass because the search is debounced: a retried fill
    // restarts the debounce, so typing once and then waiting for the result
    // races it. Same shape as pickAddressLevel in crm-add-customer.spec.ts —
    // retype, then expect the result, and let the whole pair retry.
    await page.getByRole('button', { name: 'Search customer by name or phone…' }).click()
    const applicantInput = page.getByPlaceholder('Search customer by name or phone…')
    const applicantResult = page.getByRole('button', { name: new RegExp(applicantName) })
    await expect(async () => {
      await applicantInput.fill(applicantName)
      await expect(applicantResult).toBeVisible({ timeout: 3_000 })
    }).toPass({ timeout: 20_000 })
    await applicantResult.click()

    // The co-maker picker is the shared Select, not a native <select>: it is
    // a role=combobox named by what it currently shows, with its options in a
    // popup rather than as <option> children.
    await openCustomSelect(page.getByRole('combobox', { name: /No co-maker/ }))
    await page.getByRole('option', { name: 'E2E Intake Co-Maker (Sibling)' }).click()

    await fillStable(page.locator('input[type="number"]'), '25000')

    await expect(async () => {
      await page.getByRole('button', { name: 'Submit Application' }).click()
      await expect(page.getByRole('heading', { name: 'New Credit Application' })).toHaveCount(0, {
        timeout: 3_000,
      })
    }).toPass({ timeout: 15_000 })

    const row = page.locator('tr', { hasText: applicantName })
    await expect(row).toBeVisible({ timeout: 10_000 })
    await expect(row.getByText('Draft')).toBeVisible()

    await clickStable(
      row.getByRole('link', { name: 'Open' }),
      page.getByText('No documents attached yet.')
    )

    const submitButton = page.getByRole('button', { name: 'Submit for Investigation' })
    await expect(submitButton).toBeDisabled()

    const fileInput = page.locator('input[type="file"]')
    await fileInput.setInputFiles({
      name: 'applicant-id.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('fake applicant id scan'),
    })
    await page.getByRole('button', { name: 'Attach' }).click()
    await expect(page.getByText('applicant-id.txt')).toBeVisible({ timeout: 10_000 })

    await expect(submitButton).toBeEnabled({ timeout: 10_000 })
    await submitButton.click()
    await expect(page.getByText('Submitted', { exact: true }).first()).toBeVisible({
      timeout: 10_000,
    })
  })
})
