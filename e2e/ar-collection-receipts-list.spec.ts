import { test, expect } from '@playwright/test'
import { gotoReady, fillStable, clickStable } from './utils'

// Scenario 44 Part 1 — the top-level /accounting/ar-invoices landing page
// (no customerId filter) is now a flat, cross-customer Receipts register
// (one row per ARPayment), replacing the old customer-rollup table.
// Customer-filtered views (?customerId=... or the dedicated
// /customer/[id] route) are unchanged — covered by this file's sibling
// specs, not re-tested here.

let createdCustomerId: string | undefined

test.afterEach(async ({ page }) => {
  if (createdCustomerId) {
    await page.request.delete(`/api/crm/customers/${createdCustomerId}`)
    createdCustomerId = undefined
  }
})

test('the landing page shows the Receipts register, not the old customer-rollup table', async ({
  page,
}) => {
  const customerName = `E2E Receipts Register ${Date.now()}`
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
      description: 'E2E receipts register fixture',
      subtotal: 1000,
      taxAmount: 0,
    },
  })
  const invoice = await invoiceRes.json()
  await page.request.post(`/api/ar-invoices/${invoice.id}/send`)

  const reference = `CR#E2E-${Date.now()}`
  const payRes = await page.request.post(`/api/ar-invoices/${invoice.id}/payments`, {
    data: { amount: 400, paymentDate: new Date().toISOString(), reference },
  })
  expect(payRes.ok()).toBeTruthy()

  await gotoReady(page, '/accounting/ar-invoices')

  // New Receipts columns, not the old Invoice #/Total/Paid/Outstanding rollup.
  await expect(page.getByRole('columnheader', { name: 'Reference' })).toBeVisible()
  await expect(page.getByRole('columnheader', { name: 'Received in' })).toBeVisible()
  await expect(page.getByRole('columnheader', { name: 'Accounts' })).toBeVisible()
  await expect(page.getByRole('columnheader', { name: 'Invoice #' })).not.toBeVisible()

  const row = page.locator('table tbody tr', { hasText: reference })
  await expect(row).toBeVisible({ timeout: 10_000 })
  await expect(row.getByText(customerName)).toBeVisible()
  await expect(row.getByText('₱400.00')).toBeVisible()

  // View opens the printed Collection Receipt document (Part 2) — same
  // letterhead family (logo top-right, title left) every sibling document
  // uses. Edit still opens the parent invoice, since Part 3's real inline
  // editing isn't built yet.
  const [popup] = await Promise.all([
    page.waitForEvent('popup'),
    row.getByRole('button', { name: 'View' }).click(),
  ])
  await popup.waitForLoadState('domcontentloaded')
  await expect(popup.locator('h1')).toHaveText('Collection Receipt')
  await expect(popup.getByText(reference, { exact: false })).toBeVisible()
  await expect(popup.getByText(customerName, { exact: false }).first()).toBeVisible()
  await expect(popup.getByText(invoice.invoiceNumber, { exact: false })).toBeVisible()
  await expect(popup.getByText('E2E receipts register fixture', { exact: false })).toBeVisible()
  await popup.close()

  await row.getByRole('button', { name: 'Edit' }).click()
  await expect(page).toHaveURL(`/accounting/ar-invoices/${invoice.id}`)
})

test('"New Receipt" opens a real dedicated page, not a modal', async ({ page }) => {
  await gotoReady(page, '/accounting/ar-invoices')
  await expect(page.getByRole('button', { name: 'New Invoice' })).not.toBeVisible()

  // clickStable, not a plain click — this button's onClick attaches during
  // hydration same as everything else on this page, and the very first hit
  // on a not-yet-compiled dev-mode route makes that race far more likely.
  await clickStable(
    page.getByRole('button', { name: 'New Receipt' }),
    page.getByRole('heading', { name: 'New Receipt' }),
    { timeout: 20_000 }
  )
  await expect(page).toHaveURL('/accounting/ar-invoices/receipts/new')
  // A real page — its own URL, no dialog overlay left over from the list.
  await expect(page.locator('.fixed.inset-0.z-50')).not.toBeVisible()
})

test("New Receipt records a payment against a customer's invoice without going through their own invoice list first", async ({
  page,
}) => {
  const customerName = `E2E New Receipt ${Date.now()}`
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
      subtotal: 750,
      taxAmount: 0,
    },
  })
  const invoice = await invoiceRes.json()
  await page.request.post(`/api/ar-invoices/${invoice.id}/send`)

  // Navigated to directly (not via clicking "New Receipt" — that button's
  // own behavior has its own, separate test above) since this test is about
  // what the page itself does, not how you get there.
  await gotoReady(page, '/accounting/ar-invoices/receipts/new')
  await expect(page.getByRole('heading', { name: 'New Receipt' })).toBeVisible()

  const customerInput = page.getByPlaceholder('Search by name or phone…')
  // Scoped to the button role, not a bare getByText — this same customer
  // name also ends up in a "Change" button's accessible name once picked
  // (Field's wrapping <label> bleeds its text into every control inside),
  // so a page-wide text locator can become ambiguous later in this test.
  const resultOption = page.getByRole('button', { name: new RegExp(customerName) })
  await expect(async () => {
    await fillStable(customerInput, customerName)
    await expect(resultOption).toBeVisible({ timeout: 3_000 })
  }).toPass({ timeout: 15_000 })
  await resultOption.click()

  // Never routed through /accounting/ar-invoices/customer/[id] — the
  // Invoice dropdown populates right here, in the same one-form layout.
  await expect(page).toHaveURL('/accounting/ar-invoices/receipts/new')
  const invoiceSelect = page.getByLabel('Invoice *')
  await expect(invoiceSelect.locator(`option[value="${invoice.id}"]`)).toHaveCount(1, {
    timeout: 20_000,
  })
  await invoiceSelect.selectOption(invoice.id)

  // Cash Received defaults to the invoice's outstanding balance once picked.
  await expect(page.getByLabel('Cash Received *')).toHaveValue('750')

  const reference = `CR#E2E-NEW-${Date.now()}`
  await fillStable(page.getByLabel('Reference'), reference)
  await page.getByRole('button', { name: 'Record Receipt' }).click()

  await expect(page).toHaveURL('/accounting/ar-invoices')
  const row = page.locator('table tbody tr', { hasText: reference })
  await expect(row).toBeVisible({ timeout: 10_000 })
  await expect(row.getByText('₱750.00')).toBeVisible()
})

test('searching the landing page filters receipts by reference', async ({ page }) => {
  const customerName = `E2E Receipts Search ${Date.now()}`
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
      subtotal: 250,
      taxAmount: 0,
    },
  })
  const invoice = await invoiceRes.json()
  await page.request.post(`/api/ar-invoices/${invoice.id}/send`)

  const reference = `CR#E2E-SEARCH-${Date.now()}`
  await page.request.post(`/api/ar-invoices/${invoice.id}/payments`, {
    data: { amount: 250, paymentDate: new Date().toISOString(), reference },
  })

  await gotoReady(page, '/accounting/ar-invoices')
  const searchInput = page.getByPlaceholder('Search receipts by reference or customer…')
  await fillStable(searchInput, reference)

  const row = page.locator('table tbody tr', { hasText: reference })
  await expect(row).toBeVisible({ timeout: 10_000 })
  const rowCount = await page.locator('table tbody tr').count()
  expect(rowCount).toBe(1)
})
