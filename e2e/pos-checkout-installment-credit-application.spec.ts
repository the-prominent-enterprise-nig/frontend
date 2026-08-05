import { test, expect } from '@playwright/test'
import { gotoReady, clickStable, fillStable } from './utils'

// Scenario 17, Part 6 — POS installment checkout now requires the customer's
// approved, unused CreditApplication. This spec sticks to UI-surface checks
// (the picker shows up, reflects "no approved application" vs. an actual
// approved one) — the enforcement itself (reject with no/wrong/consumed
// application) is covered by the backend e2e suite
// (test/pos-installment-financing.e2e-spec.ts, IF-07..IF-10), matching this
// codebase's existing split (see pos-checkout-reserve-mode.spec.ts).
//
// No afterAll cleanup — same permanent-workflow-record tradeoff as the other
// credit e2e specs (CreditApplication rows are never hard-deleted).

test.describe('POS Checkout — Installment requires an approved Credit Application', () => {
  test('a customer with no approved application shows the warning and an empty picker', async ({
    page,
  }) => {
    const applicantName = `E2E Checkout No-App ${Date.now()}`
    await page.request.post('/api/crm/customers', {
      data: { name: applicantName, customerType: 'individual', phone: '09170007777' },
    })

    await gotoReady(page, '/pos/checkout')
    await clickStable(
      page.getByRole('button', { name: /^Installment/ }),
      page.getByText('Financing Term', { exact: true })
    )

    const customerInput = page.getByPlaceholder('Search by name or phone…')
    await customerInput.click()
    await fillStable(customerInput, applicantName)
    await page.getByRole('button', { name: new RegExp(applicantName) }).click()

    await expect(page.getByText('Approved Credit Application', { exact: true })).toBeVisible({
      timeout: 10_000,
    })
    await expect(
      page.getByText(
        'Every installment sale requires an approved credit application — open one in Credit Applications first.'
      )
    ).toBeVisible()
  })

  test('a customer with an approved application shows it in the picker', async ({ page }) => {
    const applicantName = `E2E Checkout With-App ${Date.now()}`
    const customerRes = await page.request.post('/api/crm/customers', {
      data: {
        name: applicantName,
        customerType: 'individual',
        phone: '09170006666',
        coMakers: [
          { name: 'E2E Checkout Co-Maker', relationship: 'Sibling', contactNumber: '09171116666' },
        ],
      },
    })
    const customer = await customerRes.json()

    const branchesRes = await page.request.get('/api/branches?limit=200')
    const branches = ((await branchesRes.json()).data ?? []) as { id: string; name: string }[]
    const branchId = branches.find((b) => b.name === 'Manila HQ')!.id

    const appRes = await page.request.post('/api/credit/applications', {
      data: {
        branchId,
        applicantCustomerId: customer.id,
        coMakerId: customer.coMakers[0].id,
        requestedAmount: 40000,
      },
    })
    const application = await appRes.json()

    const uploadRes = await page.request.post('/api/files/upload', {
      multipart: {
        file: { name: 'id.txt', mimeType: 'text/plain', buffer: Buffer.from('fake id') },
      },
    })
    const file = await uploadRes.json()
    await page.request.post(`/api/credit/applications/${application.id}/documents`, {
      data: { fileId: file.id, documentType: 'applicant_id' },
    })
    await page.request.patch(`/api/credit/applications/${application.id}/submit`)
    await page.request.post(`/api/credit/applications/${application.id}/investigation/start`)
    await page.request.post(`/api/credit/applications/${application.id}/investigation`, {
      data: { affordabilityOutcome: 'recommend_approve', notes: 'Looks fine' },
    })
    await page.request.patch(`/api/credit/applications/${application.id}/approve`)

    await gotoReady(page, '/pos/checkout')
    await clickStable(
      page.getByRole('button', { name: /^Installment/ }),
      page.getByText('Financing Term', { exact: true })
    )

    const customerInput = page.getByPlaceholder('Search by name or phone…')
    await customerInput.click()
    await fillStable(customerInput, applicantName)
    await page.getByRole('button', { name: new RegExp(applicantName) }).click()

    const picker = page.locator('select').filter({ hasText: application.applicationNumber })
    await expect(picker).toBeVisible({ timeout: 10_000 })
    await expect(
      page.getByText(
        'Every installment sale requires an approved credit application — open one in Credit Applications first.'
      )
    ).toHaveCount(0)
  })
})
