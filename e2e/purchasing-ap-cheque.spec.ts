import { test, expect } from '@playwright/test'
import { gotoReady, fillStable } from './utils'

// Scenario 10 (Purchasing & AP) Part 5 — cheque printing. Two tests:
//
// 1. The conditional Cheque Number field, checked against an existing
//    payable (RECEIVED/PARTIAL/OVERDUE) bill from shared dev data without
//    submitting anything — same non-destructive approach as the Part 2
//    3-way-match spec.
// 2. The actual print flow, which needs a bill with a real cheque payment
//    on it. Unlike the other AP-bills specs, this one is NOT self-cleaning:
//    once a bill is Received it can no longer be deleted via the UI (or the
//    backend — DELETE /ap-bills/:id requires DRAFT), so there is no way to
//    test an actual cheque payment without permanently adding one bill to
//    the shared dev DB. The bill is clearly marked (E2E-AP-Cheque-<ts>,
//    ₱1 subtotal) so it's easy to identify.
test.describe('Accounting — AP Bills cheque printing', () => {
  test('shows a required Cheque Number field only when Method is Check', async ({ page }) => {
    await gotoReady(page, '/accounting/ap-bills')
    await expect(page.locator('tbody')).not.toContainText('Loading...', { timeout: 10_000 })

    const payButton = page
      .locator('tbody tr button')
      .filter({ has: page.locator('svg.lucide-dollar-sign') })
      .first()
    test.skip((await payButton.count()) === 0, 'No payable bill in shared dev data to test against')
    await payButton.click()

    await expect(page.getByRole('heading', { name: 'Record Payment' })).toBeVisible({
      timeout: 10_000,
    })
    const chequeField = page.getByPlaceholder('e.g. 0001234')
    await expect(chequeField).toHaveCount(0)

    await page.getByLabel('Method').selectOption('check')
    await expect(chequeField).toBeVisible({ timeout: 5_000 })
    await expect(chequeField).toHaveAttribute('required', '')

    await page.getByLabel('Method').selectOption('')
    await expect(chequeField).toHaveCount(0)

    await page.getByRole('button', { name: 'Cancel' }).click()
  })

  test('records a check payment and prints the cheque document', async ({ page, context }) => {
    await gotoReady(page, '/accounting/ap-bills')
    await expect(page.locator('tbody')).not.toContainText('Loading...', { timeout: 10_000 })

    // Bill descriptions aren't shown in the table, and the list sorts by
    // billDate desc (an unspecified tiebreak among same-day bills) — diff
    // the billNumber set before/after instead, same technique as the Part 1
    // and Part 4 (voucher) specs.
    const billNumbersBefore = new Set(
      await page.locator('tbody tr td:first-child').allTextContents()
    )

    await page.getByRole('button', { name: 'New Bill' }).click()
    await expect(page.getByRole('heading', { name: 'New Bill' })).toBeVisible({ timeout: 10_000 })
    await page.locator('select').first().selectOption({ index: 1 })
    await page.locator('input[type="number"]').first().fill('1')
    const marker = `E2E-AP-Cheque-${Date.now()}`
    await fillStable(page.locator('label:has-text("Description") input'), marker)
    await page.getByRole('button', { name: 'Save' }).click()
    await expect(page.getByRole('heading', { name: 'New Bill' })).toHaveCount(0, {
      timeout: 10_000,
    })

    await expect(page.locator('tbody')).not.toContainText('Loading...', { timeout: 10_000 })
    await expect
      .poll(
        async () => {
          const current = await page.locator('tbody tr td:first-child').allTextContents()
          return current.filter((n) => !billNumbersBefore.has(n)).length
        },
        { timeout: 10_000 }
      )
      .toBeGreaterThan(0)
    const billNumbersAfter = await page.locator('tbody tr td:first-child').allTextContents()
    const billNumber = billNumbersAfter.find((n) => !billNumbersBefore.has(n))
    expect(billNumber).toBeTruthy()
    const row = page.locator('tbody tr', { hasText: billNumber as string })

    await row.locator('button[title="Receive"]').click()
    await expect(row.locator('button[title="Receive"]')).toHaveCount(0, { timeout: 10_000 })

    await row
      .locator('button')
      .filter({ has: page.locator('svg.lucide-dollar-sign') })
      .click()
    await expect(page.getByRole('heading', { name: 'Record Payment' })).toBeVisible({
      timeout: 10_000,
    })
    await page.getByLabel('Method').selectOption('check')
    const chequeNumber = `CHQ-${Date.now()}`
    await fillStable(page.getByPlaceholder('e.g. 0001234'), chequeNumber)
    await page.getByRole('button', { name: 'Record Payment' }).click()
    await expect(page.getByRole('heading', { name: 'Record Payment' })).toHaveCount(0, {
      timeout: 10_000,
    })

    await expect(page.locator('tbody')).not.toContainText('Loading...', { timeout: 10_000 })
    const printButton = row.locator('button[title="Print Cheque"]')
    await expect(printButton).toBeVisible({ timeout: 10_000 })

    const [popup] = await Promise.all([context.waitForEvent('page'), printButton.click()])
    await popup.waitForLoadState('domcontentloaded')
    await expect(popup.getByRole('heading', { name: 'Cheque Payment' })).toBeVisible({
      timeout: 10_000,
    })
    await expect(popup.getByText(chequeNumber).first()).toBeVisible()
  })
})
