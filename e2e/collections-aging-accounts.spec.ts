import { test, expect, type Page } from '@playwright/test'
import { fillStable, gotoReady, loginAs } from './utils'
import { fillMoney, openCustomerOnCollections } from './collections-plan'
import { AGING_TEMPLATE_HEADERS } from '../src/schema/crm/aging-load'

// Customers loaded from the client's aging sheet were findable in CRM and had a
// ledger, but POS Collections never listed them: it is built from installment
// schedule lines, and a loaded account has no schedule. So a collector searching
// for an aging customer found "No customers with an outstanding due".
//
// Now Collections lists them and collects them like any plan — one "due" holding
// the whole balance, no rebate and no late penalty (the sheet keeps its penalty
// beside the balance) — and the customer ledger is not branch-scoped, so a branch
// user reads every transaction a customer has whichever branch it came from.
//
// The fixture is loaded through the real upload page (see ar-aging-upload.spec.ts)
// so the accounts are exactly what the client's own upload makes.

const stamp = Date.now()
const SI_PREFIX = `E2ECA${stamp}`
// Customers are matched by their letters (digits and punctuation are ignored),
// so the fixture people differ — and stay unique per run — in letters.
const LETTERS = String(stamp).replace(/\d/g, (d) => 'ABCDEFGHIJ'[Number(d)])
const CUSTOMER = `E2E COLLECT ${LETTERS} ALPHA`
const PASSWORD = process.env.E2E_OWNER_PASSWORD ?? 'dev-prominent-enterprise-2026'
// A Business Owner is unscoped; this Branch Manager belongs to Bago, and the
// fixture's account is tagged Ajuy ('AJB') — another branch's.
const BAGO_MANAGER = 'technova.b1.manager@test.com'

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

// OB 8,000 with 5,000 not yet due (NYD), so the sheet's own figures are: owes
// 8,000, 3,000 of it demandable now. The first MI was in Sept 2024 and 5 months
// have run, so the next due date is long past.
const SALE = sheetRow({
  CAT: 'A',
  br: 'AJB',
  'SI No.': `${SI_PREFIX}-1`,
  'SI Date': '08-15-2024',
  'Customer Name': CUSTOMER,
  Term: '12',
  MI: '1000',
  'FMI Date': '09-15-2024',
  DP: '1000',
  PNV: '12000',
  OB: '8000',
  NYD: '5000',
  totdue: '3000',
  UNCOLL: '3000',
  'MI DUE': '1000',
  'NO ARS': '1',
  'MOS RUN': '5',
  "TOTAL PAY'T": '5000',
  LCP: '10000',
})

// A second account of the same customer, owing 5,000 with nothing due yet — what
// an aging customer with two sales looks like.
const SALE_2 = sheetRow({
  CAT: 'A',
  br: 'AJB',
  'SI No.': `${SI_PREFIX}-2`,
  'SI Date': '09-15-2025',
  'Customer Name': CUSTOMER,
  Term: '12',
  MI: '1000',
  'FMI Date': '10-15-2025',
  DP: '1000',
  PNV: '12000',
  OB: '5000',
  NYD: '5000',
  totdue: '0',
  UNCOLL: '0',
  'MI DUE': '0',
  'NO ARS': '1',
  'MOS RUN': '0',
  "TOTAL PAY'T": '7000',
  LCP: '10000',
})

async function loadSheet(page: Page) {
  await gotoReady(page, '/crm/installment-accounts/load-aging')
  const buffer = Buffer.from([AGING_TEMPLATE_HEADERS.join(','), SALE, SALE_2].join('\n'))
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

async function fixtureCustomerId(page: Page): Promise<string> {
  const found = await page.request.get(`/api/crm/installment-accounts?search=${SI_PREFIX}`)
  const accounts: { customerId: string }[] = (await found.json()).data ?? []
  // Two accounts, one customer.
  expect(accounts).toHaveLength(2)
  expect(new Set(accounts.map((a) => a.customerId)).size).toBe(1)
  return accounts[0].customerId
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
  // Best effort: take the fixture account and its customer back out.
  const request = await playwright.request.newContext({
    baseURL: testInfo.project.use.baseURL,
    storageState: 'e2e/.auth/business-owner.json',
  })
  const found = await request.get(`/api/crm/installment-accounts?search=${SI_PREFIX}`)
  if (found.ok()) {
    const accounts: { id: string; customerId: string }[] = (await found.json()).data ?? []
    for (const a of accounts) {
      await request.delete(`/api/crm/installment-accounts/${a.id}`).catch(() => {})
      await request.delete(`/api/crm/customers/${a.customerId}`).catch(() => {})
    }
  }
  await request.dispose()
})

const agingRow = (page: Page) =>
  page.locator('li').filter({ has: page.getByTestId('aging-account-balance') })

test('a customer from the aging upload is listed in Collections and can be collected', async ({
  page,
}) => {
  await gotoReady(page, '/pos/collections')
  await fillStable(page.getByPlaceholder('Filter by name or phone…'), CUSTOMER)
  const row = page.locator('ul > li > button').filter({ hasText: CUSTOMER }).first()
  await expect(row).toBeVisible({ timeout: 20_000 })
  // What the sheet says across both accounts: 13,000 owed, 3,000 of it
  // demandable now.
  await expect(row).toContainText('₱13,000.00')
  await expect(row).toContainText('₱3,000.00 due now')
  await row.click()

  // Each account is its own plan, flagged as an aging account, holding its whole
  // balance — oldest due first.
  await expect(page.getByTestId('aging-account-badge')).toHaveCount(2, { timeout: 15_000 })
  await expect(page.getByText(`${SI_PREFIX}-1`)).toBeVisible()
  await expect(agingRow(page).nth(0)).toContainText('Outstanding ₱8,000.00')
  await expect(agingRow(page).nth(1)).toContainText('Outstanding ₱5,000.00')

  await agingRow(page).nth(0).getByRole('checkbox').check()
  await expect(page.getByRole('heading', { name: 'Collect Payment' })).toBeVisible()
  // The branch's payment methods load a moment after the panel opens.
  await expect(
    page.getByTestId('collection-method-0').getByRole('button', { name: 'Debit/Credit Card' })
  ).toBeVisible({ timeout: 15_000 })

  // No rebate and no late penalty is ever offered: the sheet carries its penalty
  // beside the balance, and the backend refuses either on an account with no plan.
  const previewRow = page.locator('table tbody tr').first()
  await expect(previewRow).toContainText('Balance · due')
  await expect(previewRow.getByRole('checkbox')).toHaveCount(0)
  await expect(page.getByText(/charged 5% on the part being paid/)).toHaveCount(0)

  await fillMoney(page.getByTestId('collection-amount-0'), 1000)
  await page.getByRole('button', { name: 'Collect payment' }).click()
  await expect(page.getByRole('heading', { name: 'Collect Payment' })).not.toBeVisible({
    timeout: 20_000,
  })

  // The balance fell by what was collected, and the screen says so.
  await expect(agingRow(page).nth(0)).toContainText('Outstanding ₱7,000.00', {
    timeout: 15_000,
  })
  await expect(agingRow(page).nth(0)).toContainText('₱1,000.00 collected here')
  await expect(agingRow(page).nth(1)).toContainText('Outstanding ₱5,000.00')

  // The customer ledger tells the same story — the payment as a credit, the
  // balance down to what Collections shows.
  const ledger = await (
    await page.request.get(`/api/crm/customers/${await fixtureCustomerId(page)}/ledger`)
  ).json()
  expect(ledger.totals.outstanding).toBe(12_000)
  expect(
    ledger.rows.some((r: { credit: number }) => Math.round(r.credit * 100) === 100_000)
  ).toBeTruthy()
})

test('an aging account is collected on its own: ticking another one replaces the first', async ({
  page,
}) => {
  // The bulk-payment endpoint only settles installment dues, so two aging accounts
  // cannot share one collection — the screen never lets the panel hold both.
  await openCustomerOnCollections(page, CUSTOMER)
  await expect(page.getByTestId('aging-account-badge')).toHaveCount(2, { timeout: 15_000 })
  await expect(page.getByTestId('aging-collected-alone-note')).toBeVisible()

  const first = agingRow(page).nth(0).getByRole('checkbox')
  const second = agingRow(page).nth(1).getByRole('checkbox')
  await first.check()
  await expect(page.getByRole('heading', { name: 'Collect Payment' })).toBeVisible()
  await second.check()
  await expect(second).toBeChecked()
  await expect(first).not.toBeChecked()
  // Still one account in the panel, never "Pay Selected Dues".
  await expect(page.getByRole('heading', { name: 'Collect Payment' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Pay Selected Dues' })).toHaveCount(0)

  // Unticking it empties the panel.
  await second.uncheck()
  await expect(page.getByText('No dues selected')).toBeVisible()
})

test("another branch's manager reads the whole customer ledger, but is not offered the account to collect", async ({
  browser,
}, testInfo) => {
  // A clean session — not the Business Owner's saved login this project carries.
  const context = await browser.newContext({
    baseURL: testInfo.project.use.baseURL,
    storageState: { cookies: [], origins: [] },
  })
  const page = await context.newPage()
  await loginAs(page, BAGO_MANAGER, PASSWORD)

  const owner = await browser.newContext({
    baseURL: testInfo.project.use.baseURL,
    storageState: 'e2e/.auth/business-owner.json',
  })
  const customerId = await fixtureCustomerId(await owner.newPage())
  const ownerLedger = await (
    await owner.request.get(`/api/crm/customers/${customerId}/ledger`)
  ).json()
  await owner.close()

  // The ledger is the customer's: a Bago manager sees an Ajuy account's rows,
  // exactly as the Business Owner does (it used to come back empty).
  const res = await page.request.get(`/api/crm/customers/${customerId}/ledger`)
  expect(res.ok()).toBeTruthy()
  const ledger = await res.json()
  expect(ledger.rows.length).toBeGreaterThan(0)
  expect(ledger.rows).toHaveLength(ownerLedger.rows.length)
  expect(ledger.totals).toEqual(ownerLedger.totals)

  // Collecting stays with the account's own branch: Collections does not list it.
  // The filter is re-typed on each try: a page this fresh can drop what was typed
  // as it finishes loading, and then the full list shows, not the empty state.
  await gotoReady(page, '/pos/collections')
  await expect(async () => {
    await fillStable(page.getByPlaceholder('Filter by name or phone…'), CUSTOMER)
    await expect(page.getByText('No customers with an outstanding due')).toBeVisible({
      timeout: 5_000,
    })
  }).toPass({ timeout: 40_000 })
  await context.close()
})
