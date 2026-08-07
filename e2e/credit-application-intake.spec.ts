import { test, expect } from '@playwright/test'
import { gotoReady, loginAs, fillStable, clickStable } from './utils'

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
    const createCustomerRes = await page.request.post('/api/crm/customers', {
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
      page.getByRole('button', { name: 'New Application' }),
      page.getByRole('heading', { name: 'New Credit Application' })
    )

    const applicantInput = page.getByPlaceholder('Search customer by name or phone…')
    await applicantInput.click()
    await applicantInput.fill(applicantName)
    const applicantDropdown = page.locator('div.fixed.z-100')
    await expect(applicantDropdown).toBeVisible({ timeout: 10_000 })
    await applicantDropdown.locator('button').first().click()

    const coMakerSelect = page.locator('select').filter({ hasText: 'E2E Intake Co-Maker' })
    await expect(coMakerSelect).toBeVisible({ timeout: 10_000 })
    await coMakerSelect.selectOption({ label: 'E2E Intake Co-Maker (Sibling)' })

    await fillStable(page.locator('input[type="number"]'), '25000')

    await expect(async () => {
      await page.getByRole('button', { name: 'Open Application' }).click()
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
