import { test, expect } from '@playwright/test'
import { gotoReady } from './utils'

let createdCustomerId: string | undefined

test.afterEach(async ({ page }) => {
  // Soft-deletes (sets deletedAt) — the credit application/transaction/
  // invoices it produced stay, consistent with this codebase's existing
  // "permanent workflow record" tradeoff (see
  // customer360-installment-plan-detail.spec.ts, same cleanup approach).
  if (createdCustomerId) {
    await page.request.delete(`/api/crm/customers/${createdCustomerId}`)
    createdCustomerId = undefined
  }
})

// Scenario 25 — per-invoice detail view, formatted as a real printable
// document, reachable both from the AR Invoices list and from a customer's
// Installment Plan in CRM. Setup mirrors
// customer360-installment-plan-detail.spec.ts's fixture exactly (business
// owner self-approves the credit application and has
// pos:transaction:override, so the installment sale completes immediately
// via a direct API call — no need to drive the manager-approval flow).

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

test('per-invoice detail view is reachable from both the AR Invoices list and Customer360, with a working print/download', async ({
  page,
}) => {
  const applicantName = `E2E AR Invoice Detail ${Date.now()}`
  const customerRes = await page.request.post('/api/crm/customers', {
    data: {
      name: applicantName,
      customerType: 'individual',
      phone: '09170005577',
      creditLimit: 200000,
      coMakers: [
        {
          name: 'E2E AR Invoice Detail Co-Maker',
          relationship: 'Spouse',
          contactNumber: '09171115577',
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
  }[]
  const item = items[0]

  const appRes = await page.request.post('/api/credit/applications', {
    data: {
      branchId,
      applicantCustomerId: customer.id,
      coMakerId: customer.coMakers[0].id,
      requestedAmount: item.sellingPrice * 2,
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
  await page.request.patch(`/api/credit/applications/${application.id}/approve`)

  const cartSubtotal = item.sellingPrice
  const txRes = await page.request.post('/api/pos/transactions', {
    data: {
      sessionId,
      customerId: customer.id,
      invoiceType: 'installment',
      financingTermId: term.id,
      creditApplicationId: application.id,
      downPayment: 0,
      subtotal: cartSubtotal,
      totalAmount: cartSubtotal,
      currency: 'PHP',
      lines: [{ itemId: item.id, itemName: item.name, quantity: 1, unitPrice: item.sellingPrice }],
    },
  })
  expect(txRes.ok()).toBeTruthy()
  const transaction = await txRes.json()
  expect(transaction.status).toBe('completed')

  // ─── Reachable from the AR Invoices list (Closing Gap 1) ───────────────
  const invoicesRes = await page.request.get('/api/ar-invoices', {
    params: { customerId: customer.id },
  })
  const invoicesBody = await invoicesRes.json()
  const invoices = (invoicesBody.items ?? invoicesBody.data ?? []) as {
    id: string
    invoiceNumber: string
  }[]
  expect(invoices.length).toBeGreaterThan(0)
  const invoice = invoices[0]

  await gotoReady(page, `/accounting/ar-invoices?customerId=${customer.id}`)
  const row = page.locator('table tbody tr', { has: page.getByText(invoice.invoiceNumber) })
  await expect(row).toBeVisible({ timeout: 10_000 })
  // Click a non-invoice-number cell (customer name) — the whole row must
  // navigate, not just the invoice number text.
  await row.getByText(applicantName).click()
  await expect(page).toHaveURL(`/accounting/ar-invoices/${invoice.id}`)
  await expect(page.getByRole('heading', { name: invoice.invoiceNumber })).toBeVisible({
    timeout: 10_000,
  })

  // Standard fields + installment item/rebate breakdown both render.
  await expect(page.getByText(applicantName)).toBeVisible()
  await expect(page.getByText(item.name, { exact: false }).first()).toBeVisible()
  await expect(page.getByText('Rebate on this due date', { exact: false })).toBeVisible()

  // Print/Download opens a popup with the right content — same
  // printInventoryDocument() shell Purchase Orders already use.
  const [popup] = await Promise.all([
    page.waitForEvent('popup'),
    page.getByRole('button', { name: 'Print / Download' }).click(),
  ])
  await popup.waitForLoadState('domcontentloaded')
  await expect(popup.locator('h1')).toHaveText(invoice.invoiceNumber)
  await expect(popup.getByText('AR Invoice', { exact: true })).toBeVisible()
  await expect(popup.getByText(item.name, { exact: false })).toBeVisible()
  await popup.close()

  // ─── Reachable from Customer360's Installment Plan (Closing Gap 2) ─────
  await gotoReady(page, `/crm/customers/${customer.id}`)
  await expect(page.getByText('Installment Plans', { exact: true })).toBeVisible({
    timeout: 10_000,
  })
  await page.getByText(item.name, { exact: false }).first().click()
  await expect(page.getByText(/^INST-/).first()).toBeVisible({ timeout: 10_000 })

  await page.getByRole('link', { name: new RegExp(invoice.invoiceNumber) }).click()
  await expect(page).toHaveURL(`/accounting/ar-invoices/${invoice.id}`, { timeout: 10_000 })
  await expect(page.getByRole('heading', { name: invoice.invoiceNumber })).toBeVisible({
    timeout: 10_000,
  })
})
