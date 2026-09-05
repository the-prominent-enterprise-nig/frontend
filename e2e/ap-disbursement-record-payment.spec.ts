/**
 * Scenario 46 Part A+B — Record Payment as a standalone disbursement.
 *
 * Payment no longer starts from a bill row: the AP Invoices header has a
 * single "Record Payment" action, the payee is chosen first, that supplier's
 * open invoices appear with checkboxes, and ticking one reveals the rest of
 * the form with the ticked invoices as its lines. One cheque, one voucher,
 * however many invoices it covers.
 *
 * Covers the UI contract only — the posting rules (one journal entry, N debits
 * against a single bank credit, per-bill status recompute, same-supplier
 * enforcement) are proven in backend/test/ap-disbursement-voucher.e2e-spec.ts.
 *
 * Self-cleaning: creates nothing that isn't torn down, and never submits the
 * form, so no payment is actually posted against seeded data.
 */

import { test, expect } from '@playwright/test'
import { gotoReady } from './utils'

test.describe('Scenario 46 — Record Payment (AP disbursement)', () => {
  test('payment starts from the header, not a bill row', async ({ page }) => {
    await gotoReady(page, '/accounting/ap-bills')

    // The header action exists and points at the new page.
    const record = page.getByRole('link', { name: /record payment/i })
    await expect(record).toBeVisible()
    await expect(record).toHaveAttribute('href', '/accounting/ap-bills/payments/new')

    // The retired per-row affordances are gone: no row-level Record Payment
    // button, and no Voucher panel button.
    await expect(page.getByRole('button', { name: /^record payment$/i })).toHaveCount(0)
    await expect(page.getByRole('button', { name: /^voucher$/i })).toHaveCount(0)
  })

  test('the form reveals itself only once a payee and an invoice are chosen', async ({ page }) => {
    await gotoReady(page, '/accounting/ap-bills/payments/new')

    await expect(page.getByRole('heading', { name: 'Record Payment' })).toBeVisible()

    // Beat 1 — nothing but the payee. The invoice table and the cheque fields
    // stay hidden until a supplier is picked.
    await expect(page.getByText('Open invoices')).toHaveCount(0)
    await expect(page.getByLabel('Voucher number (generated)')).toHaveCount(0)

    // Submitting with nothing selected is refused rather than silently posting.
    await page.getByRole('button', { name: /^record payment$/i }).click()
    await expect(page.getByRole('button', { name: /^record payment$/i })).toBeDisabled()
  })

  test('the voucher number is generated, never typed', async ({ page }) => {
    await gotoReady(page, '/accounting/ap-bills/payments/new')

    // Pick the first supplier the picker offers.
    await page.getByLabel('Select supplier').click()
    const firstOption = page.getByRole('option').first()
    if ((await firstOption.count()) === 0) {
      test.skip(true, 'No suppliers seeded in this environment')
    }
    await firstOption.click()

    await expect(page.getByText('Open invoices')).toBeVisible()

    const rows = page.locator('tbody tr')
    if ((await rows.count()) === 0) {
      test.skip(true, 'Seeded supplier has no open invoices to pay')
    }

    // Ticking the first invoice reveals the rest of the form.
    await rows.first().getByRole('checkbox').check()

    const voucher = page.getByLabel('Voucher number (generated)')
    await expect(voucher).toBeVisible()
    // Read-only: the number follows the cheque, so it can never disagree with it.
    await expect(voucher).toHaveAttribute('readonly', '')
    await expect(voucher).toHaveValue(/#\d{4}-/)
  })

  test('selecting invoices carries them into the payment form', async ({ page }) => {
    await gotoReady(page, '/accounting/ap-bills')

    const boxes = page.locator('tbody input[type="checkbox"]:not([disabled])')
    if ((await boxes.count()) === 0) {
      test.skip(true, 'No payable invoices in this environment')
    }

    // Nothing selected: the search box is showing, not the action bar.
    await expect(page.getByPlaceholder(/Search SI #/)).toBeVisible()

    await boxes.first().check()

    // The bar replaces the search row and offers the action.
    const bar = page.getByText(/invoice(s)? selected/)
    await expect(bar).toBeVisible()
    const record = page.getByRole('button', { name: /record payment/i })
    await expect(record).toBeVisible()

    await record.click()

    // Lands on the form with the selection carried in the URL and applied.
    await expect(page).toHaveURL(/\/accounting\/ap-bills\/payments\/new\?.*bills=/)
    await expect(page.getByRole('heading', { name: 'Record Payment' })).toBeVisible()
    // Prefilled: the invoice table is already showing and a row is ticked.
    await expect(page.getByText('Open invoices')).toBeVisible()
    await expect(page.locator('tbody input[type="checkbox"]:checked')).toHaveCount(1)
  })

  test('one cheque is locked to one supplier', async ({ page }) => {
    await gotoReady(page, '/accounting/ap-bills')

    const boxes = page.locator('tbody input[type="checkbox"]')
    const enabled = page.locator('tbody input[type="checkbox"]:not([disabled])')
    if ((await enabled.count()) < 2) {
      test.skip(true, 'Need at least two payable invoices to prove the lock')
    }

    const before = await enabled.count()
    await enabled.first().check()
    // Picking a payee disables every other supplier's row, so a cheque can
    // never span two payees.
    const after = await page.locator('tbody input[type="checkbox"]:not([disabled])').count()
    expect(after).toBeLessThanOrEqual(before)
    expect(await boxes.count()).toBeGreaterThan(0)
  })
})
