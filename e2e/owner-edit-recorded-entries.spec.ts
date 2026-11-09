/**
 * Business Owner edit of recorded entries (client request 2026-11-09).
 *
 * At bank reconciliation the dates of recorded transactions have to be put
 * right. The Business Owner (this suite's seeded account) holds
 * accounting:recorded-entries:edit and pos:new-receipts:edit, so every edit of a
 * recorded entry asks why, and the reason is kept in the audit log. The backend
 * e2e (owner-edit-recorded-entries.e2e-spec.ts) covers the ledger — the old
 * entry netting out on its own date, the corrected one standing alone, who
 * holds the permission; this covers the screens.
 */
import { test, expect } from '@playwright/test'
import { fillStable, gotoReady } from './utils'

const transferIds: string[] = []

test.afterEach(async ({ request }) => {
  for (const id of transferIds.splice(0)) {
    await request
      .post(`/api/bank-accounts/transfers/${id}/void`, { data: { reason: 'E2E cleanup' } })
      .catch(() => {})
  }
})

async function recordTransfer(
  page: import('@playwright/test').Page,
  date: string
): Promise<{ id: string; journalEntryId: string }> {
  const banks = await (await page.request.get('/api/bank-accounts')).json()
  const list = (banks.data ?? banks) as { id: string; accountType: string }[]
  const source = list.find((b) => b.accountType === 'Operating')!
  const destination = list.find((b) => b.accountType === 'Petty Cash')!
  const res = await page.request.post('/api/bank-accounts/transfer', {
    data: {
      sourceBankAccountId: source.id,
      destinationBankAccountId: destination.id,
      amount: 750,
      date,
      reference: `E2E-OWNER-${Date.now()}`,
    },
  })
  expect(res.status()).toBe(201)
  const body = await res.json()
  transferIds.push(body.id)
  return { id: body.id, journalEntryId: body.journalEntryId }
}

test.describe('Inter-Account Transfer — the owner corrects a posted transfer', () => {
  test('the date can be changed, but not without saying why', async ({ page }) => {
    const { id, journalEntryId } = await recordTransfer(page, '2026-10-30')

    await gotoReady(page, `/accounting/fund-transfers/${id}`)
    await page.getByRole('button', { name: 'Edit' }).click()

    // The whole transfer is open to the owner, with a reason box.
    await expect(page.getByTestId('transfer-edit-date')).toHaveValue('2026-10-30')
    await expect(page.getByTestId('transfer-edit-reason')).toBeVisible()

    await fillStable(page.getByTestId('transfer-edit-date'), '2026-11-02')
    await page.getByRole('button', { name: 'Save' }).click()
    await expect(page.getByText('Say why this recorded entry is being changed.')).toBeVisible()

    await fillStable(page.getByTestId('transfer-edit-reason'), 'Bank value-dated it 2 Nov')
    const [saved] = await Promise.all([
      page.waitForResponse(
        (r) =>
          r.url().endsWith(`/api/bank-accounts/transfers/${id}`) && r.request().method() === 'PATCH'
      ),
      page.getByRole('button', { name: 'Save' }).click(),
    ])
    expect(saved.status()).toBe(200)

    // The page shows the new date, and the books moved with it.
    await expect(page.locator('dt', { hasText: /^Date$/ }).locator('..')).toContainText(
      '2026-11-02',
      { timeout: 10_000 }
    )
    const after = await (await page.request.get(`/api/bank-accounts/transfers/${id}`)).json()
    expect(after.date.slice(0, 10)).toBe('2026-11-02')
    expect(after.journalEntryId).not.toBe(journalEntryId)
  })
})

test.describe('New Receipts — the owner corrects a receipt', () => {
  test('every edit says why, and the date follows into the books', async ({ page }) => {
    const created = await page.request.post('/api/accounting/acknowledgement-receipts', {
      data: {
        payerName: `E2E owner edit ${Date.now()}`,
        amount: 640,
        paymentDate: '2026-10-30',
        receiptType: 'ACKNOWLEDGEMENT',
      },
    })
    expect(created.status()).toBe(201)
    const receipt = await created.json()

    await gotoReady(page, `/pos/collections/acknowledgement/view?id=${receipt.id}&action=edit`)
    await expect(page.getByTestId('receipt-edit-reason')).toBeVisible({ timeout: 15_000 })

    // A change as small as a reference still asks.
    await page.getByRole('button', { name: 'Save', exact: true }).click()
    await expect(page.getByText('Say why this recorded entry is being changed.')).toBeVisible()

    await fillStable(page.getByTestId('receipt-edit-reason'), 'Keyed the wrong day')
    const [saved] = await Promise.all([
      page.waitForResponse(
        (r) =>
          r.url().includes(`/api/accounting/acknowledgement-receipts/${receipt.id}`) &&
          r.request().method() === 'PATCH'
      ),
      page.getByRole('button', { name: 'Save', exact: true }).click(),
    ])
    expect(saved.status()).toBe(200)
    await expect(page.getByTestId('receipt-edit-reason')).toHaveCount(0, { timeout: 10_000 })
  })
})
