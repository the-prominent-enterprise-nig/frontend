import { test, expect } from '@playwright/test'
import { gotoReady, fillStable } from './utils'

let createdCustomerId: string | undefined
let mutatedItem: { id: string; originalModelNumber: string | null } | undefined
let createdPriceUseTypeId: string | undefined
let createdAgentId: string | undefined

test.afterEach(async ({ page }) => {
  if (createdCustomerId) {
    await page.request.delete(`/api/crm/customers/${createdCustomerId}`)
    createdCustomerId = undefined
  }
  if (mutatedItem) {
    await page.request.patch(`/api/inventory/items/${mutatedItem.id}`, {
      data: { modelNumber: mutatedItem.originalModelNumber },
    })
    mutatedItem = undefined
  }
  if (createdPriceUseTypeId) {
    await page.request.delete(`/api/inventory/price-use-types/${createdPriceUseTypeId}`)
    createdPriceUseTypeId = undefined
  }
  if (createdAgentId) {
    await page.request.delete(`/api/crm/agents/${createdAgentId}`)
    createdAgentId = undefined
  }
})

// Scenario 32 item 1 — the installment account's own ledger screen
// (InstallmentAccountDetail.tsx) now shows the financed item's name, model
// number, and serial number for POS-originated accounts, resolved via the
// linked InstallmentSchedule the same way Customer360's modal already does.
// Scenario 32 item 2 — the same screen now shows the financing scheme
// (priceUseType) the sale was made under. Scenario 32 item 3 — the same
// screen now shows the selling agent ("Salesperson") the sale was made
// under. Scenario 32 item 4 — the same screen now shows running totals
// (Total billing/Total payments/Total rebates), and using the existing
// "Record payment" button updates Total payments/Total rebates live.
// Scenario 32 item 5 — the same screen now shows a Billing history list
// (one row per due-date invoice), moved here from Customer360's schedule-
// detail modal. Backend resolution correctness for all five is covered by
// backend/test/installment-account-customer-ledger.e2e-spec.ts — this spec
// sticks to the UI surface, same split as customer360-installment-plan-detail.spec.ts.

async function ensureOpenSession(page: import('@playwright/test').Page, branchId: string) {
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

  const openRes = await page.request.post('/api/pos/sessions/open', {
    data: { terminalId: terminal.id, openingCash: 1000 },
  })
  const session = await openRes.json()
  return session.id as string
}

test('installment account ledger screen shows unit, financing scheme, and salesperson for a POS-originated account', async ({
  page,
}) => {
  const applicantName = `E2E Customer Ledger Unit ${Date.now()}`
  const customerRes = await page.request.post('/api/crm/customers', {
    data: {
      name: applicantName,
      customerType: 'individual',
      phone: '09170006677',
      creditLimit: 200000,
      coMakers: [
        {
          name: 'E2E Customer Ledger Co-Maker',
          relationship: 'Spouse',
          contactNumber: '09171116677',
        },
      ],
    },
  })
  const customer = await customerRes.json()
  createdCustomerId = customer.id

  const branchesRes = await page.request.get('/api/branches?limit=200')
  const branches = ((await branchesRes.json()).data ?? []) as { id: string; name: string }[]
  const branchId = branches.find((b) => b.name === 'Bago')!.id
  const sessionId = await ensureOpenSession(page, branchId)

  const termsRes = await page.request.get('/api/pos/financing-terms')
  const termsBody = await termsRes.json()
  const terms = (termsBody.data ?? termsBody) as { id: string; termMonths: number }[]
  const term = terms.find((t) => t.termMonths === 3) ?? terms[0]

  const itemsRes = await page.request.get('/api/inventory/items', {
    params: { search: 'Universal Remote Control', limit: '1' },
  })
  const items = ((await itemsRes.json()).data ?? []) as {
    id: string
    name: string
    sellingPrice: number
    modelNumber: string | null
  }[]
  const item = items[0]

  const testModelNumber = `E2E-UNIT-MODEL-${Date.now()}`
  mutatedItem = { id: item.id, originalModelNumber: item.modelNumber ?? null }
  await page.request.patch(`/api/inventory/items/${item.id}`, {
    data: { modelNumber: testModelNumber },
  })

  const schemeName = `E2E-SCHEME-${Date.now()}`
  const schemeRes = await page.request.post('/api/inventory/price-use-types', {
    data: { name: schemeName },
  })
  const scheme = await schemeRes.json()
  createdPriceUseTypeId = scheme.id

  const agentName = `E2E Agent ${Date.now()}`
  const agentRes = await page.request.post('/api/crm/agents', { data: { name: agentName } })
  const agent = await agentRes.json()
  createdAgentId = agent.id

  // Scenario 17 Part 6 — every installment sale requires an approved,
  // unconsumed CreditApplication.
  const appRes = await page.request.post('/api/credit/applications', {
    data: {
      branchId,
      applicantCustomerId: customer.id,
      coMakerId: customer.coMakers[0].id,
      requestedAmount: item.sellingPrice * 2,
      items: [{ itemId: item.id }],
      totalMonthlyIncome: 60000,
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
    data: { affordabilityOutcome: 'recommend_approve', notes: 'E2E fixture' },
  })
  // Scenario 29 POS-02 — approval is per-item now (approve/decline each
  // CreditApplicationItem), not a single application-level approve call.
  await page.request.patch(`/api/credit/applications/${application.id}/decide`, {
    data: { approveItemIds: [application.items[0].id], declineItemIds: [] },
  })

  const downPayment = Math.round(item.sellingPrice * 0.1 * 100) / 100
  const txRes = await page.request.post('/api/pos/transactions', {
    data: {
      sessionId,
      customerId: customer.id,
      invoiceType: 'installment',
      financingTermId: term.id,
      creditApplicationId: application.id,
      priceUseTypeId: scheme.id,
      sellingAgentId: agent.id,
      downPayment,
      subtotal: item.sellingPrice,
      totalAmount: item.sellingPrice,
      currency: 'PHP',
      lines: [{ itemId: item.id, itemName: item.name, quantity: 1, unitPrice: item.sellingPrice }],
    },
  })
  expect(txRes.ok()).toBeTruthy()

  const accountsRes = await page.request.get('/api/crm/installment-accounts', {
    params: { customerId: customer.id, limit: '1' },
  })
  const accountsBody = await accountsRes.json()
  const accounts = (accountsBody.data ?? []) as { id: string }[]
  const accountId = accounts[0].id

  await gotoReady(page, `/crm/installment-accounts/${accountId}`)

  await expect(page.getByText('Unit', { exact: true })).toBeVisible({ timeout: 10_000 })
  const unitRows = page.getByTestId('unit-items').locator('li')
  await expect(unitRows).toHaveCount(1)
  await expect(unitRows.first()).toContainText(item.name)
  await expect(unitRows.first()).toContainText(`Model: ${testModelNumber}`)

  await expect(page.getByText('Scheme', { exact: true })).toBeVisible()
  await expect(page.getByText(schemeName, { exact: true })).toBeVisible()

  await expect(page.getByText('Salesperson', { exact: true })).toBeVisible()
  await expect(page.getByText(agentName, { exact: true })).toBeVisible()

  await expect(page.getByText('Running totals', { exact: true })).toBeVisible()
  await expect(page.locator('dt', { hasText: 'Total billing' })).toBeVisible()
  const totalPaymentsValue = page
    .locator('dt', { hasText: 'Total payments' })
    .locator('xpath=following-sibling::dd[1]')
  await expect(totalPaymentsValue).toHaveText('₱0.00')

  await page.getByRole('button', { name: 'Record payment' }).click()
  await fillStable(page.locator('#payment-amount'), '50')
  await fillStable(page.locator('#payment-orNumber'), 'E2E-OR-UI')
  await page.getByRole('button', { name: 'Record payment', exact: true }).last().click()
  await expect(page.getByText(/Payment recorded/)).toBeVisible({ timeout: 10_000 })
  await page.getByRole('button', { name: 'Done' }).click()

  await expect(totalPaymentsValue).toHaveText('₱50.00')

  await expect(page.getByText('Billing history', { exact: true })).toBeVisible()
  const billingRows = page.getByTestId('billing-history').locator('li')
  await expect(billingRows).toHaveCount(3)
  await expect(billingRows.first()).toContainText('Payment 1 of 3')
  await expect(billingRows.first()).toContainText('Due')
  await expect(billingRows.first()).not.toContainText('paid')

  // Developer-requested (2026-08-19): a due date that's actually been paid
  // shows WHEN it was paid, not just its status.
  const accountRes = await page.request.get(`/api/crm/installment-accounts/${accountId}`)
  const accountDetail = await accountRes.json()
  const firstInvoiceId = accountDetail.billingHistory[0].arInvoiceId
  await page.request.post(`/api/ar-invoices/${firstInvoiceId}/payments`, {
    data: { amount: 1, paymentDate: new Date().toISOString() },
  })

  await gotoReady(page, `/crm/installment-accounts/${accountId}`)
  await expect(page.getByTestId('billing-history').locator('li').first()).toContainText('paid')

  // Scenario 32 item 6 — TMI is a read-only copy taken from the approved
  // CreditApplication at checkout time; IC is a plain, directly-editable
  // financing-terms value.
  await expect(page.locator('dt', { hasText: 'TMI (Total monthly income)' })).toBeVisible()
  const tmiValue = page
    .locator('dt', { hasText: 'TMI (Total monthly income)' })
    .locator('xpath=following-sibling::dd[1]')
  await expect(tmiValue).toHaveText('₱60,000.00')

  await page.getByRole('link', { name: 'Edit' }).click()
  await fillStable(page.locator('#insuranceCharge'), '250')
  await page.getByRole('button', { name: 'Save changes' }).click()
  await expect(page).toHaveURL(new RegExp(`/crm/installment-accounts/${accountId}$`))

  const icValue = page
    .locator('dt', { hasText: 'IC (Insurance charge)' })
    .locator('xpath=following-sibling::dd[1]')
  await expect(icValue).toHaveText('₱250.00')
})
