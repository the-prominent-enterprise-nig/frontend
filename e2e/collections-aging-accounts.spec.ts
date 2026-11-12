import { test, expect, type Page } from '@playwright/test'
import { fillStable, gotoReady, loginAs } from './utils'
import { fillMoney, openCustomerOnCollections } from './collections-plan'
import { AGING_TEMPLATE_HEADERS } from '../src/schema/crm/aging-load'

// Customers loaded from the client's aging sheet were findable in CRM and had a
// ledger, but POS Collections never listed them: it is built from installment
// schedule lines, and a loaded account has no schedule. So a collector searching
// for an aging customer found "No customers with an outstanding due".
//
// Now Collections lists them and collects them like any plan — a due per month of
// the term, laid out from the contract the way a system-made plan's schedule is
// (Docket NIG #50), with the late penalty and rebate a system-made plan's months
// earn (the sheet's own penalty stays beside the balance, for reference) — and the
// customer ledger is not branch-scoped, so a branch user reads every transaction a
// customer has whichever branch it came from.
//
// The fixture is loaded through the real upload page (see ar-aging-upload.spec.ts)
// so the accounts are exactly what the client's own upload makes.

const stamp = Date.now()
const SI_PREFIX = `E2ECA${stamp}`
// Customers are matched by their letters (digits and punctuation are ignored),
// so the fixture people differ — and stay unique per run — in letters.
const LETTERS = String(stamp).replace(/\d/g, (d) => 'ABCDEFGHIJ'[Number(d)])
const CUSTOMER = `E2E COLLECT ${LETTERS} ALPHA`
// A second customer whose account has NO branch: the sheet's branch code is one
// the loader cannot place (about one aging account in five), so it is left
// unbranched — "enterprise-wide", not someone else's branch.
const CUSTOMER_NO_BRANCH = `E2E COLLECT ${LETTERS} BRAVO`
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

const SALE_NO_BRANCH = sheetRow({
  CAT: 'A',
  br: 'ZZZ',
  'SI No.': `${SI_PREFIX}-3`,
  'SI Date': '08-15-2024',
  'Customer Name': CUSTOMER_NO_BRANCH,
  Term: '12',
  MI: '1000',
  'FMI Date': '09-15-2024',
  DP: '1000',
  PNV: '12000',
  OB: '3000',
  NYD: '1000',
  totdue: '2000',
  UNCOLL: '2000',
  'MI DUE': '1000',
  'NO ARS': '1',
  'MOS RUN': '5',
  "TOTAL PAY'T": '9000',
  LCP: '10000',
})

async function loadSheet(page: Page) {
  await gotoReady(page, '/crm/installment-accounts/load-aging')
  const buffer = Buffer.from(
    [AGING_TEMPLATE_HEADERS.join(','), SALE, SALE_2, SALE_NO_BRANCH].join('\n')
  )
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
  await page.getByRole('button', { name: 'Load 3 accounts' }).click()
  await expect(page.getByTestId('aging-load-done')).toBeVisible({ timeout: 60_000 })
}

async function fixtureCustomerId(page: Page): Promise<string> {
  const found = await page.request.get(`/api/crm/installment-accounts?search=${SI_PREFIX}`)
  const all: { customerId: string; accountNumber: string }[] = (await found.json()).data ?? []
  // The first customer's two accounts (-1 and -2); -3 belongs to the unbranched one.
  const accounts = all.filter((a) => /-[12]$/.test(a.accountNumber))
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

// One loaded account's plan: a due per month of its term, like a system-made plan.
const agingPlan = (page: Page, siNo: string) =>
  page
    .locator('div.rounded-xl')
    .filter({ has: page.getByTestId('aging-account-badge') })
    .filter({ hasText: siNo })
// A month already paid shows this pill instead of a tick box.
const PAID_MONTH = /already fully paid/

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

  // Each account is its own plan, flagged as an aging account, with a due for
  // every month of its term — oldest first.
  await expect(page.getByTestId('aging-account-badge')).toHaveCount(2, { timeout: 15_000 })
  const plan1 = agingPlan(page, `${SI_PREFIX}-1`)
  const plan2 = agingPlan(page, `${SI_PREFIX}-2`)
  await expect(plan1.getByRole('listitem')).toHaveCount(12)
  await expect(plan2.getByRole('listitem')).toHaveCount(12)
  await expect(plan1.getByRole('listitem').nth(0)).toContainText('Payment 1 of 12')
  await expect(plan1.getByRole('listitem').nth(0)).toContainText('₱1,000.00 of ₱1,000.00 paid')
  // ₱12,000 billed less the ₱8,000 owed: the first four months are paid (oldest
  // first) and the other eight are still to pay. The second account owes ₱5,000,
  // so seven are paid and five are to pay.
  await expect(plan1.getByTitle(PAID_MONTH)).toHaveCount(4)
  await expect(plan1.getByRole('checkbox')).toHaveCount(8)
  await expect(plan1.getByRole('listitem').nth(4)).toContainText('₱0.00 of ₱1,000.00 paid')
  await expect(plan2.getByTitle(PAID_MONTH)).toHaveCount(7)
  await expect(plan2.getByRole('checkbox')).toHaveCount(5)

  // The next month to pay is the first with a tick box — month 5.
  await plan1.getByRole('checkbox').first().check()
  await expect(page.getByRole('heading', { name: 'Collect Payment' })).toBeVisible()
  // The branch's payment methods load a moment after the panel opens.
  await expect(
    page.getByTestId('collection-method-0').getByRole('button', { name: 'Debit/Credit Card' })
  ).toBeVisible({ timeout: 15_000 })

  // Month 5 (Jan 2025) is long past, so it earns the late penalty a system-made
  // plan's month would — 5% of the part being paid, so ₱50 on ₱1,000 — and a
  // rebate is on offer too (ticked off by default on a late month).
  const previewRow = page.locator('table tbody tr').first()
  await expect(previewRow).toContainText('Payment 5 · due')
  await expect(previewRow.getByRole('checkbox')).toHaveCount(2)
  await expect(previewRow).toContainText('+₱50.00')
  await expect(page.getByText(/charged 5% on the part being paid/)).toBeVisible()
  await expect(page.getByText('Total with penalty')).toBeVisible()

  // What is handed over is the month plus its penalty.
  await fillMoney(page.getByTestId('collection-amount-0'), 1050)
  await page.getByRole('button', { name: 'Collect payment' }).click()
  await expect(page.getByRole('heading', { name: 'Collect Payment' })).not.toBeVisible({
    timeout: 20_000,
  })

  // The month fills: the collection pays month 5, the oldest still owing, and the
  // second account is untouched.
  await expect(plan1.getByTitle(PAID_MONTH)).toHaveCount(5, { timeout: 15_000 })
  await expect(plan1.getByRole('checkbox')).toHaveCount(7)
  await expect(plan2.getByTitle(PAID_MONTH)).toHaveCount(7)

  // The customer ledger tells the same story, the way a system-made account's
  // does: the late penalty as a charge row of its own, then the payment for the
  // whole cash handed over — ₱1,000 and its ₱50 — and the balance down to what
  // Collections shows (the penalty is income, so it never moves the balance).
  const ledger = await (
    await page.request.get(`/api/crm/customers/${await fixtureCustomerId(page)}/ledger`)
  ).json()
  expect(ledger.totals.outstanding).toBe(12_000)
  type Row = { credit: number; debit: number; description: string; displayOnly?: boolean }
  const rows: Row[] = ledger.rows
  expect(
    rows.some(
      (r) =>
        r.description === 'Late Penalty' && !r.displayOnly && Math.round(r.debit * 100) === 5_000
    )
  ).toBeTruthy()
  expect(
    rows.some(
      (r) => r.description.startsWith('Payment for MI') && Math.round(r.credit * 100) === 105_000
    )
  ).toBeTruthy()
})

test("an aging account is collected on its own: ticking another account's month replaces the first's", async ({
  page,
}) => {
  // The bulk-payment endpoint only settles installment dues, so two aging accounts
  // cannot share one collection — the screen never lets the panel hold both.
  await openCustomerOnCollections(page, CUSTOMER)
  await expect(page.getByTestId('aging-account-badge')).toHaveCount(2, { timeout: 15_000 })
  await expect(page.getByTestId('aging-collected-alone-note')).toBeVisible()

  // The next month to pay of each account.
  const first = agingPlan(page, `${SI_PREFIX}-1`).getByRole('checkbox').first()
  const second = agingPlan(page, `${SI_PREFIX}-2`).getByRole('checkbox').first()
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

test('ticking a later month also ticks every earlier unpaid month, as one payment', async ({
  page,
}) => {
  await openCustomerOnCollections(page, CUSTOMER)
  const boxes = agingPlan(page, `${SI_PREFIX}-1`).getByRole('checkbox')
  // The first test paid month 5, so months 6–12 are still to pay.
  await expect(boxes).toHaveCount(7, { timeout: 15_000 })

  await boxes.nth(2).check()
  await expect(boxes.nth(0)).toBeChecked()
  await expect(boxes.nth(1)).toBeChecked()
  await expect(boxes.nth(3)).not.toBeChecked()
  // Months 6–8 are itemized like any plan's selected dues, each with its own
  // penalty and rebate, and go in as ONE payment against the account — the bulk
  // endpoint has no schedule line to settle on a loaded account.
  await expect(page.getByRole('heading', { name: 'Pay Selected Dues' })).toBeVisible()
  await expect(page.locator('table tbody tr')).toHaveCount(3)

  // Unticking a month drops it and every later one, never an earlier one.
  await boxes.nth(1).uncheck()
  await expect(boxes.nth(0)).toBeChecked()
  await expect(boxes.nth(1)).not.toBeChecked()
  await expect(boxes.nth(2)).not.toBeChecked()
  await boxes.nth(0).uncheck()
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

test("branch managers list their own branch's accounts and the unbranched ones — never another branch's", async ({
  browser,
}, testInfo) => {
  // The Installment Accounts list used to match the manager's own branch only,
  // so an account with no branch was in Collections and the ledger but missing
  // from this list (and the Aging report) for every branch user.
  const context = await browser.newContext({
    baseURL: testInfo.project.use.baseURL,
    storageState: { cookies: [], origins: [] },
  })
  const page = await context.newPage()
  await loginAs(page, BAGO_MANAGER, PASSWORD)

  const found = async (si: number) => {
    const res = await page.request.get(`/api/crm/installment-accounts?search=${SI_PREFIX}-${si}`)
    expect(res.ok()).toBeTruthy()
    return ((await res.json()).data ?? []) as { accountNumber: string }[]
  }
  // No branch: listed. Tagged Ajuy (another branch's): not.
  expect(await found(3)).toHaveLength(1)
  expect(await found(1)).toHaveLength(0)
  expect(await found(2)).toHaveLength(0)

  // The Business Owner still lists all three.
  const owner = await browser.newContext({
    baseURL: testInfo.project.use.baseURL,
    storageState: 'e2e/.auth/business-owner.json',
  })
  const res = await owner.request.get(`/api/crm/installment-accounts?search=${SI_PREFIX}`)
  expect(((await res.json()).data ?? []) as unknown[]).toHaveLength(3)
  await owner.close()
  await context.close()
})

test("the customer page lists the customer's aging accounts, for every branch", async ({
  browser,
}, testInfo) => {
  // A customer from the aging has no POS plan, so the page used to say "No
  // installment plans" and show nothing else about what they owe.
  const owner = await browser.newContext({
    baseURL: testInfo.project.use.baseURL,
    storageState: 'e2e/.auth/business-owner.json',
  })
  const customerId = await fixtureCustomerId(await owner.newPage())
  const ownerPage = await owner.newPage()
  await gotoReady(ownerPage, `/crm/customers/${customerId}`)
  const section = ownerPage.getByTestId('aging-accounts')
  await expect(section).toBeVisible({ timeout: 30_000 })
  const rows = section.getByTestId('aging-account-row')
  await expect(rows).toHaveCount(2)
  // SI-1 had ₱1,000 collected in the first test, SI-2 is untouched.
  await expect(rows.filter({ hasText: `${SI_PREFIX}-1` })).toContainText('₱7,000.00')
  await expect(rows.filter({ hasText: `${SI_PREFIX}-2` })).toContainText('₱5,000.00')
  await expect(rows.first()).toContainText('Ajuy')
  // The POS-plan list is still just POS plans.
  await expect(ownerPage.getByText('No installment plans for this customer.')).toBeVisible()
  await owner.close()

  // A manager of another branch sees the same two accounts: the page is the
  // customer's, like the ledger.
  const context = await browser.newContext({
    baseURL: testInfo.project.use.baseURL,
    storageState: { cookies: [], origins: [] },
  })
  const page = await context.newPage()
  await loginAs(page, BAGO_MANAGER, PASSWORD)
  await gotoReady(page, `/crm/customers/${customerId}`)
  await expect(page.getByTestId('aging-accounts').getByTestId('aging-account-row')).toHaveCount(2, {
    timeout: 30_000,
  })
  await context.close()
})

test('two months collected together are one payment, and fill the months oldest first', async ({
  page,
}) => {
  // Last on purpose: it moves the balance the customer-page test above reads.
  await openCustomerOnCollections(page, CUSTOMER)
  const plan1 = agingPlan(page, `${SI_PREFIX}-1`)
  await expect(plan1.getByTitle(PAID_MONTH)).toHaveCount(5, { timeout: 15_000 })

  await plan1.getByRole('checkbox').nth(1).check()
  await expect(page.getByRole('heading', { name: 'Pay Selected Dues' })).toBeVisible()
  await expect(
    page.getByTestId('collection-method-0').getByRole('button', { name: 'Debit/Credit Card' })
  ).toBeVisible({ timeout: 15_000 })
  await expect(page.locator('table tbody tr')).toHaveCount(2)

  // ₱2,000 of dues and the 5% penalty on each late month: ₱100.
  await fillMoney(page.getByTestId('collection-amount-0'), 2100)
  await page.getByRole('button', { name: 'Collect payment' }).click()
  await expect(page.getByRole('heading', { name: 'Pay Selected Dues' })).not.toBeVisible({
    timeout: 20_000,
  })

  // Months 6 and 7 are paid; the balance is ₱5,000 here and ₱5,000 on the other.
  await expect(plan1.getByTitle(PAID_MONTH)).toHaveCount(7, { timeout: 15_000 })
  await expect(plan1.getByRole('checkbox')).toHaveCount(5)
  const ledger = await (
    await page.request.get(`/api/crm/customers/${await fixtureCustomerId(page)}/ledger`)
  ).json()
  expect(ledger.totals.outstanding).toBe(10_000)
})

test('a month can take its rebate when the payment clears it in full', async ({ page }) => {
  // After the test above months 1–7 are paid and the account owes ₱5,000.
  await openCustomerOnCollections(page, CUSTOMER)
  const plan1 = agingPlan(page, `${SI_PREFIX}-1`)
  await expect(plan1.getByTitle(PAID_MONTH)).toHaveCount(7, { timeout: 15_000 })

  await plan1.getByRole('checkbox').first().check()
  await expect(page.getByRole('heading', { name: 'Collect Payment' })).toBeVisible()
  await expect(
    page.getByTestId('collection-method-0').getByRole('button', { name: 'Debit/Credit Card' })
  ).toBeVisible({ timeout: 15_000 })

  // The rebate is the account's prompt-payment discount: 7.5% of the ₱1,000
  // month. Ticking it takes ₱75 off what is handed over; the 5% late penalty
  // still follows the part of the month being settled (₱1,000, rebate included).
  const previewRow = page.locator('table tbody tr').first()
  await previewRow.getByRole('checkbox').first().check()
  await expect(previewRow).toContainText('−₱75.00')
  await expect(previewRow).toContainText('+₱50.00')
  // ₱1,000 − ₱75 rebate + ₱50 penalty.
  await fillMoney(page.getByTestId('collection-amount-0'), 975)
  await page.getByRole('button', { name: 'Collect payment' }).click()
  await expect(page.getByRole('heading', { name: 'Collect Payment' })).not.toBeVisible({
    timeout: 20_000,
  })

  // Month 8 is paid — by ₱925 of cash and the ₱75 rebate — and the account owes
  // ₱4,000; the penalty is income, never part of the receivable.
  await expect(plan1.getByTitle(PAID_MONTH)).toHaveCount(8, { timeout: 15_000 })
  const ledger = await (
    await page.request.get(`/api/crm/customers/${await fixtureCustomerId(page)}/ledger`)
  ).json()
  expect(ledger.totals.outstanding).toBe(9_000)
})
