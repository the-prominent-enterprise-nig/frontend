import { test, expect, type Page } from '@playwright/test'
import { gotoReady } from './utils'

// Docket #54 — the General Ledger shows a Name and a TIN on each line of the
// Withholding Tax Payable, Input VAT and Output VAT accounts. The server sends a
// `party` on those lines only to a Business Owner or Accountant, so the screen
// shows the two columns exactly when some row carries one, and a dash for a
// line with no name or TIN. The lookup itself is covered by the backend spec
// (backend/test/general-ledger-tax-party.e2e-spec.ts); this spec stubs the
// ledger response so it checks the screen on its own, whatever data is seeded.

const ACCOUNT = {
  id: 'acct-input-vat',
  number: '1-02-010',
  name: 'Input VAT',
  type: 'ASSET',
  category: 'ASSET',
}

function line(id: string, extra: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id,
    date: '2032-03-10T00:00:00.000Z',
    reference: `JE-${id}`,
    description: `Line ${id}`,
    account: ACCOUNT,
    debit: 120,
    credit: 0,
    balance: null,
    journalEntryId: `je-${id}`,
    journalType: 'GeneralJournal',
    branchId: null,
    sourceModule: 'MANUAL',
    sourceDocumentId: null,
    sourceDocumentNo: null,
    journalDescription: `Entry ${id}`,
    ...extra,
  }
}

async function stubLedger(page: Page, rows: Record<string, unknown>[]): Promise<void> {
  // The list request only; the Excel export lives at .../general-ledger/export.
  await page.route(/\/reports\/general-ledger\?/, (route) => route.fulfill({ json: rows }))
}

test('Name and TIN columns show on a tax line, with a dash where there is none', async ({
  page,
}) => {
  await stubLedger(page, [
    line('1', { party: { name: 'Acme Trading Corp', tin: '987-654-321-000' } }),
    line('2', { party: { name: 'Typed Payee Only', tin: null } }),
    line('3', { party: { name: null, tin: null } }),
    line('4'), // a line on another account carries no party at all
  ])
  await gotoReady(page, '/accounting/general-ledger')

  const table = page.locator('table').first()
  await expect(table).toBeVisible({ timeout: 10_000 })
  await expect(table.getByRole('columnheader', { name: 'Name', exact: true })).toBeVisible()
  await expect(table.getByRole('columnheader', { name: 'TIN', exact: true })).toBeVisible()

  const rows = table.locator('tbody tr')
  await expect(rows).toHaveCount(4)
  await expect(rows.nth(0)).toContainText('Acme Trading Corp')
  await expect(rows.nth(0)).toContainText('987-654-321-000')
  await expect(rows.nth(1)).toContainText('Typed Payee Only')

  // Name and TIN are the two cells right after Source; a missing value is a dash.
  const headers = await table.locator('thead th').allInnerTexts()
  const nameAt = headers.findIndex((h) => h.trim().toLowerCase() === 'name')
  expect(headers[nameAt + 1].trim().toLowerCase()).toBe('tin')
  for (const i of [1, 2, 3]) {
    await expect(
      rows
        .nth(i)
        .locator('td')
        .nth(nameAt + 1)
    ).toHaveText('—')
  }
  await expect(rows.nth(2).locator('td').nth(nameAt)).toHaveText('—')
  await expect(rows.nth(3).locator('td').nth(nameAt)).toHaveText('—')
})

test('no Name or TIN column when the server sends no party (a user who may not see it)', async ({
  page,
}) => {
  await stubLedger(page, [line('1'), line('2')])
  await gotoReady(page, '/accounting/general-ledger')

  const table = page.locator('table').first()
  await expect(table).toBeVisible({ timeout: 10_000 })
  await expect(table.getByRole('columnheader', { name: 'Name', exact: true })).toHaveCount(0)
  await expect(table.getByRole('columnheader', { name: 'TIN', exact: true })).toHaveCount(0)
})

test('one account picked: Name and TIN sit before Debit and Credit, and Balance stays last', async ({
  page,
}) => {
  await stubLedger(page, [
    line('1', {
      balance: 120,
      party: { name: 'Acme Trading Corp', tin: '987-654-321-000' },
    }),
  ])
  await gotoReady(page, `/accounting/general-ledger?accountId=${ACCOUNT.id}`)

  const table = page.locator('table').first()
  await expect(table).toBeVisible({ timeout: 10_000 })
  const headers = (await table.locator('thead th').allInnerTexts()).map((h) => h.trim())
  expect(headers.map((h) => h.toLowerCase())).toEqual([
    'date',
    'reference',
    'description',
    'source',
    'name',
    'tin',
    'debit',
    'credit',
    'balance',
  ])
  await expect(table.locator('tbody tr').first()).toContainText('Acme Trading Corp')
})
