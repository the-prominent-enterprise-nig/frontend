import { test, expect, type Page } from '@playwright/test'
import { gotoReady, clickStable, fillStable, openCustomSelect, pickCartPriceUse } from './utils'

// Scenario 01 Gap 4 — installment sales need a down payment. It started at a
// 10% floor; since 2026-10-15 the 10% is only the figure a line starts at, the
// cashier may go lower, and the one hard rule is "never 0" (backend
// enforcement is in backend/test/pos-x-deal-checkout.e2e-spec.ts XD-S12b/c).
// This spec covers the client-side mirror in checkout/page.tsx's handleConfirm
// validation — the same split this codebase already uses for the
// credit-application requirement (see
// pos-checkout-installment-credit-application.spec.ts).

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
  await pickCartPriceUse(page, 'WIP')

  await clickStable(
    page.getByRole('button', { name: 'Installment', exact: true }),
    page.getByTestId('down-payment-input')
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
  test('auto-fills the down payment at 10% on term selection and allows any amount, even 0', async ({
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

    const termSelect = page.getByRole('combobox', { name: 'Select a term…' })
    await expect(termSelect).toBeVisible({ timeout: 10_000 })
    // Scenario 64 — the term dropdown is the shared Select now, not a native
    // <select>: no placeholder <option>, so the old selectOption({index:1})
    // (index 0 being the placeholder) is simply the first real option.
    await openCustomSelect(termSelect)
    await page.getByRole('option').first().click()

    // Scenario 64 — shared Select: named by what it shows (the placeholder
    // while unselected), options live in a popup, not as <option> children.
    const picker = page.getByRole('combobox', { name: 'Select an approved application…' })
    await expect(picker).toBeVisible({ timeout: 10_000 })
    await openCustomSelect(picker)
    await page.getByRole('option').filter({ hasText: applicationNumber }).click()

    // Picking a term auto-fills the down payment at 10% — the field is open
    // from the start, so a cashier can see and change it. Leaving it blank/0
    // used to render a misleading "Nothing to collect at checkout for this
    // cart." even though a 0 down payment can never actually be submitted.
    const downPaymentInput = page.getByTestId('down-payment-input')
    await expect(downPaymentInput).not.toHaveValue('')
    await expect(page.getByText('Nothing to collect at checkout for this cart.')).toHaveCount(0)

    // There is no percentage floor (2026-10-15), and since 2026-10-28 an
    // in-house plan may take no down payment at all: 0 is accepted, and with
    // nothing to collect at the register the till says so instead of asking
    // for a payment.
    await fillStable(downPaymentInput, '0')
    await expect(page.getByTestId('down-payment-error')).toHaveCount(0)
    await expect(page.getByText('Nothing to collect for the items at checkout')).toBeVisible()

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

    const termSelect = page.getByRole('combobox', { name: 'Select a term…' })
    await expect(termSelect).toBeVisible({ timeout: 10_000 })
    // Scenario 64 — the term dropdown is the shared Select now, not a native
    // <select>: no placeholder <option>, so the old selectOption({index:1})
    // (index 0 being the placeholder) is simply the first real option.
    await openCustomSelect(termSelect)
    await page.getByRole('option').first().click()

    // Scenario 64 — shared Select: named by what it shows (the placeholder
    // while unselected), options live in a popup, not as <option> children.
    const picker = page.getByRole('combobox', { name: 'Select an approved application…' })
    await expect(picker).toBeVisible({ timeout: 10_000 })
    await openCustomSelect(picker)
    await page.getByRole('option').filter({ hasText: applicationNumber }).click()

    // A down payment well above the item's price used to render a bare,
    // unexplained "Preview unavailable." — the backend's own preview
    // endpoint already rejects this with a clear reason
    // ("downPayment cannot exceed the total sale amount"), it just wasn't
    // being surfaced.
    await fillStable(page.getByTestId('down-payment-input'), '999999')
    await expect(page.getByText(/downPayment cannot exceed the total sale amount/i)).toBeVisible({
      timeout: 10_000,
    })
    await expect(page.getByText('Preview unavailable.', { exact: true })).toHaveCount(0)
  })
})
