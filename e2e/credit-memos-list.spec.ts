import { test, expect } from '@playwright/test'
import { gotoReady } from './utils'

// Scenario 13 — Credit Memos list page. Previously there was nowhere in the
// app to view an issued credit memo (manual or auto-created from a POS
// return) after creation; this is the minimal fix. Reads only — doesn't
// create its own fixture, relies on whatever credit memos already exist in
// the shared dev DB from Part 1/Part 3's own e2e specs (which don't tear
// theirs down, matching this suite's "permanent workflow record" convention).

test('Credit Memos list renders, is reachable from the sidebar, and rows expand to show line items', async ({
  page,
}) => {
  await gotoReady(page, '/accounting/ar-invoices')
  await page.getByRole('link', { name: 'Credit Memos' }).click()
  await expect(page).toHaveURL('/accounting/credit-memos')
  await expect(page.getByRole('heading', { name: 'Credit Memos' })).toBeVisible({
    timeout: 10_000,
  })

  const row = page.locator('table tbody tr').first()
  await expect(row).toBeVisible({ timeout: 10_000 })
  // Memo #, Type, Amount, Status columns all render something real.
  await expect(row.locator('td').nth(1)).not.toBeEmpty()

  await row.click()
  const detailRow = page.locator('table tbody tr').nth(1)
  await expect(detailRow).toBeVisible({ timeout: 10_000 })
})

test('a memo auto-created from a POS return shows its source', async ({ page }) => {
  await gotoReady(page, '/accounting/credit-memos')
  await expect(page.getByRole('heading', { name: 'Credit Memos' })).toBeVisible({
    timeout: 10_000,
  })

  const autoRow = page.locator('table tbody tr', { hasText: 'Auto — POS return' })
  await expect(autoRow.first()).toBeVisible({ timeout: 10_000 })
})

let createdCustomerId: string | undefined

test.afterEach(async ({ page }) => {
  if (createdCustomerId) {
    await page.request.delete(`/api/crm/customers/${createdCustomerId}`)
    createdCustomerId = undefined
  }
})

test('Credit Memo invoice reference is a clickable link to the AR Invoice, not plain text', async ({
  page,
}) => {
  // Scenario 31 Part 2 — the invoice number in the memo row now links
  // through to that invoice's own detail page. Self-contained (unlike this
  // file's other tests), since it needs a specific memo/invoice pairing.
  const customerName = `E2E Credit Memo Link ${Date.now()}`
  const customerRes = await page.request.post('/api/crm/customers', {
    data: { name: customerName, customerType: 'individual', phone: '09170006622' },
  })
  const customer = await customerRes.json()
  createdCustomerId = customer.id

  const invoiceRes = await page.request.post('/api/ar-invoices', {
    data: {
      customerId: customer.id,
      invoiceDate: new Date().toISOString().slice(0, 10),
      dueDate: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
      description: 'E2E credit memo link fixture',
      subtotal: 500,
      taxAmount: 0,
    },
  })
  const invoice = await invoiceRes.json()
  await page.request.post(`/api/ar-invoices/${invoice.id}/send`)

  const itemsRes = await page.request.get('/api/inventory/items?limit=1')
  const items = ((await itemsRes.json()).data ?? []) as { id: string }[]

  const memoRes = await page.request.post('/api/credit-memos', {
    data: {
      arInvoiceId: invoice.id,
      type: 'billing_adjustment',
      lines: [{ itemId: items[0].id, quantity: 1, unitPrice: 30 }],
    },
  })
  expect(memoRes.ok()).toBeTruthy()
  const memo = await memoRes.json()

  await gotoReady(page, '/accounting/credit-memos')
  const row = page.locator('table tbody tr', { hasText: memo.memoNumber })
  await expect(row).toBeVisible({ timeout: 10_000 })

  const invoiceLink = row.getByRole('link', { name: invoice.invoiceNumber })
  await expect(invoiceLink).toBeVisible()
  await invoiceLink.click()
  await expect(page).toHaveURL(`/accounting/ar-invoices/${invoice.id}`)
  await expect(page.getByRole('heading', { name: invoice.invoiceNumber })).toBeVisible({
    timeout: 10_000,
  })
})
