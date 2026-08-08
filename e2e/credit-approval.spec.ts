import { test, expect, type Page } from '@playwright/test'
import { gotoReady, loginAs, clickStable, fillStable } from './utils'

// Scenario 17, Part 5 — BM/Credit Approver review UI (the existing Branch
// Manager role, not a new one). Backend workflow itself is covered by
// backend/test/credit-approval.e2e-spec.ts; this spec exercises the actual
// UI across three personas (Cashier submits, Credit Investigator
// investigates, Branch Manager approves/declines), mirroring
// credit-investigation.spec.ts's same multi-role switchTo pattern.
//
// No afterAll cleanup — same permanent-workflow-record tradeoff as the other
// credit e2e specs (CreditApplication rows are never hard-deleted).

const DEV_PASSWORD = 'dev-prominent-enterprise-2026'
const CASHIER_EMAIL = 'technova.b1.cashier@test.com'
const MANAGER_EMAIL = 'technova.b1.manager@test.com'

async function switchTo(page: Page, email: string): Promise<void> {
  await page.context().clearCookies()
  await loginAs(page, email, DEV_PASSWORD)
}

/** Under the Cashier's session: create, attach a document, and submit an application. */
async function createSubmittedApplication(page: Page, label: string): Promise<string> {
  const applicantName = `E2E Approval ${label} ${Date.now()}`
  const customerRes = await page.request.post('/api/crm/customers', {
    data: {
      name: applicantName,
      customerType: 'individual',
      phone: '09170008888',
      coMakers: [
        { name: 'E2E Approval Co-Maker', relationship: 'Spouse', contactNumber: '09171118888' },
      ],
    },
  })
  const customer = await customerRes.json()

  const branchesRes = await page.request.get('/api/branches?limit=200')
  const branches = ((await branchesRes.json()).data ?? []) as { id: string; name: string }[]
  const branchId = branches.find((b) => b.name === 'Manila HQ')!.id

  const applicationRes = await page.request.post('/api/credit/applications', {
    data: {
      branchId,
      applicantCustomerId: customer.id,
      coMakerId: customer.coMakers[0].id,
      requestedAmount: 25000,
    },
  })
  const application = await applicationRes.json()

  const uploadRes = await page.request.post('/api/files/upload', {
    multipart: { file: { name: 'id.txt', mimeType: 'text/plain', buffer: Buffer.from('fake id') } },
  })
  const file = await uploadRes.json()

  await page.request.post(`/api/credit/applications/${application.id}/documents`, {
    data: { fileId: file.id, documentType: 'applicant_id' },
  })
  await page.request.patch(`/api/credit/applications/${application.id}/submit`)

  return application.id as string
}

/**
 * Under the Branch Manager's session: start and record the investigation.
 * Branch Manager has credit:investigation:start/record too (Part 4's role
 * hierarchy cascade), so this doesn't need a separate Credit Investigator switch.
 */
async function investigateAsManager(page: Page, applicationId: string): Promise<void> {
  await page.request.post(`/api/credit/applications/${applicationId}/investigation/start`)
  await page.request.post(`/api/credit/applications/${applicationId}/investigation`, {
    data: { affordabilityOutcome: 'recommend_approve', notes: 'Looks fine' },
  })
}

test.describe('Credit Applications — BM/Credit Approver review', () => {
  test.use({ storageState: { cookies: [], origins: [] } })

  test('a Branch Manager approves a pending application', async ({ page }) => {
    await loginAs(page, CASHIER_EMAIL, DEV_PASSWORD)
    const applicationId = await createSubmittedApplication(page, 'Approve')

    await switchTo(page, MANAGER_EMAIL)
    await investigateAsManager(page, applicationId)
    await gotoReady(page, `/pos/credit-applications/${applicationId}`)
    await expect(page.getByText('Pending Approval', { exact: true }).first()).toBeVisible({
      timeout: 10_000,
    })

    await clickStable(
      page.getByRole('button', { name: 'Approve' }),
      page.getByText('Approved', { exact: true }).first()
    )
  })

  test('a Branch Manager declines a pending application with a reason', async ({ page }) => {
    await loginAs(page, CASHIER_EMAIL, DEV_PASSWORD)
    const applicationId = await createSubmittedApplication(page, 'Decline')

    await switchTo(page, MANAGER_EMAIL)
    await investigateAsManager(page, applicationId)
    await gotoReady(page, `/pos/credit-applications/${applicationId}`)
    await expect(page.getByText('Pending Approval', { exact: true }).first()).toBeVisible({
      timeout: 10_000,
    })

    await clickStable(
      page.getByRole('button', { name: 'Decline', exact: true }),
      page.getByRole('heading', { name: 'Decline Application' })
    )
    await fillStable(
      page.getByPlaceholder('Reason for declining'),
      'Co-maker unreachable for verification'
    )
    await page.getByRole('button', { name: 'Confirm Decline' }).click()

    await expect(page.getByText('Declined', { exact: true }).first()).toBeVisible({
      timeout: 10_000,
    })
    await expect(page.getByText('Co-maker unreachable for verification')).toBeVisible()
  })
})
