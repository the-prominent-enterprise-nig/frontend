import { test, expect, type Page } from '@playwright/test'
import { gotoReady } from './utils'
import { AGING_TEMPLATE_HEADERS } from '../src/schema/crm/aging-load'

// Docket NIG #38 — "Interface for Existing customer ledger". An account carried
// over from the client's aging sheet reads like a POS plan's ledger: the
// installments up to the beginning-balance cut-off as ONE Billing row (the
// sheet's MOS RUN), a Bill row for each month posted since, a cut-off marker,
// and Due following from what has been billed less what has been paid.
//
// Fixtures go in through the real upload page (see collections-aging-accounts
// .spec.ts), dated against today: the cut-off is the last day of last month, so
// the dues are placed on the 15th of the months around it.

const stamp = Date.now()
const SI_PREFIX = `E2EEX${stamp}`
const LETTERS = String(stamp).replace(/\d/g, (d) => 'ABCDEFGHIJ'[Number(d)])
const CUSTOMER = `E2E EXISTING ${LETTERS} ALPHA`

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const now = new Date()
const Y = now.getFullYear()
const M = now.getMonth() // 0-based; the cut-off is the end of month M-1
/** The `day` of the month `back` months before this one. */
const at = (back: number, day: number) => new Date(Y, M - back, day)
const mdy = (d: Date) =>
  `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}-${d.getFullYear()}`
const mon = (d: Date) => `${MONTHS[d.getMonth()]} ${d.getDate()}`
const cutoffDay = new Date(Y, M, 0) // last day of last month

/** One 60-cell row; `cells` sets columns by their header text. */
function sheetRow(cells: Record<string, string>): string {
  const out = new Array<string>(60).fill('')
  for (const [header, value] of Object.entries(cells)) {
    const at = AGING_TEMPLATE_HEADERS.indexOf(header)
    if (at === -1) throw new Error(`no such column ${header}`)
    out[at] = value
  }
  return out.map((v) => (/[",]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v)).join(',')
}

// ALPHA-1 — not yet matured. 12 x 1,000, first due 7 months before this one
// (so 7 dues have come up by the cut-off: MOS RUN 7), 3,000 paid on top of the
// 1,000 DP, one of it by a last OR dated in the cut-off month. The sheet's own
// Total Due (OB − NYD = 2,000) is NOT billed-less-paid (7,000 − 3,000 = 4,000):
// the ledger follows MOS RUN, which is the point of the client's note.
const FMI_1 = at(7, 15)
const SALE_1 = sheetRow({
  CAT: 'A',
  br: 'AJB',
  'SI No.': `${SI_PREFIX}-1`,
  'SI Date': mdy(at(8, 15)),
  'Customer Name': CUSTOMER,
  Term: '12',
  MI: '1000',
  'FMI Date': mdy(FMI_1),
  DP: '1000',
  PNV: '12000',
  OB: '9000',
  NYD: '7000',
  totdue: '2000',
  UNCOLL: '2000',
  'MI DUE': '4000',
  pnlty: '200',
  'NO ARS': '4',
  'MOS RUN': '7',
  "TOTAL PAY'T": '4000',
  LCP: '10000',
  'Last OR Date': mdy(at(1, 7)),
  'Last ORlastnum': 'CR#E2EEX',
  'Last ORAmt': '1000',
  UNIT: 'E2E TEST UNIT',
  Type: 'LED TV',
  Address: 'Brgy. Test, Ajuy, Iloilo',
})

// ALPHA-2 — matured. 3 x 1,000, all three dues had come up by the cut-off.
const FMI_2 = at(4, 15)
const SALE_2 = sheetRow({
  CAT: 'A',
  br: 'AJB',
  'SI No.': `${SI_PREFIX}-2`,
  'SI Date': mdy(at(5, 15)),
  'Customer Name': CUSTOMER,
  Term: '3',
  MI: '1000',
  'FMI Date': mdy(FMI_2),
  DP: '500',
  PNV: '3000',
  OB: '1500',
  NYD: '0',
  totdue: '1500',
  UNCOLL: '1500',
  'MI DUE': '1500',
  'NO ARS': '2',
  'MOS RUN': '3',
  "TOTAL PAY'T": '2000',
  LCP: '3000',
})

async function loadSheet(page: Page) {
  await gotoReady(page, '/crm/installment-accounts/load-aging')
  const buffer = Buffer.from([AGING_TEMPLATE_HEADERS.join(','), SALE_1, SALE_2].join('\n'))
  // A pick made before the page has hydrated is dropped, so it is repeated
  // until the page answers.
  await expect(async () => {
    await page.setInputFiles('[data-testid="aging-load-input"]', {
      name: 'aging.csv',
      mimeType: 'text/csv',
      buffer,
    })
    await expect(page.getByText('sales read')).toBeVisible({ timeout: 6_000 })
  }).toPass({ timeout: 30_000 })
  await page.getByRole('button', { name: 'Load 2 accounts' }).click()
  await expect(page.getByTestId('aging-load-done')).toBeVisible({ timeout: 60_000 })
}

type Fixture = { id: string; customerId: string; accountNumber: string }
const accountOf = async (page: Page, suffix: '1' | '2'): Promise<Fixture> => {
  const found = await page.request.get(
    `/api/crm/installment-accounts?search=${SI_PREFIX}-${suffix}`
  )
  const accounts: Fixture[] = (await found.json()).data ?? []
  expect(accounts).toHaveLength(1)
  return accounts[0]
}

/** The Billing row(s): "Billing Mar 2 – Sep 2, 2026 (7 MIs × ₱2,060)" — case-sensitive, so the
 * cut-off marker's "billing posted since" is not one. */
const BILLING_ROW = /Billing [A-Z][a-z]{2} \d{1,2}/

const openLedger = async (page: Page, a: Fixture) => {
  await gotoReady(page, `/crm/customers/${a.customerId}/ledger?transactionId=acct:${a.id}`)
  await expect(page.getByTestId('existing-ledger')).toBeVisible({ timeout: 60_000 })
}

test.describe.configure({ mode: 'serial' })

test.beforeAll(async ({ browser }, testInfo) => {
  test.setTimeout(120_000)
  const context = await browser.newContext({
    baseURL: testInfo.project.use.baseURL,
    storageState: 'e2e/.auth/business-owner.json',
  })
  const page = await context.newPage()
  await loadSheet(page)
  await context.close()
})

test.afterAll(async ({ playwright }, testInfo) => {
  // Best effort: take the fixture accounts and their customer back out.
  const request = await playwright.request.newContext({
    baseURL: testInfo.project.use.baseURL,
    storageState: 'e2e/.auth/business-owner.json',
  })
  const found = await request.get(`/api/crm/installment-accounts?search=${SI_PREFIX}`)
  if (found.ok()) {
    const accounts: { id: string; customerId: string }[] = (await found.json()).data ?? []
    for (const a of accounts) {
      await request.delete(`/api/crm/installment-accounts/${a.id}`).catch(() => {})
    }
    for (const customerId of new Set(accounts.map((a) => a.customerId))) {
      await request.delete(`/api/crm/customers/${customerId}`).catch(() => {})
    }
  }
  await request.dispose()
})

test('an account not yet matured: months-running band, Billing row at the cut-off, Bills since', async ({
  page,
}) => {
  const a = await accountOf(page, '1')
  await openLedger(page, a)

  // 7 dues had come up by the cut-off; this month's (the 15th) is billed too
  // once it has arrived.
  const billed = 7 + (now.getDate() >= 15 ? 1 : 0)
  const text = page.getByTestId('months-running-text')
  await expect(text).toContainText(`${billed} of 12`)
  await expect(text).toContainText(`${12 - billed} remaining`)
  await expect(text).toContainText(`7 were running at the ${mon(cutoffDay)} cut-off`)

  // Header: the customer, the SI and account numbers, the three actions —
  // no Active badge, and no W/tax tick box.
  const ledger = page.getByTestId('existing-ledger')
  await expect(ledger.getByRole('heading', { level: 1 })).toContainText(CUSTOMER)
  await expect(ledger).toContainText(`SI ${SI_PREFIX}-1`)
  await expect(ledger.getByRole('button', { name: 'Print' })).toBeVisible()
  await expect(ledger.getByRole('link', { name: 'Edit' })).toBeVisible()
  await expect(page.getByTestId('ledger-status')).toHaveCount(0)
  await expect(ledger.getByText('W/tax received')).toHaveCount(0)

  // Record payment goes to AR New Receipt, this account's invoice picked.
  const href = await ledger.getByRole('link', { name: 'Record payment' }).getAttribute('href')
  expect(href).toContain('/accounting/ar-invoices/receipts/new')
  expect(href).toContain('invoiceId=')

  // The Billing row stands for the seven installments billed at the cut-off,
  // and Due is billed less paid (7,000 − 3,000), not the sheet's Total Due.
  const lastDue = at(1, 15)
  const sameYear = FMI_1.getFullYear() === lastDue.getFullYear()
  const range = `${sameYear ? mon(FMI_1) : `${mon(FMI_1)}, ${FMI_1.getFullYear()}`} – ${mon(lastDue)}, ${lastDue.getFullYear()}`
  const billing = ledger.getByRole('row').filter({ hasText: BILLING_ROW })
  await expect(billing).toHaveCount(1)
  await expect(billing).toContainText(`Billing ${range} (7 MIs × ₱1,000)`)
  await expect(billing).toContainText('1–7 of 12')
  await expect(billing).toContainText('₱7,000.00') // debit
  await expect(billing).toContainText('₱4,000.00') // Due: 7,000 billed − 3,000 paid
  await expect(billing).toContainText('₱9,000.00') // Outstanding: untouched by a bill

  // The cut-off marker sits before anything dated after it.
  const marker = page.getByTestId('cutoff-marker')
  await expect(marker).toContainText('Beginning balance cut-off')
  await expect(marker).toContainText(`7 of 12 installments billed at cut-off`)
  await expect(marker).toContainText(
    billed === 8 ? 'billing posted since' : 'no billings posted since'
  )

  // The sheet's penalty is its own highlighted row, outside Due and Outstanding.
  const penalty = page.getByTestId('penalty-row')
  await expect(penalty).toContainText('₱200.00')
  await expect(penalty).toContainText('₱4,000.00')

  // Totals tie to the rows: Total amt due is billed less paid; Outstanding is OB.
  const due = 7000 + (billed - 7) * 1000 - 3000
  await expect(page.getByTestId('total-amt-due')).toContainText(
    `₱${due.toLocaleString('en-US')}.00`
  )
  await expect(page.getByTestId('total-amt-due')).toContainText('excl. penalty ₱200.00')
  await expect(page.getByTestId('total-amt-outstanding')).toContainText('₱9,000.00')
  await expect(ledger).toContainText('Installments with balance')

  // Account info carries the sheet's own unit, address and collector fields.
  await expect(page.getByTestId('ledger-unit')).toContainText('E2E TEST UNIT')
  await expect(ledger).toContainText('Brgy. Test, Ajuy, Iloilo')
})

test('a matured account: all installments billed at once, nothing further to bill', async ({
  page,
}) => {
  const a = await accountOf(page, '2')
  await openLedger(page, a)

  await expect(page.getByTestId('months-running-text')).toContainText(
    '3 of 3 · fully billed · 2 installments in arrears'
  )
  const ledger = page.getByTestId('existing-ledger')
  const billing = ledger.getByRole('row').filter({ hasText: BILLING_ROW })
  await expect(billing).toContainText('(3 MIs × ₱1,000)')
  await expect(billing).toContainText('1–3 of 3')
  await expect(billing).toContainText('₱1,500.00') // Due = Outstanding: the whole balance
  // No Bill is posted after the cut-off — everything was billed already.
  await expect(ledger.getByRole('row').filter({ hasText: /^.*\bBill\b\s*Bill\b/ })).toHaveCount(0)
  await expect(page.getByTestId('cutoff-marker')).toContainText(
    '3 of 3 installments billed · no further bills to post'
  )
  await expect(ledger).toContainText('Installments in arrears')
})

test('the Transaction picker sits beside the back link and a POS plan keeps the paper-form ledger', async ({
  page,
}) => {
  const a = await accountOf(page, '1')
  await openLedger(page, a)
  await expect(page.getByRole('link', { name: /Back to/ })).toBeVisible()
  await expect(page.getByLabel('Transaction')).toBeVisible()
  // The all-transactions view of the same customer still lists both accounts,
  // each with its Billing row.
  await gotoReady(page, `/crm/customers/${a.customerId}/ledger`)
  await expect(page.getByRole('row').filter({ hasText: BILLING_ROW })).toHaveCount(2, {
    timeout: 60_000,
  })
  await expect(page.getByTestId('existing-ledger')).toHaveCount(0)
})
