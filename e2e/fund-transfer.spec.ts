import { test, expect } from '@playwright/test'
import { gotoReady } from './utils'

// Scenario 40 Part 3 / Scenario 61 — Inter-Account Transfer (formerly Fund
// Transfer). A real inter-account transfer (e.g. funding a Petty Cash Fund
// from the main operating account). No delete/reverse endpoint exists for a
// transfer (same tradeoff as this app's other non-reversible actions, e.g.
// adjusting entries) — this spec doesn't attempt cleanup, same
// accepted-permanent-fixture precedent as credit-application-intake.spec.ts.
test.describe('Accounting — Inter-Account Transfer (Scenario 40 Part 3 / Scenario 61)', () => {
  test('transfers money, shows the voucher pop-up, lists it in history, and edits only clearing date + reference', async ({
    page,
  }) => {
    await gotoReady(page, '/accounting/bank-accounts')
    await expect(page.locator('tbody')).not.toContainText('Loading...', { timeout: 10_000 })

    const pettyCashRow = page.locator('tbody tr', { hasText: 'Petty Cash Fund' }).first()
    await expect(pettyCashRow).toBeVisible({ timeout: 10_000 })
    const pettyCashName = (await pettyCashRow.locator('td').first().textContent())?.trim()
    const balanceBeforeText = (await pettyCashRow.locator('td').nth(5).textContent())?.trim() ?? ''
    const balanceBefore = Number(balanceBeforeText.replace(/[^\d.-]/g, ''))
    expect(pettyCashName).toBeTruthy()
    expect(Number.isFinite(balanceBefore)).toBe(true)

    await gotoReady(page, '/accounting/fund-transfers')
    await expect(page.getByRole('heading', { name: 'Inter-Account Transfers' })).toBeVisible({
      timeout: 10_000,
    })
    await page.getByRole('link', { name: 'New Transfer' }).click()
    await page.waitForURL('**/accounting/fund-transfers/new')
    await expect(page.getByRole('heading', { name: 'Inter-Account Transfer' })).toBeVisible()

    const sourceSelect = page.getByLabel('From (source) *')
    await sourceSelect
      .locator('option', { hasText: '(Operating)' })
      .first()
      .waitFor({ state: 'attached', timeout: 5_000 })
    const sourceOptionValue = await sourceSelect
      .locator('option', { hasText: '(Operating)' })
      .first()
      .getAttribute('value')
    expect(sourceOptionValue).toBeTruthy()
    await sourceSelect.selectOption(sourceOptionValue as string)

    const destinationSelect = page.getByLabel('To (destination) *')
    const destinationOptionValue = await destinationSelect
      .locator('option', { hasText: pettyCashName as string })
      .first()
      .getAttribute('value')
    expect(destinationOptionValue).toBeTruthy()
    await destinationSelect.selectOption(destinationOptionValue as string)

    await page.getByLabel('Amount *').fill('250')
    await page.getByRole('button', { name: 'Transfer' }).click()

    // Pop-up with the printable voucher instead of a bounce to Bank Accounts.
    await expect(page.getByRole('heading', { name: 'Transfer recorded' })).toBeVisible({
      timeout: 10_000,
    })
    await expect(page.getByRole('button', { name: 'Print Voucher' })).toBeVisible()
    const voucherNumber = (await page.getByText(/^IAT-\d{8}-\d{4}$/).textContent())?.trim()
    expect(voucherNumber).toBeTruthy()

    await page.getByRole('link', { name: 'View transfer' }).click()
    await page.waitForURL(/\/accounting\/fund-transfers\/[0-9a-f-]{36}$/)
    await expect(page.getByText('Not yet cleared')).toBeVisible()

    // Only clearing date and reference are editable.
    await page.getByRole('button', { name: 'Edit' }).click()
    const form = page.locator('form')
    await expect(form.locator('input')).toHaveCount(2)
    const today = new Date().toISOString().slice(0, 10)
    await page.getByLabel('Clearing Date').fill(today)
    await page.getByLabel('Reference').fill('E2E-IAT-REF')
    await page.getByRole('button', { name: 'Save' }).click()
    await expect(page.getByText('E2E-IAT-REF')).toBeVisible({ timeout: 10_000 })
    await expect(page.getByText('Not yet cleared')).toHaveCount(0)

    // History shows it.
    await gotoReady(page, '/accounting/fund-transfers')
    await page.getByPlaceholder('Voucher #, reference, account…').fill(voucherNumber as string)
    const historyRow = page.locator('tbody tr', { hasText: voucherNumber as string })
    await expect(historyRow).toBeVisible({ timeout: 10_000 })
    await expect(historyRow).toContainText('E2E-IAT-REF')
    await expect(historyRow).toContainText(today)

    await gotoReady(page, '/accounting/bank-accounts')
    await expect(page.locator('tbody')).not.toContainText('Loading...', { timeout: 10_000 })
    const pettyCashRowAfter = page.locator('tbody tr', { hasText: pettyCashName as string }).first()
    await expect
      .poll(
        async () => {
          const text = (await pettyCashRowAfter.locator('td').nth(5).textContent())?.trim() ?? ''
          return Number(text.replace(/[^\d.-]/g, ''))
        },
        { timeout: 10_000 }
      )
      .toBeCloseTo(balanceBefore + 250, 2)
  })
})
