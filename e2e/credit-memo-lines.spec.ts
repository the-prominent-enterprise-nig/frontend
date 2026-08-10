import { test, expect, type Page } from '@playwright/test'
import { gotoReady, fillStable } from './utils'

// Scenario 13 (Credit & Debit Memos) Part 1 — CreditMemo gets a real type +
// line items instead of one flat accountant-typed amount. Self-cleaning:
// only soft-deletes the CRM customer it creates — the AR invoice + credit
// memo it produces stay, matching this suite's existing "permanent workflow
// record" tradeoff (see ar-invoice-detail-view.spec.ts's afterEach).

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

test('issuing a credit memo computes the amount from type + line items', async ({ page }) => {
  const customerName = `E2E Credit Memo ${Date.now()}`
  const customerRes = await page.request.post('/api/crm/customers', {
    data: { name: customerName, customerType: 'individual', phone: '09170005588' },
  })
  const customer = await customerRes.json()
  createdCustomerId = customer.id

  const invoiceRes = await page.request.post('/api/ar-invoices', {
    data: {
      customerId: customer.id,
      invoiceDate: new Date().toISOString().slice(0, 10),
      dueDate: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
      description: 'E2E credit memo fixture',
      subtotal: 1000,
      taxAmount: 0,
    },
  })
  expect(invoiceRes.ok()).toBeTruthy()
  const invoice = await invoiceRes.json()
  // New invoices default to DRAFT — "Issue credit memo" only shows for
  // SENT/PARTIAL/OVERDUE.
  const sendRes = await page.request.post(`/api/ar-invoices/${invoice.id}/send`)
  expect(sendRes.ok()).toBeTruthy()

  await gotoReady(page, `/accounting/ar-invoices?customerId=${customer.id}`)
  const row = page.locator('table tbody tr', { has: page.getByText(invoice.invoiceNumber) })
  await expect(row).toBeVisible({ timeout: 10_000 })

  await row.getByTitle('Issue credit memo').click()
  await expect(page.getByRole('heading', { name: 'Issue Credit Memo' })).toBeVisible({
    timeout: 10_000,
  })

  // Type defaults to "Sales Return" — leave as-is.
  const itemLabel = await pickFirstOption(page, 'Search item by name or SKU…')
  expect(itemLabel).toBeTruthy()

  const numberInputs = page.locator('input[type="number"]')
  await fillStable(numberInputs.nth(0), '2') // Qty
  await fillStable(numberInputs.nth(1), '100') // Unit Price
  await fillStable(numberInputs.nth(2), '20') // Deduction

  // 2 * 100 - 20 = 180
  await expect(page.getByText('Total Credit:')).toBeVisible()
  await expect(page.getByText('₱180.00', { exact: false })).toBeVisible()

  const [createRes] = await Promise.all([
    page.waitForResponse(
      (r) => r.url().includes('/api/credit-memos') && r.request().method() === 'POST'
    ),
    page.getByRole('button', { name: 'Issue Credit Memo', exact: true }).click(),
  ])
  expect(createRes.ok()).toBeTruthy()
  const createdMemo = await createRes.json()
  expect(createdMemo.type).toBe('sales_return')
  expect(createdMemo.amount).toBe(180)
  expect(createdMemo.lines).toHaveLength(1)

  // Dialog closes and the invoice's own row now reflects the applied credit.
  await expect(page.getByRole('heading', { name: 'Issue Credit Memo' })).not.toBeVisible({
    timeout: 10_000,
  })
})

test('cannot submit a credit memo with no line items', async ({ page }) => {
  const customerName = `E2E Credit Memo Empty ${Date.now()}`
  const customerRes = await page.request.post('/api/crm/customers', {
    data: { name: customerName, customerType: 'individual', phone: '09170005599' },
  })
  const customer = await customerRes.json()
  createdCustomerId = customer.id

  const invoiceRes = await page.request.post('/api/ar-invoices', {
    data: {
      customerId: customer.id,
      invoiceDate: new Date().toISOString().slice(0, 10),
      dueDate: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
      description: 'E2E credit memo empty-lines fixture',
      subtotal: 500,
      taxAmount: 0,
    },
  })
  const invoice = await invoiceRes.json()
  await page.request.post(`/api/ar-invoices/${invoice.id}/send`)

  await gotoReady(page, `/accounting/ar-invoices?customerId=${customer.id}`)
  const row = page.locator('table tbody tr', { has: page.getByText(invoice.invoiceNumber) })
  await expect(row).toBeVisible({ timeout: 10_000 })
  await row.getByTitle('Issue credit memo').click()
  await expect(page.getByRole('heading', { name: 'Issue Credit Memo' })).toBeVisible({
    timeout: 10_000,
  })

  // Line 1's item/price are left blank — zodResolver should block submission
  // client-side (no POST fires) rather than let an invalid payload through.
  let sawPost = false
  page.on('request', (r) => {
    if (r.url().includes('/api/credit-memos') && r.method() === 'POST') sawPost = true
  })
  await page.getByRole('button', { name: 'Issue Credit Memo', exact: true }).click()
  await page.waitForTimeout(500)
  expect(sawPost).toBe(false)
  await expect(page.getByRole('heading', { name: 'Issue Credit Memo' })).toBeVisible()
})
