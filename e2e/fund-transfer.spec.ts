import { test, expect } from '@playwright/test'
import { gotoReady } from './utils'

// Scenario 40 Part 3 — Fund Transfer. A real inter-account transfer (e.g.
// funding a Petty Cash Fund from the main operating account), full page
// from the start per the same developer feedback that moved the Expense
// form off a modal. No delete/reverse endpoint exists for a transfer (same
// tradeoff as this app's other non-reversible actions, e.g. adjusting
// entries) — this spec doesn't attempt cleanup, same accepted-permanent-
// fixture precedent as credit-application-intake.spec.ts.
test.describe('Accounting — Fund Transfer (Scenario 40 Part 3)', () => {
  test('transfers money from an Operating account into a Petty Cash Fund and moves both balances', async ({
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

    await gotoReady(page, '/accounting/bank-reconciliation')
    await page.getByRole('link', { name: 'Fund Transfer' }).click()
    await page.waitForURL('**/accounting/bank-reconciliation/transfer')
    await expect(page.getByRole('heading', { name: 'Fund Transfer' })).toBeVisible({
      timeout: 10_000,
    })

    const sourceSelect = page.getByLabel('From (source) *')
    await sourceSelect
      .locator('option', { hasText: 'Operating' })
      .first()
      .waitFor({ state: 'attached', timeout: 5_000 })
    // selectOption with a label substring match on the first Operating account.
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
    await page.waitForURL('**/accounting/bank-reconciliation', { timeout: 10_000 })

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
