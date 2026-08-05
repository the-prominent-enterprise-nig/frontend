import { test, expect, type Page } from '@playwright/test'
import { gotoReady, loginAs, clickStable, fillStable } from './utils'

// Scenario 17, Part 7 — Promissory Note generation + signature gate.
// Backend generation/gate enforcement is covered by
// backend/test/pos-installment-financing.e2e-spec.ts (PN-01..PN-04); this
// spec sticks to the UI surface a backend suite can't see: the Pending
// Approval screen's Promissory Note card (unsigned -> print -> Mark as
// Signed -> signed) after a Cashier submits an installment sale. Mirrors
// credit-approval.spec.ts's multi-role switchTo pattern and
// pos-checkout-price-use.spec.ts's item/Price-Use selection.
//
// No afterAll cleanup — same permanent-workflow-record tradeoff as the other
// credit/RFD e2e specs (CreditApplication/PosReleaseFormRequest rows are
// never hard-deleted).

const DEV_PASSWORD = 'dev-prominent-enterprise-2026'
const CASHIER_EMAIL = 'technova.b1.cashier@test.com'
const MANAGER_EMAIL = 'technova.b1.manager@test.com'

async function switchTo(page: Page, email: string): Promise<void> {
  await page.context().clearCookies()
  await loginAs(page, email, DEV_PASSWORD)
}

/** Drives the full application lifecycle as Branch Manager alone (Parts
 * 1/4/5 cascade grants BM create + investigate + approve). */
async function createApprovedApplication(page: Page): Promise<{
  applicationId: string
  applicationNumber: string
  branchId: string
  applicantName: string
}> {
  const applicantName = `E2E PN ${Date.now()}`
  const customerRes = await page.request.post('/api/crm/customers', {
    data: {
      name: applicantName,
      customerType: 'individual',
      phone: '09170009999',
      coMakers: [{ name: 'E2E PN Co-Maker', relationship: 'Spouse', contactNumber: '09171119999' }],
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
    multipart: { file: { name: 'id.txt', mimeType: 'text/plain', buffer: Buffer.from('fake id') } },
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

  return {
    applicationId: application.id as string,
    applicationNumber: application.applicationNumber as string,
    branchId,
    applicantName,
  }
}

/** Opens a fresh POS session for the given branch as whoever `page` is
 * currently authenticated as (the real cashier, not a shared-terminal PIN
 * persona — same simplification pos-installment-financing.e2e-spec.ts's
 * backend fixture uses). Closes any already-open session on that terminal
 * first so re-runs don't collide. */
async function ensureOpenSession(page: Page, branchId: string): Promise<void> {
  const terminalsRes = await page.request.get('/api/pos/terminals', { params: { branchId } })
  const terminals = (await terminalsRes.json()) as { id: string; status: string }[]
  const terminal = terminals.find((t) => t.status === 'active') ?? terminals[0]

  const sessionsRes = await page.request.get('/api/pos/sessions', {
    params: { terminalId: terminal.id, status: 'open' },
  })
  const openSessions = (await sessionsRes.json()) as { id: string }[]
  for (const s of openSessions) {
    await page.request.post(`/api/pos/sessions/${s.id}/close`, { data: { declaredClosingCash: 0 } })
  }

  await page.request.post('/api/pos/sessions/open', {
    data: { terminalId: terminal.id, openingCash: 1000 },
  })
}

test.describe('POS Checkout — Promissory Note', () => {
  test.use({ storageState: { cookies: [], origins: [] } })

  test('Cashier submits an installment sale, prints the Promissory Note, and marks it signed', async ({
    page,
  }) => {
    await loginAs(page, MANAGER_EMAIL, DEV_PASSWORD)
    const { applicationNumber, branchId, applicantName } = await createApprovedApplication(page)

    await switchTo(page, CASHIER_EMAIL)
    await ensureOpenSession(page, branchId)

    await gotoReady(page, '/pos/checkout')
    await clickStable(
      page.getByRole('button', { name: /^Installment/ }),
      page.getByText('Financing Term', { exact: true })
    )

    // Add a WIP-priced item to cart (see pos-checkout-price-use.spec.ts —
    // seeded with a real price-list entry) and resolve its price.
    const searchInput = page.getByPlaceholder('Search by name or serial')
    await expect(searchInput).toBeVisible({ timeout: 15_000 })
    await searchInput.fill('Universal Remote Control')
    const remoteCard = page
      .getByRole('button')
      .filter({ has: page.getByText('Universal Remote Control', { exact: true }) })
    await expect(remoteCard.first()).toBeVisible({ timeout: 10_000 })
    await remoteCard.first().click()
    await page.getByLabel('Price Use').selectOption({ label: 'WIP' })

    // Select the applicant.
    const customerInput = page.getByPlaceholder('Search by name or phone…')
    await customerInput.click()
    await fillStable(customerInput, applicantName)
    await page.getByRole('button', { name: new RegExp(applicantName) }).click()

    // Select the approved application and a financing term.
    const applicationSelect = page.locator('select').filter({ hasText: applicationNumber })
    await expect(applicationSelect).toBeVisible({ timeout: 10_000 })
    const applicationOptionValue = await applicationSelect
      .locator('option', { hasText: applicationNumber })
      .getAttribute('value')
    await applicationSelect.selectOption(applicationOptionValue!)
    const termSelect = page.locator('select').filter({ hasText: 'Tenant-wide' })
    await expect(termSelect).toBeVisible({ timeout: 10_000 })
    await termSelect.selectOption({ index: 1 })

    await clickStable(
      page.getByRole('button', { name: /Create Installment Plan/ }),
      page.getByText('Pending Approval', { exact: true })
    )

    // Promissory Note card — unsigned state.
    await expect(page.getByText('Promissory Note', { exact: true })).toBeVisible()
    await expect(
      page.getByText(
        'Print for the applicant and co-maker to sign, then mark it signed below — release is blocked until then.'
      )
    ).toBeVisible()
    const signButton = page.getByRole('button', { name: 'Mark as Signed' })
    await expect(signButton).toBeVisible()

    // Print opens a new tab with the printable document.
    const [popup] = await Promise.all([
      page.waitForEvent('popup'),
      page.getByRole('button', { name: 'Print' }).click(),
    ])
    await expect(popup.getByText('PROMISSORY NOTE', { exact: true })).toBeVisible({
      timeout: 10_000,
    })
    await popup.close()

    // Sign it — the card flips to signed and the button disappears.
    await signButton.click()
    await expect(page.getByText('Signed', { exact: false }).first()).toBeVisible({
      timeout: 10_000,
    })
    await expect(page.getByRole('button', { name: 'Mark as Signed' })).toHaveCount(0)
  })
})
