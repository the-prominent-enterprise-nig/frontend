import { test, expect } from '@playwright/test'
import { gotoReady } from './utils'

// Scenario 31 Part 4 — AR Invoices already computed overdue state for the
// red "Due" amount and the OVERDUE badge, but never showed the actual day
// count. Pure frontend addition, no backend change — the day count is
// computed client-side from the invoice's existing dueDate.

let createdCustomerId: string | undefined

test.afterEach(async ({ page }) => {
  if (createdCustomerId) {
    await page.request.delete(`/api/crm/customers/${createdCustomerId}`)
    createdCustomerId = undefined
  }
})

test('AR Invoice list and detail show "X days overdue" next to the OVERDUE badge', async ({
  page,
}) => {
  const customerName = `E2E AR Days Overdue ${Date.now()}`
  const customerRes = await page.request.post('/api/crm/customers', {
    data: { name: customerName, customerType: 'individual', phone: '09170006611' },
  })
  const customer = await customerRes.json()
  createdCustomerId = customer.id

  const daysOverdue = 20
  const dueDate = new Date(Date.now() - daysOverdue * 86400000)
  const invoiceRes = await page.request.post('/api/ar-invoices', {
    data: {
      customerId: customer.id,
      invoiceDate: new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10),
      dueDate: dueDate.toISOString().slice(0, 10),
      description: 'E2E days-overdue fixture',
      subtotal: 500,
      taxAmount: 0,
    },
  })
  const invoice = await invoiceRes.json()
  await page.request.post(`/api/ar-invoices/${invoice.id}/send`)

  // ─── List ────────────────────────────────────────────────────────────
  await gotoReady(page, `/accounting/ar-invoices?customerId=${customer.id}`)
  const row = page.locator('table tbody tr', { has: page.getByText(invoice.invoiceNumber) })
  await expect(row).toBeVisible({ timeout: 10_000 })
  await expect(row.getByText('OVERDUE', { exact: true })).toBeVisible()
  // Allow a 1-day slack for how long the test itself takes to run.
  await expect(row.getByText(/(19|20) days overdue/)).toBeVisible()

  // ─── Detail ──────────────────────────────────────────────────────────
  await gotoReady(page, `/accounting/ar-invoices/${invoice.id}`)
  await expect(page.getByRole('heading', { name: invoice.invoiceNumber })).toBeVisible({
    timeout: 10_000,
  })
  await expect(page.getByText('OVERDUE', { exact: true })).toBeVisible()
  await expect(page.getByText(/(19|20) days overdue/)).toBeVisible()
})
