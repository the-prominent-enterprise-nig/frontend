import { test, expect } from '@playwright/test'
import { gotoReady, fillStable } from './utils'

// Scenario 44 Part 3 — the Receipts register's "Edit" action opens a real
// in-place edit dialog (reference/notes), with a "Cancel this receipt" path
// for anything that would otherwise change the posted amount/account
// (generalized from the pre-existing overpayment-only cancel).

let createdCustomerId: string | undefined

test.afterEach(async ({ page }) => {
  if (createdCustomerId) {
    await page.request.delete(`/api/crm/customers/${createdCustomerId}`)
    createdCustomerId = undefined
  }
})

async function createReceiptFixture(page: import('@playwright/test').Page, subtotal: number) {
  const customerName = `E2E Edit Receipt ${Date.now()}`
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
      subtotal,
      taxAmount: 0,
    },
  })
  const invoice = await invoiceRes.json()
  await page.request.post(`/api/ar-invoices/${invoice.id}/send`)

  const reference = `CR#E2E-EDIT-${Date.now()}`
  const payRes = await page.request.post(`/api/ar-invoices/${invoice.id}/payments`, {
    data: { amount: subtotal, paymentDate: new Date().toISOString(), reference },
  })
  const paymentId = (await payRes.json()).payment.id as string

  return { customerName, invoice, reference, paymentId }
}

test('Edit opens an in-place dialog and saves reference/notes without navigating away', async ({
  page,
}) => {
  const { reference } = await createReceiptFixture(page, 620)

  await gotoReady(page, '/accounting/ar-invoices')
  const row = page.locator('table tbody tr', { hasText: reference })
  await expect(row).toBeVisible({ timeout: 10_000 })
  await row.getByRole('button', { name: 'Edit' }).click()

  await expect(page.getByRole('heading', { name: 'Edit Receipt' })).toBeVisible()
  // Prefilled with the receipt's current reference, not blank.
  await expect(page.getByLabel('Reference')).toHaveValue(reference)

  const newReference = `CR#E2E-EDIT-FIXED-${Date.now()}`
  await fillStable(page.getByLabel('Reference'), newReference)
  await fillStable(page.getByLabel('Notes'), 'Corrected the OR number')
  await page.getByRole('button', { name: 'Save' }).click()

  await expect(page.getByRole('heading', { name: 'Edit Receipt' })).toBeHidden({ timeout: 10_000 })
  // Still on the same page — no navigation away for a metadata-only edit.
  await expect(page).toHaveURL('/accounting/ar-invoices')
  const updatedRow = page.locator('table tbody tr', { hasText: newReference })
  await expect(updatedRow).toBeVisible({ timeout: 10_000 })
  await expect(page.locator('table tbody tr', { hasText: reference })).toHaveCount(0)
})

// No seeded account can actually complete a "Manager/Owner PIN required"
// flow through the browser in this environment — confirmed against the DB:
// the only accounts with a cashierPin set (Cashier role) hold zero rows for
// the pos:transaction:override permission validateManagerByPinOnly
// requires. Pre-existing gap (predates this scenario, affects Void
// Invoice/Delete Invoice too, not just this dialog) — so this test covers
// the wiring actually verifiable here: the dialog opens, requires a PIN
// before submitting, and a wrong PIN surfaces an error rather than silently
// cancelling. The real cancel logic itself (JE reversal, status recompute)
// is fully covered by ar-collection-receipt-edit-cancel.e2e-spec.ts, which
// calls the service directly, bypassing this frontend-only PIN gate.
test('Cancel this receipt requires a Manager/Owner PIN before submitting', async ({ page }) => {
  const { reference } = await createReceiptFixture(page, 340)

  await gotoReady(page, '/accounting/ar-invoices')
  const row = page.locator('table tbody tr', { hasText: reference })
  await expect(row).toBeVisible({ timeout: 10_000 })
  await row.getByRole('button', { name: 'Edit' }).click()

  await expect(page.getByRole('heading', { name: 'Edit Receipt' })).toBeVisible()
  await page.getByRole('button', { name: 'Cancel this receipt' }).click()

  await expect(page.getByRole('heading', { name: 'Cancel Receipt' })).toBeVisible()
  const submitButton = page.getByRole('button', { name: 'Cancel Receipt', exact: true })
  await expect(submitButton).toBeDisabled()

  await fillStable(page.getByPlaceholder('••••'), '0000')
  await expect(submitButton).toBeEnabled()
  await submitButton.click()

  await expect(page.getByText(/invalid pin/i)).toBeVisible({ timeout: 10_000 })
  // Still there — a rejected PIN never cancelled it.
  await expect(row).toBeVisible()
})

// Cancelled via the API directly (not through the browser's PIN gate — see
// the test above for why) since this test is about the register's display
// once a receipt IS cancelled, not about how it gets there.
test('a cancelled receipt stays visible in the register, grayed out with a Voided badge, Edit disabled', async ({
  page,
}) => {
  const { reference, invoice, paymentId } = await createReceiptFixture(page, 410)

  const cancelRes = await page.request.post(
    `/api/ar-invoices/${invoice.id}/payments/${paymentId}/cancel`,
    { data: { reason: 'E2E — mis-entered amount' } }
  )
  expect(cancelRes.ok()).toBeTruthy()

  await gotoReady(page, '/accounting/ar-invoices')
  const row = page.locator('table tbody tr', { hasText: reference })
  await expect(row).toBeVisible({ timeout: 10_000 })
  await expect(row.getByText('Voided')).toBeVisible()
  await expect(row).toHaveClass(/opacity-50/)
  await expect(row.getByRole('button', { name: 'Edit' })).toBeDisabled()

  // View still works — the original document remains viewable for audit.
  const [popup] = await Promise.all([
    page.waitForEvent('popup'),
    row.getByRole('button', { name: 'View' }).click(),
  ])
  await popup.waitForLoadState('domcontentloaded')
  await expect(popup.locator('h1')).toHaveText('Collection Receipt')
  await popup.close()
})
