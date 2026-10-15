/**
 * Record Payment — the Deductions section.
 *
 * The client asked for a section below the payment on Record Payment to hold
 * money back from the supplier: each deduction names a Chart of Accounts
 * account, a supplier and a description. The invoices are still settled in
 * full; the cash that leaves is smaller, and each deduction is credited to the
 * account picked for it.
 *
 * Covers the UI contract only — the entry it posts (Dr AP in full, Cr bank for
 * the net, Cr each deduction account), the validation around it and the amend
 * path are proven in backend/src/accounting/ap-bills/ap-disbursement-deductions.spec.ts
 * and ap-bills-amend-paid-voucher.spec.ts.
 *
 * Self-cleaning: the form is never submitted successfully, so nothing is posted
 * against seeded data.
 */

import { test, expect, type Page } from '@playwright/test'
import { gotoReady } from './utils'

/** Opens Record Payment from the AP Invoices list with the first payable
 * invoice ticked — or skips when the environment has none. */
async function openWithAnInvoice(page: Page) {
  await gotoReady(page, '/accounting/ap-bills')
  const boxes = page.locator('tbody input[type="checkbox"]:not([disabled])')
  // The list loads after the page does — an empty count straight away says
  // nothing about the environment.
  await boxes
    .first()
    .waitFor({ timeout: 10_000 })
    .catch(() => {})
  if ((await boxes.count()) === 0) {
    test.skip(true, 'No payable invoices in this environment')
  }
  await boxes.first().check()
  await page.getByRole('button', { name: /create voucher/i }).click()
  await expect(page).toHaveURL(/\/accounting\/ap-bills\/payments\/new\?.*bills=/)
  await expect(page.getByLabel('Voucher number (generated)')).toBeVisible()
}

test.describe('Record Payment — Deductions', () => {
  test('the Deductions section sits below the payment methods and starts empty', async ({
    page,
  }) => {
    await openWithAnInvoice(page)

    const paidFrom = page.getByText('Paid from *')
    const deductions = page.getByText('Deductions', { exact: true })
    await expect(paidFrom).toBeVisible()
    await expect(deductions).toBeVisible()
    await expect(page.getByRole('button', { name: /add deduction/i })).toBeVisible()
    await expect(page.getByLabel('Chart of accounts for deduction 1')).toHaveCount(0)

    // Below, not beside: the section follows Paid from on the page.
    const paidY = (await paidFrom.boundingBox())!.y
    const deductionsY = (await deductions.boundingBox())!.y
    expect(deductionsY).toBeGreaterThan(paidY)
  })

  test('a deduction row asks for an account, a supplier, a description and an amount', async ({
    page,
  }) => {
    await openWithAnInvoice(page)
    await page.getByRole('button', { name: /add deduction/i }).click()

    await expect(page.getByLabel('Chart of accounts for deduction 1')).toBeVisible()
    await expect(page.getByLabel('Supplier for deduction 1')).toBeVisible()
    await expect(page.getByLabel('Description for deduction 1')).toBeVisible()
    await expect(page.getByLabel('Amount for deduction 1')).toBeVisible()

    // The supplier is the payee until someone says otherwise.
    await expect(page.getByLabel('Supplier for deduction 1')).not.toHaveValue('')

    await page.getByRole('button', { name: /remove deduction 1/i }).click()
    await expect(page.getByLabel('Amount for deduction 1')).toHaveCount(0)
  })

  test('a header account is not offered — only accounts a payment can post to', async ({
    page,
  }) => {
    await openWithAnInvoice(page)
    await page.getByRole('button', { name: /add deduction/i }).click()

    const account = page.getByLabel('Chart of accounts for deduction 1')
    await account.click()
    // A real account is offered, so the absence below means something.
    await account.fill('1-01-330')
    await expect(
      page.getByRole('button', { name: /1-01-330 — Advances to Suppliers/ })
    ).toBeVisible()
    // 1-01-300 is the "Prepayments, Advances and Other Current Assets" header.
    await account.fill('1-01-300')
    await expect(page.getByText(/No accounts match/)).toBeVisible()
    await expect(page.getByRole('button', { name: /1-01-300/ })).toHaveCount(0)
  })

  test('the net amount and the paid-from figure follow the deductions', async ({ page }) => {
    await openWithAnInvoice(page)

    const paid = page.getByLabel('Amount for payment method 1')
    const before = Number(await paid.inputValue())
    expect(before).toBeGreaterThan(1)

    await page.getByRole('button', { name: /add deduction/i }).click()
    await page.getByLabel('Amount for deduction 1').fill('1')

    // The invoice is still settled in full — the cheque is what shrinks.
    await expect(paid).toHaveValue((before - 1).toFixed(2))
    await expect(page.getByText(/Less: deductions/)).toBeVisible()
    await expect(page.getByText(/Net amount/)).toBeVisible()
  })

  test('an amount with no account is refused before anything is posted', async ({ page }) => {
    await openWithAnInvoice(page)
    await page.getByRole('button', { name: /add deduction/i }).click()
    await page.getByLabel('Amount for deduction 1').fill('1')

    await page.getByRole('button', { name: /^create voucher$/i }).click()
    await expect(page.getByText(/Pick the Chart of Accounts account for deduction 1/)).toBeVisible()
    // Still on the form: nothing was created.
    await expect(page).toHaveURL(/\/payments\/new/)
  })
})
