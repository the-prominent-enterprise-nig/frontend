import { test, expect, type Page } from '@playwright/test'
import { gotoReady, loginAs, clickStable, fillStable } from './utils'

// Scenario 17, Part 5 — BM/Credit Approver review UI (the existing Branch
// Manager role, not a new one). Backend workflow itself is covered by
// backend/test/credit-approval.e2e-spec.ts; this spec exercises the actual
// UI across three personas (Cashier submits, Credit Investigator
// investigates, Branch Manager approves/declines), mirroring
// credit-investigation.spec.ts's same multi-role switchTo pattern.
//
// Scenario 29 POS-02 — approve/decline is now per-item, not a single
// whole-application action: the detail page shows an Approve/Decline
// toggle per item and one "Submit Decision" button, rather than two
// top-level Approve/Decline buttons.
//
// No afterAll cleanup — same permanent-workflow-record tradeoff as the other
// credit e2e specs (CreditApplication rows are never hard-deleted).

const DEV_PASSWORD = 'dev-prominent-enterprise-2026'
const OWNER_EMAIL = 'technova.owner@test.com'
const CASHIER_EMAIL = 'technova.b1.cashier@test.com'
const MANAGER_EMAIL = 'technova.b1.manager@test.com'

async function switchTo(page: Page, email: string): Promise<void> {
  await page.context().clearCookies()
  await loginAs(page, email, DEV_PASSWORD)
}

/** Creates the customer under Business Owner (Cashier lacks
 * crm:customers:create — a pre-existing, unrelated permission gap), then
 * switches to Cashier to create, attach a document to, and submit an
 * application covering the given number of items. Returns the application
 * id plus its CreditApplicationItem ids, in creation order. */
async function createSubmittedApplication(
  page: Page,
  label: string,
  itemCount: 1 | 2 = 1
): Promise<{ applicationId: string; creditApplicationItemIds: string[] }> {
  await loginAs(page, OWNER_EMAIL, DEV_PASSWORD)
  const applicantName = `E2E Approval ${label} ${Date.now()}`
  const customerRes = await page.request.post('/api/crm/customers', {
    data: {
      name: applicantName,
      customerType: 'individual',
      phone: `0917${Date.now().toString().slice(-7)}`,
      coMakers: [
        { name: 'E2E Approval Co-Maker', relationship: 'Spouse', contactNumber: '09171118888' },
      ],
    },
  })
  const customer = await customerRes.json()

  await switchTo(page, CASHIER_EMAIL)

  const branchesRes = await page.request.get('/api/branches?limit=200')
  const branches = ((await branchesRes.json()).data ?? []) as { id: string; name: string }[]
  const branchId = branches.find((b) => b.name === 'Bago')!.id

  // Two distinct, known-priced retail items (an unfiltered/limit-only fetch
  // can return an unpriced item like "Switches", which 400s — financing
  // requires a selling price) — same two names other installment specs in
  // this suite already rely on being priced and seeded.
  const searchTerms = ['Universal Remote Control', 'LED Bulb'].slice(0, itemCount)
  const items: { id: string }[] = []
  for (const term of searchTerms) {
    const itemsRes = await page.request.get('/api/inventory/items', {
      params: { search: term, limit: '1' },
    })
    items.push(...(((await itemsRes.json()).data ?? []) as { id: string }[]))
  }

  const applicationRes = await page.request.post('/api/credit/applications', {
    data: {
      branchId,
      applicantCustomerId: customer.id,
      coMakerId: customer.coMakers[0].id,
      items: items.map((i) => ({ itemId: i.id })),
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

  return {
    applicationId: application.id as string,
    creditApplicationItemIds: (application.items as { id: string }[]).map((i) => i.id),
  }
}

/**
 * Under the Branch Manager's session: start and record the investigation.
 * Branch Manager has pos:investigation:start/record too (folded into the
 * pos module, Scenario 22, 2026-08-08 — Part 4's role hierarchy cascade
 * already covered it via their full pos:* wildcard), so this doesn't need
 * a separate Credit Investigator switch.
 */
async function investigateAsManager(page: Page, applicationId: string): Promise<void> {
  await page.request.post(`/api/credit/applications/${applicationId}/investigation/start`)
  await page.request.post(`/api/credit/applications/${applicationId}/investigation`, {
    data: { affordabilityOutcome: 'recommend_approve', notes: 'Looks fine' },
  })
}

test.describe('Credit Applications — BM/Credit Approver review', () => {
  test.use({ storageState: { cookies: [], origins: [] } })

  test('a Branch Manager approves every item on a pending application', async ({ page }) => {
    const { applicationId } = await createSubmittedApplication(page, 'Approve')

    await switchTo(page, MANAGER_EMAIL)
    await investigateAsManager(page, applicationId)
    await gotoReady(page, `/pos/credit-applications/${applicationId}`)
    await expect(page.getByText('Pending Approval', { exact: true }).first()).toBeVisible({
      timeout: 10_000,
    })

    // Every item defaults to Approve — just submit.
    await clickStable(
      page.getByRole('button', { name: 'Submit Decision' }),
      page.getByText('Approved', { exact: true }).first()
    )
  })

  test('a Branch Manager declines every item on a pending application with a reason', async ({
    page,
  }) => {
    const { applicationId } = await createSubmittedApplication(page, 'Decline')

    await switchTo(page, MANAGER_EMAIL)
    await investigateAsManager(page, applicationId)
    await gotoReady(page, `/pos/credit-applications/${applicationId}`)
    await expect(page.getByText('Pending Approval', { exact: true }).first()).toBeVisible({
      timeout: 10_000,
    })

    await page.getByRole('button', { name: 'Decline', exact: true }).first().click()

    await clickStable(
      page.getByRole('button', { name: 'Submit Decision' }),
      page.getByRole('heading', { name: 'Reason for Declined Item(s)' })
    )
    await fillStable(
      page.getByPlaceholder('Reason for declining these items'),
      'Co-maker unreachable for verification'
    )
    await page.getByRole('button', { name: 'Confirm Decision' }).click()

    await expect(page.getByText('Declined', { exact: true }).first()).toBeVisible({
      timeout: 10_000,
    })
    await expect(page.getByText('Co-maker unreachable for verification')).toBeVisible()
  })

  test('a Branch Manager approves one item and declines another -> partially approved', async ({
    page,
  }) => {
    const { applicationId } = await createSubmittedApplication(page, 'Partial', 2)

    await switchTo(page, MANAGER_EMAIL)
    await investigateAsManager(page, applicationId)
    await gotoReady(page, `/pos/credit-applications/${applicationId}`)
    await expect(page.getByText('Pending Approval', { exact: true }).first()).toBeVisible({
      timeout: 10_000,
    })

    // Decline just the second item's toggle; leave the first on its Approve default.
    await page.getByRole('button', { name: 'Decline', exact: true }).nth(1).click()

    await clickStable(
      page.getByRole('button', { name: 'Submit Decision' }),
      page.getByRole('heading', { name: 'Reason for Declined Item(s)' })
    )
    await fillStable(
      page.getByPlaceholder('Reason for declining these items'),
      'One model exceeds the affordability threshold'
    )
    await page.getByRole('button', { name: 'Confirm Decision' }).click()

    await expect(page.getByText('Partially Approved', { exact: true }).first()).toBeVisible({
      timeout: 10_000,
    })
    await expect(page.getByText('Approved', { exact: true })).toBeVisible()
    await expect(page.getByText('Declined', { exact: true }).first()).toBeVisible()
  })
})
