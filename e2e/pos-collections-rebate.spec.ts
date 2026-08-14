import { test, expect, type APIResponse } from '@playwright/test'
import { gotoReady, fillStable } from './utils'

let createdCustomerId: string | undefined

// Backend list endpoints aren't consistent about pagination envelopes — some
// return { data: [...] }, others a raw array. Same helper
// pos-collections-same-day-guard.spec.ts already uses.
async function unwrap<T>(res: APIResponse): Promise<T[]> {
  const body = await res.json()
  return Array.isArray(body) ? body : (body.data ?? [])
}

test.afterEach(async ({ page }) => {
  // Soft-deletes (sets deletedAt) — the credit application/transaction/
  // invoices it produced stay, same "permanent workflow record" tradeoff
  // ar-invoice-detail-view.spec.ts and customer360-installment-plan-detail.spec.ts
  // already accept for this fixture shape.
  if (createdCustomerId) {
    await page.request.delete(`/api/crm/customers/${createdCustomerId}`)
    createdCustomerId = undefined
  }
})

// Collections rebate (Prompt Payment Discount) — covers the new rebate field
// on POS Collections' "Collect Payment" modal: it's pre-filled with the
// linked InstallmentAccount's ppd, the "Amount received" field nets it out
// (so accepting both defaults settles the due exactly, not an overpayment),
// exceeding the cap is blocked client-side, and a within-cap rebate posts
// successfully. Fixture setup mirrors ar-invoice-detail-view.spec.ts exactly
// (business owner self-approves the credit application and has
// pos:transaction:override, so the installment sale completes immediately).

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

test('Collect Payment pre-fills the rebate at ppd, nets it out of the suggested amount, blocks exceeding the cap, and posts within it', async ({
  page,
}) => {
  const applicantName = `E2E Rebate Collections ${Date.now()}`
  const customerRes = await page.request.post('/api/crm/customers', {
    data: {
      name: applicantName,
      customerType: 'individual',
      phone: '09170006688',
      creditLimit: 200000,
      coMakers: [
        { name: 'E2E Rebate Co-Maker', relationship: 'Spouse', contactNumber: '09171116688' },
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
  // Scenario 01 Gap 4 — installment sales require a down payment of at
  // least 10% of the line's sale amount.
  const downPayment = Math.round(cartSubtotal * 0.1 * 100) / 100
  const txRes = await page.request.post('/api/pos/transactions', {
    data: {
      sessionId,
      customerId: customer.id,
      invoiceType: 'installment',
      financingTermId: term.id,
      creditApplicationId: application.id,
      downPayment,
      subtotal: cartSubtotal,
      totalAmount: cartSubtotal,
      currency: 'PHP',
      lines: [{ itemId: item.id, itemName: item.name, quantity: 1, unitPrice: item.sellingPrice }],
    },
  })
  expect(txRes.ok()).toBeTruthy()
  const transaction = await txRes.json()
  expect(transaction.status).toBe('completed')

  // Real ppd for this account, straight from the API — used to assert the
  // modal's pre-fill exactly, not just "some positive number".
  const schedules = await unwrap<{
    lines: { arInvoice: { totalAmount: number; amountPaid: number } }[]
    installmentAccount: { ppd: number } | null
  }>(await page.request.get(`/api/pos/customers/${customer.id}/installment-schedules`))
  const schedule = schedules[0]
  const ppd = Number(schedule.installmentAccount!.ppd)
  expect(ppd).toBeGreaterThan(0)
  const outstanding =
    schedule.lines[0].arInvoice.totalAmount - schedule.lines[0].arInvoice.amountPaid

  await gotoReady(page, '/pos/collections')
  const searchInput = page.getByPlaceholder('Filter by name or phone…')
  await fillStable(searchInput, applicantName)
  const customerRow = page.locator('ul > li > button').filter({ hasText: applicantName })
  await expect(customerRow).toBeVisible({ timeout: 10_000 })
  await customerRow.click()

  const due1 = page.locator('li').filter({ hasText: 'Payment 1 of' })
  await expect(due1).toBeVisible({ timeout: 10_000 })
  await due1.getByRole('button', { name: 'Collect' }).click()
  await expect(page.getByRole('heading', { name: 'Collect Payment' })).toBeVisible()

  // Neither field has htmlFor/id association (same as every other field in
  // this modal — Amount received, Payment date, etc.) — positional, matching
  // pos-collections-same-day-guard.spec.ts's own convention for this file.
  const amountInput = page.locator('input[type="number"]').first()
  const rebateInput = page.locator('input[type="number"]').nth(1)

  // Pre-filled at ppd, and Amount received is netted (outstanding - ppd) so
  // accepting both defaults settles the due exactly.
  await expect(rebateInput).toHaveValue(String(ppd))
  await expect(amountInput).toHaveValue(String(Math.round((outstanding - ppd) * 100) / 100))
  await expect(page.getByText(`Up to`, { exact: false })).toBeVisible()

  // Exceeding the cap is blocked client-side before it ever reaches the
  // server's own rebate_exceeds_ppd check.
  await fillStable(rebateInput, String(ppd + 50))
  await expect(page.getByText("Rebate can't exceed", { exact: false })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Collect payment' })).toBeDisabled()

  // Back within cap — submits successfully and settles the due.
  await fillStable(rebateInput, String(ppd))
  await expect(page.getByRole('button', { name: 'Collect payment' })).toBeEnabled()
  await page.getByRole('button', { name: 'Collect payment' }).click()
  await expect(page.getByRole('heading', { name: 'Collect Payment' })).not.toBeVisible({
    timeout: 10_000,
  })
  await expect(due1.getByTitle('This due is already fully paid')).toBeVisible({ timeout: 10_000 })
})
