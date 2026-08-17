import { test, expect, type Page } from '@playwright/test'
import { gotoReady, loginAs, clickStable, fillStable } from './utils'

// Scenario 17, Part 4 — Credit Investigator UI: claiming a submitted
// application and recording an affordability outcome. Backend workflow
// itself is covered by backend/test/credit-investigation.e2e-spec.ts; this
// spec exercises the actual UI across two personas (Cashier submits, Credit
// Investigator investigates), mirroring
// inventory-stock-adjustment-approval-chain.spec.ts's same multi-role
// switchTo pattern.
//
// The submitted application itself is created directly via the API (Part 3's
// intake UI is already covered by credit-application-intake.spec.ts) so this
// spec can focus purely on the investigation controls.
//
// No afterAll cleanup — same permanent-workflow-record tradeoff as
// credit-application-intake.spec.ts (CreditApplication/CreditInvestigation
// rows are never hard-deleted by this app).

const DEV_PASSWORD = 'dev-prominent-enterprise-2026'
const CASHIER_EMAIL = 'technova.b1.cashier@test.com'
const INVESTIGATOR_EMAIL = 'technova.b1.investigator@test.com'

async function switchTo(page: Page, email: string): Promise<void> {
  await page.context().clearCookies()
  await loginAs(page, email, DEV_PASSWORD)
}

async function createSubmittedApplication(page: Page): Promise<string> {
  const applicantName = `E2E Investigation Applicant ${Date.now()}`
  const customerRes = await page.request.post('/api/crm/customers', {
    data: {
      name: applicantName,
      customerType: 'individual',
      phone: '09170009999',
      coMakers: [
        {
          name: 'E2E Investigation Co-Maker',
          relationship: 'Spouse',
          contactNumber: '09171119999',
        },
      ],
    },
  })
  const customer = await customerRes.json()

  const branchesRes = await page.request.get('/api/branches?limit=200')
  const branches = ((await branchesRes.json()).data ?? []) as { id: string; name: string }[]
  const branchId = branches.find((b) => b.name === 'Bago')!.id

  const applicationRes = await page.request.post('/api/credit/applications', {
    data: {
      branchId,
      applicantCustomerId: customer.id,
      coMakerId: customer.coMakers[0].id,
      requestedAmount: 30000,
    },
  })
  const application = await applicationRes.json()

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

  return application.id as string
}

test.describe('Credit Applications — Investigation', () => {
  test.use({ storageState: { cookies: [], origins: [] } })

  test('a Credit Investigator claims a submitted application and records an outcome', async ({
    page,
  }) => {
    await loginAs(page, CASHIER_EMAIL, DEV_PASSWORD)
    const applicationId = await createSubmittedApplication(page)

    await switchTo(page, INVESTIGATOR_EMAIL)
    await gotoReady(page, `/pos/credit-applications/${applicationId}`)
    await expect(page.getByText('Submitted', { exact: true }).first()).toBeVisible({
      timeout: 10_000,
    })

    await clickStable(
      page.getByRole('button', { name: 'Start Investigation' }),
      page.getByText('Under Investigation', { exact: true }).first()
    )

    const outcomeSelect = page.locator('select').filter({ hasText: 'Recommend Approve' })
    await expect(outcomeSelect).toBeVisible({ timeout: 10_000 })
    await outcomeSelect.selectOption('recommend_approve')
    await fillStable(
      page.getByPlaceholder('Affordability assessment notes'),
      'Stable income, verified employer'
    )

    await page.getByRole('button', { name: 'Record Outcome' }).click()
    await expect(page.getByText('Pending Approval', { exact: true }).first()).toBeVisible({
      timeout: 10_000,
    })
    await expect(page.getByText('Recommend Approve', { exact: true }).first()).toBeVisible()
  })
})
