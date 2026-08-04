import { test, expect } from '@playwright/test'
import { gotoReady, fillStable } from './utils'

// Scenario 10 (Purchasing & AP) Part 4 — voucher creation + two-step
// (online, then onsite) approval. createVoucher() has no status
// requirement, so this test raises and fully approves a voucher on a
// DRAFT bill — keeping it deletable at the end (a RECEIVED/PAID bill can't
// be removed via the UI, so the payment-blocked-until-approved gate itself
// is covered by the backend e2e suite instead, same tradeoff already made
// by the Part 2 3-way-match frontend spec). Self-cleaning: deletes the
// DRAFT bill it creates.
test.describe('Accounting — AP Bills voucher approval', () => {
  test('raises a voucher and walks it through online → onsite approval', async ({ page }) => {
    await gotoReady(page, '/accounting/ap-bills')

    // The list sorts by billDate desc — a date-only field every bill
    // created "today" shares, so ties sort in an unspecified order and
    // "first row after creation" is not reliably the one just created.
    // Diff the billNumber set before/after instead, which is robust
    // regardless of sort order.
    await expect(page.locator('tbody')).not.toContainText('Loading...', { timeout: 10_000 })
    const billNumbersBefore = new Set(
      await page.locator('tbody tr td:first-child').allTextContents()
    )

    await page.getByRole('button', { name: 'New Bill' }).click()
    await expect(page.getByRole('heading', { name: 'New Bill' })).toBeVisible({ timeout: 10_000 })

    const vendorSelect = page.locator('select').first()
    await vendorSelect.selectOption({ index: 1 })
    const subtotalInput = page.locator('input[type="number"]').first()
    await subtotalInput.fill('1000')
    const marker = `E2E-AP-Voucher-${Date.now()}`
    const descriptionInput = page.locator('label:has-text("Description") input')
    await descriptionInput.fill(marker)

    await page.getByRole('button', { name: 'Save' }).click()
    await expect(page.getByRole('heading', { name: 'New Bill' })).toHaveCount(0, {
      timeout: 10_000,
    })

    // The list reload triggered by onSaved() briefly shows a "Loading..."
    // placeholder row — wait it out, then find the one billNumber that
    // wasn't in the list before creation.
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

    // Open the voucher panel and raise a voucher. Scope assertions to the
    // modal itself — the table row's own Voucher badge updates in the
    // background as onSaved() reloads the list, so unscoped text matches
    // hit both the modal and the row once approved.
    await row.locator('button[title="Voucher"]').click()
    const panel = page.locator('div.fixed.inset-0').filter({
      has: page.getByRole('heading', { name: `Voucher — ${billNumber}` }),
    })
    await expect(panel).toBeVisible({ timeout: 10_000 })
    const voucherNumber = `V-${Date.now()}`
    await fillStable(page.getByPlaceholder('e.g. V-2026-0001'), voucherNumber)
    await page.getByRole('button', { name: 'Raise Voucher' }).click()
    await expect(panel.getByText('Pending Online Approval')).toBeVisible({ timeout: 10_000 })

    // Online approval moves it to pending onsite.
    await page.getByRole('button', { name: 'Approve Online' }).click()
    await expect(panel.getByText('Pending Onsite Approval')).toBeVisible({ timeout: 10_000 })

    // Onsite approval is the final step.
    await page.getByRole('button', { name: 'Approve Onsite (Final)' }).click()
    await expect(panel.getByText('Approved', { exact: true })).toBeVisible({ timeout: 10_000 })

    // Close the panel — its heading disappearing confirms the close click landed.
    await page.locator('div.fixed.inset-0 button:has(svg.lucide-x)').first().click()
    await expect(page.getByRole('heading', { name: `Voucher — ${billNumber}` })).toHaveCount(0, {
      timeout: 10_000,
    })

    // The row's Voucher column badge now reflects Approved too.
    await expect(row).toContainText('Approved', { timeout: 10_000 })

    // Cleanup — still DRAFT, so it's deletable.
    page.once('dialog', (dialog) => dialog.accept())
    await row.locator('button.text-red-600').click()
    if (billNumber) {
      await expect(page.locator('tbody')).not.toContainText(billNumber, { timeout: 10_000 })
    }
  })
})
