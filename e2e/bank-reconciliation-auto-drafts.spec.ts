import { test, expect, type APIRequestContext } from '@playwright/test'
import { fillStable, gotoReady } from './utils'

// Bank reconciliation drafts. A reconciliation checks our books against the
// bank's own statement, so it cannot be fully automatic: the closing balance
// exists only on the statement. The system builds everything else from the books
// (the pending items, pre-ticked from their clearing dates, and the System
// Balance), and the accountant confirms the statement's date and types its
// closing balance.
//
// A draft appears by itself when a transfer is recorded (like the document that
// follows a receiving report), and at month-end for banks with other activity.
// There is no button to ask for one.

type Bank = { id: string; name: string; accountType: string }
type Rec = {
  id: string
  bankAccountId: string
  autoCreated?: boolean
  awaitingStatement?: boolean
  reconciled: boolean
  statementDate: string
}

const unwrap = <T>(body: unknown): T =>
  (Array.isArray(body) ? body : (body as { data: T }).data) as T

async function listBanks(request: APIRequestContext): Promise<Bank[]> {
  return unwrap<Bank[]>(await (await request.get('/api/bank-accounts')).json())
}
async function listRecs(request: APIRequestContext): Promise<Rec[]> {
  return unwrap<Rec[]>(await (await request.get('/api/bank-accounts/reconciliations')).json())
}
async function recordTransfer(
  request: APIRequestContext,
  from: Bank,
  to: Bank,
  amount: number,
  clearingDate = '2027-01-15'
) {
  const made = await request.post('/api/bank-accounts/transfer', {
    data: {
      sourceBankAccountId: from.id,
      destinationBankAccountId: to.id,
      amount,
      date: '2026-08-31',
      clearingDate,
    },
  })
  expect(made.ok()).toBe(true)
}

// Unfinished drafts on this bank, so a run starts from none and leaves none: a
// transfer makes one by itself now, and an earlier run may have left one.
async function dropDraftsFor(request: APIRequestContext, bankId: string) {
  for (const r of (await listRecs(request)).filter(
    (r) => r.bankAccountId === bankId && r.autoCreated && !r.reconciled
  )) {
    await request.delete(`/api/bank-accounts/reconciliations/${r.id}`)
  }
}
test.describe('Accounting — Bank Reconciliation drafts', () => {
  test('recording a transfer makes the draft, which keeps up with later transfers until the statement date and balance are entered', async ({
    page,
    request,
  }) => {
    const banks = await listBanks(request)
    const operating = banks.find((b) => b.accountType === 'Operating')!
    const pettyCash = banks.find((b) => b.accountType === 'Petty Cash')!
    expect(operating && pettyCash).toBeTruthy()
    await dropDraftsFor(request, operating.id)

    // Record a transfer. Nobody asks for a draft.
    await recordTransfer(request, operating, pettyCash, 600)

    await gotoReady(page, '/accounting/bank-reconciliation')
    await expect(page.getByRole('heading', { name: 'Bank Reconciliation' })).toBeVisible({
      timeout: 30_000,
    })
    // It is already there, marked Draft, with the numbers only the bank knows left out.
    const row = page.locator('tbody tr', { hasText: operating.name }).filter({ hasText: 'Draft' })
    await expect(row).toBeVisible({ timeout: 15_000 })
    // Drafts are the ones waiting for the accountant, so they come first.
    await expect(page.locator('tbody tr').first()).toContainText('Draft')
    // And there is no button to ask for one: they just appear.
    await expect(page.getByRole('button', { name: 'Create drafts' })).toHaveCount(0)
    await expect(row).not.toContainText('Mark reconciled')

    // Open it. It says what it is and asks for the two things only the statement has.
    await row.click()
    await page.waitForURL(/\/accounting\/bank-reconciliation\/[0-9a-f-]{36}$/, { timeout: 15_000 })
    const worksheetUrl = page.url()
    await expect(page.getByText('Draft', { exact: true })).toBeVisible({ timeout: 15_000 })
    await expect(page.getByText('Not entered yet')).toBeVisible()
    const entry = page.getByRole('form', { name: 'Enter the bank statement balance' })
    await expect(entry).toBeVisible()
    await expect(entry.getByLabel('Statement Date *')).toBeVisible()
    // Every pending transfer out of this bank is on it (a test database has many
    // from earlier runs), so count them rather than assume one.
    const transferLines = page.getByText('Inter-Account Transfer (out)')
    await expect(transferLines.first()).toBeVisible()
    const before = await transferLines.count()
    const mark = page.getByRole('button', { name: 'Mark Reconciled' })
    await expect(mark).toBeDisabled()
    await expect(page.getByText('Enter the statement balance first.')).toBeVisible()

    // Another transfer is recorded while the draft is still open: it joins the
    // same draft, rather than a second one appearing.
    await recordTransfer(request, operating, pettyCash, 450)
    await gotoReady(page, worksheetUrl)
    await expect(transferLines).toHaveCount(before + 1, { timeout: 15_000 })
    // Still exactly one unfinished draft for the bank.
    expect(
      (await listRecs(request)).filter(
        (r) => r.bankAccountId === operating.id && r.autoCreated && !r.reconciled
      )
    ).toHaveLength(1)

    // The statement arrives: confirm its date, type its closing balance. The draft
    // becomes a normal worksheet and the usual rule (the two sides agree) applies.
    await gotoReady(page, worksheetUrl)
    await expect(entry).toBeVisible({ timeout: 15_000 })
    await fillStable(entry.getByLabel('Statement Balance *'), '1')
    await entry.getByRole('button', { name: 'Save statement balance' }).click()
    await expect(entry).toHaveCount(0, { timeout: 15_000 })
    await expect(page.getByText('Draft', { exact: true })).toHaveCount(0)
    await expect(page.getByText('In Progress', { exact: true })).toBeVisible()
    await expect(page.getByText('Not entered yet')).toHaveCount(0)
    await expect(mark).toBeDisabled()

    // Clean up: this was a throwaway worksheet.
    page.once('dialog', (dialog) => dialog.accept())
    await page.getByRole('button', { name: 'Delete' }).click()
    await page.waitForURL('**/accounting/bank-reconciliation', { timeout: 15_000 })
    await dropDraftsFor(request, operating.id)
  })
})
