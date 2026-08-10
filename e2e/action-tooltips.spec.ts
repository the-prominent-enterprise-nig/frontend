import { test, expect } from '@playwright/test'
import { gotoReady } from './utils'

// New src/components/ui/Tooltip.tsx — no Tooltip component existed before
// (docs/design-system.md flagged this as a known gap for icon-only
// buttons). Wired onto AR Invoices' row actions and the Credit/Debit Memos
// list pages' Void action, replacing their native `title` attribute.

let createdCustomerId: string | undefined

test.afterEach(async ({ page }) => {
  if (createdCustomerId) {
    await page.request.delete(`/api/crm/customers/${createdCustomerId}`)
    createdCustomerId = undefined
  }
})

test('a styled tooltip appears on hover over an AR Invoices row action', async ({ page }) => {
  const customerRes = await page.request.post('/api/crm/customers', {
    data: { name: `E2E Tooltip ${Date.now()}`, customerType: 'individual', phone: '09170007711' },
  })
  const customer = await customerRes.json()
  createdCustomerId = customer.id

  const invoiceRes = await page.request.post('/api/ar-invoices', {
    data: {
      customerId: customer.id,
      invoiceDate: new Date().toISOString().slice(0, 10),
      dueDate: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
      description: 'E2E tooltip fixture',
      subtotal: 500,
      taxAmount: 0,
    },
  })
  const invoice = await invoiceRes.json()
  await page.request.post(`/api/ar-invoices/${invoice.id}/send`)

  await gotoReady(page, `/accounting/ar-invoices?customerId=${customer.id}`)
  const row = page.locator('table tbody tr', { has: page.getByText(invoice.invoiceNumber) })
  await expect(row).toBeVisible({ timeout: 10_000 })

  const debitBtn = row.getByLabel('Issue debit memo')
  const tooltip = page.getByRole('tooltip', { name: 'Issue debit memo' })
  // The tooltip element exists in the DOM at all times (it's shown/hidden
  // via CSS opacity, not conditional rendering) and still occupies a
  // non-zero layout box, so Playwright's toBeVisible() can't tell hidden
  // from shown here — assert the actual opacity instead.
  await expect(tooltip).toHaveCSS('opacity', '0')
  await debitBtn.hover()
  await expect(tooltip).toHaveCSS('opacity', '1')
})
