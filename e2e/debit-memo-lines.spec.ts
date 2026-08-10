import { test, expect, type Page } from '@playwright/test'
import { gotoReady, fillStable } from './utils'

// Scenario 13 (Credit & Debit Memos) Part 4 — DebitMemo mirrors CreditMemo's
// type + line-item dialog, reversed effect (adds to what's owed instead of
// paying it down). Self-cleaning: only soft-deletes the CRM customer it
// creates — the AR invoice + debit memo it produces stay, matching this
// suite's existing "permanent workflow record" tradeoff.

let createdCustomerId: string | undefined

test.afterEach(async ({ page }) => {
  if (createdCustomerId) {
    await page.request.delete(`/api/crm/customers/${createdCustomerId}`)
    createdCustomerId = undefined
  }
})

// SearchCombobox (src/components/ui/SearchCombobox.tsx) portals its dropdown
// to document.body as a `fixed z-100` panel of plain <button> options.
async function pickFirstOption(page: Page, inputPlaceholder: string): Promise<string | null> {
  const input = page.getByPlaceholder(inputPlaceholder)
  await input.click()
  await input.fill('a')
  const dropdown = page.locator('div.fixed.z-100')
  await expect(dropdown).toBeVisible({ timeout: 10_000 })
  const option = dropdown.locator('button').first()
  await expect(option).toBeVisible({ timeout: 10_000 })
  const label = (await option.locator('span').first().textContent())?.trim() ?? null
  await option.click()
  return label
}

test('issuing a debit memo computes the amount from type + line items', async ({ page }) => {
  const customerName = `E2E Debit Memo ${Date.now()}`
  const customerRes = await page.request.post('/api/crm/customers', {
    data: { name: customerName, customerType: 'individual', phone: '09170006688' },
  })
  const customer = await customerRes.json()
  createdCustomerId = customer.id

  const invoiceRes = await page.request.post('/api/ar-invoices', {
    data: {
      customerId: customer.id,
      invoiceDate: new Date().toISOString().slice(0, 10),
      dueDate: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
      description: 'E2E debit memo fixture',
      subtotal: 1000,
      taxAmount: 0,
    },
  })
  expect(invoiceRes.ok()).toBeTruthy()
  const invoice = await invoiceRes.json()
  // New invoices default to DRAFT — "Issue debit memo" only shows for
  // SENT/PARTIAL/OVERDUE/PAID.
  const sendRes = await page.request.post(`/api/ar-invoices/${invoice.id}/send`)
  expect(sendRes.ok()).toBeTruthy()

  await gotoReady(page, `/accounting/ar-invoices?customerId=${customer.id}`)
  const row = page.locator('table tbody tr', { has: page.getByText(invoice.invoiceNumber) })
  await expect(row).toBeVisible({ timeout: 10_000 })

  await row.getByLabel('Issue debit memo').click()
  await expect(page.getByRole('heading', { name: 'Issue Debit Memo' })).toBeVisible({
    timeout: 10_000,
  })

  // Type defaults to "Unit Replacement" — leave as-is.
  const itemLabel = await pickFirstOption(page, 'Search item by name or SKU…')
  expect(itemLabel).toBeTruthy()

  const numberInputs = page.locator('input[type="number"]')
  await fillStable(numberInputs.nth(0), '2') // Qty
  await fillStable(numberInputs.nth(1), '100') // Unit Price
  await fillStable(numberInputs.nth(2), '20') // Addition

  // 2 * 100 + 20 = 220, new invoice total 1000 + 220 = 1220
  await expect(page.getByText('Total Debit:')).toBeVisible()
  await expect(page.getByText('₱220.00', { exact: false })).toBeVisible()
  await expect(page.getByText('₱1,220.00', { exact: false })).toBeVisible()

  const [createRes] = await Promise.all([
    page.waitForResponse(
      (r) => r.url().includes('/api/debit-memos') && r.request().method() === 'POST'
    ),
    page.getByRole('button', { name: 'Issue Debit Memo', exact: true }).click(),
  ])
  expect(createRes.ok()).toBeTruthy()
  const createdMemo = await createRes.json()
  expect(createdMemo.type).toBe('unit_replacement')
  expect(createdMemo.amount).toBe(220)
  expect(createdMemo.lines).toHaveLength(1)

  await expect(page.getByRole('heading', { name: 'Issue Debit Memo' })).not.toBeVisible({
    timeout: 10_000,
  })
})

test('cannot submit a debit memo with no line items', async ({ page }) => {
  const customerName = `E2E Debit Memo Empty ${Date.now()}`
  const customerRes = await page.request.post('/api/crm/customers', {
    data: { name: customerName, customerType: 'individual', phone: '09170006699' },
  })
  const customer = await customerRes.json()
  createdCustomerId = customer.id

  const invoiceRes = await page.request.post('/api/ar-invoices', {
    data: {
      customerId: customer.id,
      invoiceDate: new Date().toISOString().slice(0, 10),
      dueDate: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
      description: 'E2E debit memo empty-lines fixture',
      subtotal: 500,
      taxAmount: 0,
    },
  })
  const invoice = await invoiceRes.json()
  await page.request.post(`/api/ar-invoices/${invoice.id}/send`)

  await gotoReady(page, `/accounting/ar-invoices?customerId=${customer.id}`)
  const row = page.locator('table tbody tr', { has: page.getByText(invoice.invoiceNumber) })
  await expect(row).toBeVisible({ timeout: 10_000 })
  await row.getByLabel('Issue debit memo').click()
  await expect(page.getByRole('heading', { name: 'Issue Debit Memo' })).toBeVisible({
    timeout: 10_000,
  })

  let sawPost = false
  page.on('request', (r) => {
    if (r.url().includes('/api/debit-memos') && r.method() === 'POST') sawPost = true
  })
  await page.getByRole('button', { name: 'Issue Debit Memo', exact: true }).click()
  await page.waitForTimeout(500)
  expect(sawPost).toBe(false)
  await expect(page.getByRole('heading', { name: 'Issue Debit Memo' })).toBeVisible()
})

test('the debit memo button is offered even on an already-fully-paid invoice', async ({ page }) => {
  const customerName = `E2E Debit Memo Paid ${Date.now()}`
  const customerRes = await page.request.post('/api/crm/customers', {
    data: { name: customerName, customerType: 'individual', phone: '09170006677' },
  })
  const customer = await customerRes.json()
  createdCustomerId = customer.id

  const invoiceRes = await page.request.post('/api/ar-invoices', {
    data: {
      customerId: customer.id,
      invoiceDate: new Date().toISOString().slice(0, 10),
      dueDate: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
      description: 'E2E debit memo paid-invoice fixture',
      subtotal: 300,
      taxAmount: 0,
    },
  })
  const invoice = await invoiceRes.json()
  await page.request.post(`/api/ar-invoices/${invoice.id}/send`)
  const payRes = await page.request.post(`/api/ar-invoices/${invoice.id}/payments`, {
    data: { amount: 300, paymentDate: new Date().toISOString().slice(0, 10), method: 'CASH' },
  })
  expect(payRes.ok()).toBeTruthy()

  await gotoReady(page, `/accounting/ar-invoices?customerId=${customer.id}`)
  const row = page.locator('table tbody tr', { has: page.getByText(invoice.invoiceNumber) })
  await expect(row).toBeVisible({ timeout: 10_000 })
  // Credit memo is NOT offered (nothing outstanding to credit), but debit
  // memo IS — a debit can always add a new charge, even to a closed invoice.
  await expect(row.getByLabel('Issue credit memo')).toHaveCount(0)
  await expect(row.getByLabel('Issue debit memo')).toHaveCount(1)
})

test('the Addition field starts at 0 but can be cleared and retyped', async ({ page }) => {
  const customerName = `E2E Debit Memo Clear ${Date.now()}`
  const customerRes = await page.request.post('/api/crm/customers', {
    data: { name: customerName, customerType: 'individual', phone: '09170006611' },
  })
  const customer = await customerRes.json()
  createdCustomerId = customer.id

  const invoiceRes = await page.request.post('/api/ar-invoices', {
    data: {
      customerId: customer.id,
      invoiceDate: new Date().toISOString().slice(0, 10),
      dueDate: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
      description: 'E2E debit memo clear-field fixture',
      subtotal: 500,
      taxAmount: 0,
    },
  })
  const invoice = await invoiceRes.json()
  await page.request.post(`/api/ar-invoices/${invoice.id}/send`)

  await gotoReady(page, `/accounting/ar-invoices?customerId=${customer.id}`)
  const row = page.locator('table tbody tr', { has: page.getByText(invoice.invoiceNumber) })
  await row.getByLabel('Issue debit memo').click()
  await expect(page.getByRole('heading', { name: 'Issue Debit Memo' })).toBeVisible({
    timeout: 10_000,
  })

  const additionInput = page.locator('input[type="number"]').nth(2)
  await expect(additionInput).toHaveValue('0')

  await additionInput.click()
  await additionInput.press('Home')
  await additionInput.press('Shift+End')
  await additionInput.press('Backspace')
  await expect(additionInput).toHaveValue('')

  await additionInput.type('20')
  await expect(additionInput).toHaveValue('20')
})
