import { test, expect } from '@playwright/test'
import { gotoReady } from './utils'

// Scenario 13 Part 4 — Debit Memos list page, mirroring the Credit Memos one.
// Self-contained (unlike credit-memos-list.spec.ts, which could lean on
// pre-existing dev-DB data from many earlier manual/e2e passes) — debit
// memos are brand new, so this creates its own fixture via direct API calls
// rather than depending on another spec file happening to run first.

let createdCustomerId: string | undefined

test.afterEach(async ({ page }) => {
  if (createdCustomerId) {
    await page.request.delete(`/api/crm/customers/${createdCustomerId}`)
    createdCustomerId = undefined
  }
})

test('Debit Memos list renders, is reachable from the sidebar, and rows expand to show line items', async ({
  page,
}) => {
  const customerName = `E2E Debit Memo List ${Date.now()}`
  const customerRes = await page.request.post('/api/crm/customers', {
    data: { name: customerName, customerType: 'individual', phone: '09170006655' },
  })
  const customer = await customerRes.json()
  createdCustomerId = customer.id

  const invoiceRes = await page.request.post('/api/ar-invoices', {
    data: {
      customerId: customer.id,
      invoiceDate: new Date().toISOString().slice(0, 10),
      dueDate: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
      description: 'E2E debit memo list fixture',
      subtotal: 500,
      taxAmount: 0,
    },
  })
  const invoice = await invoiceRes.json()
  await page.request.post(`/api/ar-invoices/${invoice.id}/send`)

  const itemsRes = await page.request.get('/api/inventory/items?limit=1')
  const items = ((await itemsRes.json()).data ?? []) as { id: string }[]
  expect(items.length).toBeGreaterThan(0)

  const memoRes = await page.request.post('/api/debit-memos', {
    data: {
      arInvoiceId: invoice.id,
      type: 'billing_adjustment',
      lines: [{ itemId: items[0].id, quantity: 1, unitPrice: 60 }],
    },
  })
  expect(memoRes.ok()).toBeTruthy()
  const memo = await memoRes.json()

  await gotoReady(page, '/accounting/ar-invoices')
  await page.getByRole('link', { name: 'Debit Memos' }).click()
  await expect(page).toHaveURL('/accounting/debit-memos')
  await expect(page.getByRole('heading', { name: 'Debit Memos' })).toBeVisible({
    timeout: 10_000,
  })

  const row = page.locator('table tbody tr', { hasText: memo.memoNumber })
  await expect(row).toBeVisible({ timeout: 10_000 })
  await expect(row.getByText('Billing Adjustment')).toBeVisible()

  await row.click()
  const detailRow = page.locator('table tbody tr').filter({ hasText: '₱60.00' })
  await expect(detailRow.first()).toBeVisible({ timeout: 10_000 })
})

test('Debit Memo invoice reference is a clickable link to the AR Invoice, not plain text', async ({
  page,
}) => {
  // Scenario 31 Part 2 — the invoice number in the memo row now links
  // through to that invoice's own detail page.
  const customerName = `E2E Debit Memo Link ${Date.now()}`
  const customerRes = await page.request.post('/api/crm/customers', {
    data: { name: customerName, customerType: 'individual', phone: '09170006644' },
  })
  const customer = await customerRes.json()
  createdCustomerId = customer.id

  const invoiceRes = await page.request.post('/api/ar-invoices', {
    data: {
      customerId: customer.id,
      invoiceDate: new Date().toISOString().slice(0, 10),
      dueDate: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
      description: 'E2E debit memo link fixture',
      subtotal: 500,
      taxAmount: 0,
    },
  })
  const invoice = await invoiceRes.json()
  await page.request.post(`/api/ar-invoices/${invoice.id}/send`)

  const itemsRes = await page.request.get('/api/inventory/items?limit=1')
  const items = ((await itemsRes.json()).data ?? []) as { id: string }[]

  const memoRes = await page.request.post('/api/debit-memos', {
    data: {
      arInvoiceId: invoice.id,
      type: 'billing_adjustment',
      lines: [{ itemId: items[0].id, quantity: 1, unitPrice: 40 }],
    },
  })
  expect(memoRes.ok()).toBeTruthy()
  const memo = await memoRes.json()

  await gotoReady(page, '/accounting/debit-memos')
  const row = page.locator('table tbody tr', { hasText: memo.memoNumber })
  await expect(row).toBeVisible({ timeout: 10_000 })

  const invoiceLink = row.getByRole('link', { name: invoice.invoiceNumber })
  await expect(invoiceLink).toBeVisible()
  // Clicking the invoice link navigates, not the row's own "expand" click.
  await invoiceLink.click()
  await expect(page).toHaveURL(`/accounting/ar-invoices/${invoice.id}`)
  await expect(page.getByRole('heading', { name: invoice.invoiceNumber })).toBeVisible({
    timeout: 10_000,
  })
})
