import { test, expect, type Page } from '@playwright/test'
import { gotoReady, clickStable, fillStable } from './utils'

// Scenario 01 Gap 4 — installment sales now require a down payment of at
// least 10% of the line's sale amount (backend enforcement + IF-01..IF-14
// coverage is in backend/test/pos-installment-financing.e2e-spec.ts). This
// spec covers the client-side mirror in checkout/page.tsx's handleConfirm
// validation, plus the inline "Min ₱X (10% of sale amount)" hint — the same
// split this codebase already uses for the credit-application requirement
// (see pos-checkout-installment-credit-application.spec.ts).

/** Closes any other open session for the branch's active terminal and opens
 * a fresh one, so checkout's "Select session…" combobox auto-selects it —
 * same pattern as pos-checkout-promissory-note.spec.ts, needed here because
 * this spec (unlike pos-checkout-installment-credit-application.spec.ts)
 * actually clicks the final submit button rather than just checking picker
 * state. */
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

/** Adds one WIP-priced item to the cart and switches its line to Installment
 * mode, matching pos-checkout-installment-credit-application.spec.ts's item
 * choice. */
async function addInstallmentLine(page: Page): Promise<void> {
  const searchInput = page.getByPlaceholder('Search by name or serial')
  await expect(searchInput).toBeVisible({ timeout: 15_000 })
  await searchInput.fill('Universal Remote Control')
  const remoteCard = page
    .getByRole('button')
    .filter({ has: page.getByText('Universal Remote Control', { exact: true }) })
  await expect(remoteCard.first()).toBeVisible({ timeout: 10_000 })
  await remoteCard.first().click()
  await page.getByLabel('Price Use').selectOption({ label: 'WIP' })

  await clickStable(
    page.getByRole('button', { name: 'Installment', exact: true }),
    page.getByPlaceholder('Down payment')
  )
}

async function createApprovedApplicationCustomer(
  page: Page,
  namePrefix: string,
  phone: string
): Promise<{ applicantName: string; applicationNumber: string; branchId: string }> {
  const applicantName = `${namePrefix} ${Date.now()}`
  const customerRes = await page.request.post('/api/crm/customers', {
    data: {
      name: applicantName,
      customerType: 'individual',
      phone,
      coMakers: [
        {
          name: `${namePrefix} Co-Maker`,
          relationship: 'Sibling',
          contactNumber: `0917${phone.slice(-6)}`,
        },
      ],
    },
  })
  const customer = await customerRes.json()

  const branchesRes = await page.request.get('/api/branches?limit=200')
  const branches = ((await branchesRes.json()).data ?? []) as { id: string; name: string }[]
  const branchId = branches.find((b) => b.name === 'Bago')!.id

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

  return { applicantName, applicationNumber: application.applicationNumber as string, branchId }
}

test.describe('POS Checkout — installment down payment floor', () => {
  test('auto-fills the down payment at the 10% floor on term selection, and blocks submit if lowered below it', async ({
    page,
  }) => {
    const { applicantName, applicationNumber, branchId } = await createApprovedApplicationCustomer(
      page,
      'E2E DP Floor',
      '09170008888'
    )
    await ensureOpenSession(page, branchId)

    await gotoReady(page, '/pos/checkout')

    // Business Owner sees every branch's open sessions and must pick one
    // explicitly (no auto-select once there's more than one) — Cashier-role
    // specs elsewhere in this suite don't need this because a branch-scoped
    // cashier only ever has their own single session to choose from.
    const sessionSelect = page.locator('select').filter({ hasText: 'Select session' })
    await expect(sessionSelect).toBeVisible({ timeout: 10_000 })
    const sessionOptionValue = await sessionSelect
      .locator('option', { hasText: 'Bago' })
      .getAttribute('value')
    await sessionSelect.selectOption(sessionOptionValue!)

    await addInstallmentLine(page)

    const customerInput = page.getByPlaceholder('Search by name or phone…')
    await customerInput.click()
    await fillStable(customerInput, applicantName)
    await page.getByRole('button', { name: new RegExp(applicantName) }).click()

    const termSelect = page.locator('select').filter({ hasText: 'Select a term' })
    await expect(termSelect).toBeVisible({ timeout: 10_000 })
    await termSelect.selectOption({ index: 1 })

    const picker = page.locator('select').filter({ hasText: applicationNumber })
    await expect(picker).toBeVisible({ timeout: 10_000 })
    const optionValue = await picker
      .locator('option', { hasText: applicationNumber })
      .getAttribute('value')
    await picker.selectOption(optionValue!)

    // The static hint shows the floor, and picking a term auto-fills the
    // down payment input at that same floor — leaving it blank/0 used to
    // render a misleading "Nothing to collect at checkout for this cart."
    // even though a 0 down payment can no longer actually be submitted.
    const minHintText = await page.getByText(/^Min ₱/).innerText()
    const minDownPayment = minHintText.match(/[\d,]+\.\d{2}/)![0].replace(/,/g, '')
    const downPaymentInput = page.getByPlaceholder('Down payment')
    await expect(downPaymentInput).toHaveValue(minDownPayment)
    await expect(page.getByText('Nothing to collect at checkout for this cart.')).toHaveCount(0)

    // A cashier can still manually lower it below the floor. The submit
    // button is disabled purely on an unmet "Underpaid" balance (a separate
    // gate from the floor check), so a matching payment has to be added
    // too, just to reach the floor validation itself.
    await fillStable(downPaymentInput, '1')
    await clickStable(
      page.getByRole('button', { name: 'Add payment method' }),
      page.getByPlaceholder('0.00')
    )
    await fillStable(page.getByPlaceholder('0.00'), '1')

    await clickStable(
      page.getByRole('button', { name: /Create Installment Plan/ }),
      page.getByText(/down payment must be at least 10% of its sale amount/i)
    )

    // Still on checkout — the sale was never submitted.
    await expect(page).toHaveURL(/\/pos\/checkout/)
  })

  test('shows the real reason inline when a down payment exceeds the sale amount, not a bare "Preview unavailable."', async ({
    page,
  }) => {
    const { applicantName, applicationNumber, branchId } = await createApprovedApplicationCustomer(
      page,
      'E2E DP Exceeds',
      '09170009999'
    )
    await ensureOpenSession(page, branchId)

    await gotoReady(page, '/pos/checkout')

    const sessionSelect = page.locator('select').filter({ hasText: 'Select session' })
    await expect(sessionSelect).toBeVisible({ timeout: 10_000 })
    const sessionOptionValue = await sessionSelect
      .locator('option', { hasText: 'Bago' })
      .getAttribute('value')
    await sessionSelect.selectOption(sessionOptionValue!)

    await addInstallmentLine(page)

    const customerInput = page.getByPlaceholder('Search by name or phone…')
    await customerInput.click()
    await fillStable(customerInput, applicantName)
    await page.getByRole('button', { name: new RegExp(applicantName) }).click()

    const termSelect = page.locator('select').filter({ hasText: 'Select a term' })
    await expect(termSelect).toBeVisible({ timeout: 10_000 })
    await termSelect.selectOption({ index: 1 })

    const picker = page.locator('select').filter({ hasText: applicationNumber })
    await expect(picker).toBeVisible({ timeout: 10_000 })
    const optionValue = await picker
      .locator('option', { hasText: applicationNumber })
      .getAttribute('value')
    await picker.selectOption(optionValue!)

    // A down payment well above the item's price used to render a bare,
    // unexplained "Preview unavailable." — the backend's own preview
    // endpoint already rejects this with a clear reason
    // ("downPayment cannot exceed the total sale amount"), it just wasn't
    // being surfaced.
    await fillStable(page.getByPlaceholder('Down payment'), '999999')
    await expect(page.getByText(/downPayment cannot exceed the total sale amount/i)).toBeVisible({
      timeout: 10_000,
    })
    await expect(page.getByText('Preview unavailable.', { exact: true })).toHaveCount(0)
  })
})
